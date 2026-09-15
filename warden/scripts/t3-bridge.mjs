import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_TIMEOUT_MS = 10_000;
const RUNTIME_MODES = new Set([
  'approval-required',
  'auto-accept-edits',
  'auto',
  'full-access',
]);
const INTERACTION_MODES = new Set(['default', 'plan']);

/** expand a leading home-directory marker in a configured path. */
function expandHome(filePath) {
  return filePath === '~' || filePath.startsWith('~/')
    ? `${homedir()}${filePath.slice(1)}`
    : filePath;
}

/** require a trimmed, non-empty string without changing its contents. */
function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`T3 bridge ${label} must be a non-empty string.`);
  }
  return value.trim();
}

/** normalize a T3 endpoint to the origin recorded by its runtime. */
function normalizedOrigin(value, label) {
  const url = new URL(requiredString(value, label));
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('T3 bridge baseUrl must use http or https.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('T3 bridge baseUrl must contain only an HTTP origin.');
  }
  return url.origin;
}

/** resolve the long-lived bearer credential without exposing its value. */
async function bearerToken(binding) {
  if (Object.hasOwn(binding, 'bearerToken')) {
    throw new Error('T3 bridge refuses inline bearerToken credentials.');
  }
  if (typeof binding.bearerTokenEnv === 'string' && binding.bearerTokenEnv.trim()) {
    const name = binding.bearerTokenEnv.trim();
    const value = process.env[name]?.trim();
    if (value) return value;
    throw new Error(`T3 bridge bearer token environment variable ${name} is empty.`);
  }
  if (typeof binding.bearerTokenFile === 'string' && binding.bearerTokenFile.trim()) {
    const filePath = resolve(expandHome(binding.bearerTokenFile.trim()));
    const value = (await readFile(filePath, 'utf8')).trim();
    if (value) return value;
    throw new Error(`T3 bridge bearer token file ${filePath} is empty.`);
  }
  throw new Error('T3 bridge needs bearerTokenEnv or bearerTokenFile in its binding.');
}

/** read the runtime identity written by the explicitly selected T3 base directory. */
async function runtimeIdentity(baseDir) {
  const resolvedBaseDir = resolve(expandHome(baseDir));
  const runtimePath = join(resolvedBaseDir, 'userdata', 'server-runtime.json');
  let runtime;
  try {
    runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
  } catch (error) {
    throw new Error(`T3 bridge could not read runtime identity at ${runtimePath}.`, {
      cause: error,
    });
  }
  if (runtime?.version !== 1 || !Number.isSafeInteger(runtime.pid) || runtime.pid <= 0) {
    throw new Error(`T3 bridge found invalid runtime identity at ${runtimePath}.`);
  }
  try {
    process.kill(runtime.pid, 0);
  } catch {
    throw new Error(`T3 bridge runtime PID ${runtime.pid} is not alive.`);
  }
  return {
    baseDir: resolvedBaseDir,
    baseUrl: normalizedOrigin(runtime.origin, 'runtime origin'),
    pid: runtime.pid,
    startedAt: requiredString(runtime.startedAt, 'runtime startedAt'),
  };
}

/** find exactly one T3 thread for one Codex provider thread id. */
function mappedThread(baseDir, providerThreadId) {
  const dbPath = join(baseDir, 'userdata', 'state.sqlite');
  let database;
  try {
    database = new DatabaseSync(dbPath, { readOnly: true });
    const rows = database
      .prepare(`
        SELECT
          runtime.thread_id AS threadId,
          threads.title AS title,
          threads.runtime_mode AS runtimeMode,
          threads.interaction_mode AS interactionMode
        FROM provider_session_runtime AS runtime
        INNER JOIN projection_threads AS threads ON threads.thread_id = runtime.thread_id
        WHERE runtime.provider_name = 'codex'
          AND json_extract(runtime.resume_cursor_json, '$.threadId') = ?
          AND threads.deleted_at IS NULL
      `)
      .all(providerThreadId);
    if (rows.length !== 1) {
      throw new Error(
        `T3 bridge expected one mapping for Codex thread ${providerThreadId}, found ${rows.length}.`,
      );
    }
    return {
      threadId: String(rows[0].threadId),
      title: String(rows[0].title),
      runtimeMode: String(rows[0].runtimeMode),
      interactionMode: String(rows[0].interactionMode),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('T3 bridge expected')) throw error;
    throw new Error(`T3 bridge could not verify its read-only T3 database at ${dbPath}.`, {
      cause: error,
    });
  } finally {
    database?.close();
  }
}

/** verify that a binding still names the same live runtime and provider thread. */
export async function validateBinding(binding) {
  if (binding === null || typeof binding !== 'object') {
    throw new Error('T3 bridge binding must be an object.');
  }
  const baseDir = resolve(expandHome(requiredString(binding.baseDir, 'baseDir')));
  const baseUrl = normalizedOrigin(binding.baseUrl, 'baseUrl');
  const threadId = requiredString(binding.threadId, 'threadId');
  const providerThreadId = requiredString(binding.providerThreadId, 'providerThreadId');
  const runtime = await runtimeIdentity(baseDir);
  if (runtime.baseUrl !== baseUrl) {
    throw new Error(
      `T3 bridge runtime identity mismatch: ${baseDir} currently advertises ${runtime.baseUrl}.`,
    );
  }
  const mapped = mappedThread(baseDir, providerThreadId);
  if (mapped.threadId !== threadId) {
    throw new Error(
      `T3 bridge provider identity mismatch: Codex thread ${providerThreadId} maps to ${mapped.threadId}.`,
    );
  }
  return { ...runtime, ...mapped, providerThreadId };
}

/** discover a fail-closed binding for the Codex thread running this command. */
export async function discoverBinding(options = {}) {
  const baseDir = resolve(expandHome(options.baseDir ?? '~/.t3'));
  const providerThreadId = requiredString(
    options.providerThreadId ?? process.env.CODEX_THREAD_ID,
    'CODEX_THREAD_ID',
  );
  const runtime = await runtimeIdentity(baseDir);
  if (options.baseUrl && normalizedOrigin(options.baseUrl, 'baseUrl') !== runtime.baseUrl) {
    throw new Error('T3 bridge requested baseUrl does not match the selected runtime identity.');
  }
  const mapped = mappedThread(baseDir, providerThreadId);
  const binding = {
    baseDir,
    baseUrl: runtime.baseUrl,
    threadId: mapped.threadId,
    providerThreadId,
    runtimeMode: mapped.runtimeMode,
    interactionMode: mapped.interactionMode,
  };
  if (options.bearerTokenEnv) binding.bearerTokenEnv = options.bearerTokenEnv;
  else if (options.bearerTokenFile) binding.bearerTokenFile = options.bearerTokenFile;
  else throw new Error('T3 bridge bind needs bearerTokenEnv or bearerTokenFile.');
  return binding;
}

/** derive the ticket endpoint and websocket URL from one HTTP base URL. */
function endpoints(baseUrl) {
  const httpUrl = new URL(baseUrl);
  httpUrl.pathname = '/api/auth/websocket-ticket';
  const socketUrl = new URL(baseUrl);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  socketUrl.pathname = '/ws';
  socketUrl.searchParams.set('clientSurface', 'cli');
  return { httpUrl, socketUrl };
}

/** read a bounded error detail from a failed T3 HTTP response. */
async function responseDetail(response) {
  try {
    const value = (await response.text()).trim();
    return value ? `: ${value.slice(0, 500)}` : '';
  } catch {
    return '';
  }
}

/** trade the durable bearer credential for a short-lived websocket ticket. */
async function issueTicket(httpUrl, token, timeoutMs) {
  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(
      `T3 bridge ticket request failed with HTTP ${response.status}${await responseDetail(response)}`,
    );
  }
  const body = await response.json();
  return requiredString(body?.ticket, 'websocket ticket');
}

/** render Effect RPC's encoded failure cause into a useful local error. */
function failureMessage(cause) {
  if (!Array.isArray(cause) || cause.length === 0) return 'unknown T3 RPC failure';
  return cause
    .map((entry) => {
      if (entry?._tag === 'Fail') return entry.error?.message ?? JSON.stringify(entry.error);
      if (entry?._tag === 'Die') return `T3 RPC defect: ${JSON.stringify(entry.defect)}`;
      if (entry?._tag === 'Interrupt') return 'T3 RPC was interrupted';
      return JSON.stringify(entry);
    })
    .join('; ');
}

/** decode browser and Node websocket message payloads as JSON text. */
async function messageJson(data) {
  if (typeof data === 'string') return JSON.parse(data);
  if (data instanceof ArrayBuffer) return JSON.parse(Buffer.from(data).toString('utf8'));
  if (ArrayBuffer.isView(data)) {
    return JSON.parse(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8'));
  }
  if (typeof data?.text === 'function') return JSON.parse(await data.text());
  return JSON.parse(String(data));
}

/** send one typed request over T3's JSON Effect RPC websocket protocol. */
function sendRpc(socketUrl, { id, tag, payload }, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = new WebSocket(socketUrl);
    const request = { _tag: 'Request', id, tag, payload, headers: [] };
    let settled = false;
    const timeout = setTimeout(
      () => finish(rejectPromise, new Error(`T3 bridge RPC timed out after ${timeoutMs}ms.`)),
      timeoutMs,
    );
    function finish(callback, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // the socket may already be closed after a transport failure
      }
      callback(value);
    }
    socket.addEventListener('open', () => socket.send(JSON.stringify(request)), { once: true });
    socket.addEventListener('message', async (event) => {
      try {
        const message = await messageJson(event.data);
        if (message?._tag === 'Pong') return;
        if (message?._tag === 'Defect') {
          finish(rejectPromise, new Error(`T3 bridge RPC defect: ${JSON.stringify(message.defect)}`));
        } else if (message?._tag === 'ClientProtocolError') {
          finish(
            rejectPromise,
            new Error(`T3 bridge protocol error: ${JSON.stringify(message.error)}`),
          );
        } else if (message?._tag === 'Exit' && message.requestId === id) {
          if (message.exit?._tag === 'Success') finish(resolvePromise, message.exit.value);
          else {
            finish(
              rejectPromise,
              new Error(`T3 rejected RPC ${tag}: ${failureMessage(message.exit?.cause)}`),
            );
          }
        }
      } catch (error) {
        finish(rejectPromise, error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.addEventListener(
      'error',
      () => finish(rejectPromise, new Error('T3 bridge websocket connection failed.')),
      { once: true },
    );
    socket.addEventListener(
      'close',
      () => {
        if (!settled) finish(rejectPromise, new Error('T3 bridge websocket closed before its reply.'));
      },
      { once: true },
    );
  });
}

/** open one authenticated RPC connection after checking the local runtime identity. */
async function authenticatedRpc(binding, request) {
  const verified = await validateBinding(binding);
  const timeoutMs = binding.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('T3 bridge timeoutMs must be a positive finite number.');
  }
  const token = await bearerToken(binding);
  const { httpUrl, socketUrl } = endpoints(verified.baseUrl);
  socketUrl.searchParams.set('wsTicket', await issueTicket(httpUrl, token, timeoutMs));
  return sendRpc(socketUrl, request, timeoutMs);
}

/** verify runtime identity, thread mapping, bearer authentication, and RPC access. */
export async function doctorBinding(binding) {
  const verified = await validateBinding(binding);
  await authenticatedRpc(binding, {
    id: `warden-doctor:${crypto.randomUUID()}`,
    tag: 'server.probe',
    payload: {},
  });
  return {
    ok: true,
    baseUrl: verified.baseUrl,
    threadId: verified.threadId,
    providerThreadId: verified.providerThreadId,
    title: verified.title,
    pid: verified.pid,
  };
}

/** dispatch one idempotent scheduler tick into the explicitly bound T3 thread. */
export async function dispatchTick(binding, tick) {
  if (tick === null || typeof tick !== 'object') {
    throw new Error('T3 bridge tick must be an object.');
  }
  const tickId = requiredString(tick.id, 'tick id');
  const text = requiredString(tick.text, 'tick text');
  const runtimeMode = binding.runtimeMode ?? 'approval-required';
  const interactionMode = binding.interactionMode ?? 'default';
  if (!RUNTIME_MODES.has(runtimeMode)) {
    throw new Error(`T3 bridge runtimeMode ${runtimeMode} is not supported.`);
  }
  if (!INTERACTION_MODES.has(interactionMode)) {
    throw new Error(`T3 bridge interactionMode ${interactionMode} is not supported.`);
  }
  const commandId = `warden:${tickId}`;
  const messageId = `warden-message:${tickId}`;
  const result = await authenticatedRpc(binding, {
    id: `warden-rpc:${tickId}`,
    tag: 'orchestration.dispatchCommand',
    payload: {
      type: 'thread.turn.start',
      commandId,
      threadId: requiredString(binding.threadId, 'threadId'),
      message: { messageId, role: 'user', text, attachments: [] },
      runtimeMode,
      interactionMode,
      createdAt: new Date().toISOString(),
    },
  });
  if (!Number.isSafeInteger(result?.sequence) || result.sequence < 0) {
    throw new Error('T3 bridge received an invalid dispatch result.');
  }
  return { dispatched: true, commandId, messageId, sequence: result.sequence };
}

function cliOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`T3 bridge expected --name value, received ${key ?? 'nothing'}.`);
    }
    options[key.slice(2)] = value;
  }
  return options;
}

/** run the small operator CLI without ever printing a token. */
async function main(args) {
  const [command, ...rest] = args;
  const flags = cliOptions(rest);
  if (command === 'bind') {
    const binding = await discoverBinding({
      baseDir: flags['base-dir'],
      baseUrl: flags['base-url'],
      providerThreadId: flags['provider-thread-id'],
      bearerTokenEnv: flags['token-env'],
      bearerTokenFile: flags['token-file'],
    });
    process.stdout.write(`${JSON.stringify(binding, null, 2)}\n`);
    return;
  }
  if (command === 'doctor') {
    const bindingPath = resolve(expandHome(requiredString(flags.binding, '--binding')));
    const binding = JSON.parse(await readFile(bindingPath, 'utf8'));
    process.stdout.write(`${JSON.stringify(await doctorBinding(binding), null, 2)}\n`);
    return;
  }
  throw new Error('Usage: t3-bridge.mjs bind [options] | doctor --binding FILE');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
