#!/usr/bin/env node

import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { WardenController, WardenError } from './controller.mjs';

const DEFAULT_PORT = 1339;
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const WARDEN_DIR = dirname(dirname(SCRIPT_PATH));
const DASHBOARD_PATH = join(WARDEN_DIR, 'assets', 'dashboard.html');
const MAX_BODY_BYTES = 64 * 1024;

/** start the localhost Warden service and return its handles. */
export async function createWardenServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const stateDir = expandHome(options.stateDir ?? '~/.local/state/warden');
  const widgetsDir = expandHome(options.widgetsDir ?? '~/.t3/userdata/widgets');
  const dispatcher = options.dispatcher ?? defaultDispatcher;
  const bindingDoctor = options.bindingDoctor ?? defaultBindingDoctor;
  const notifier = options.noNotify ? async () => {} : (options.notifier ?? desktopNotifier);
  const widgetWriter = options.widgetWriter ?? makeWidgetWriter(widgetsDir);
  const releaseStateLock = await acquireStateLock(stateDir);

  let effectivePort = port;
  let controller = null;
  const server = createServer((request, response) => {
    if (!controller) {
      sendError(response, new WardenError('starting', 'Warden is starting', 503));
      return;
    }
    handleRequest({
      request,
      response,
      controller,
      bindingDoctor,
      port: effectivePort,
      dashboardPath: options.dashboardPath ?? DASHBOARD_PATH,
    })
      .catch((error) => sendError(response, error));
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    effectivePort = server.address().port;
    controller = new WardenController({
      stateDir,
      dispatcher,
      notifier,
      widgetWriter,
      ...(options.now ? { now: options.now } : {}),
      ...(options.retryDelaysMs ? { retryDelaysMs: options.retryDelaysMs } : {}),
      controlUrl: `http://127.0.0.1:${effectivePort}`,
    });
    await controller.init();
  } catch (error) {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await releaseStateLock();
    throw error;
  }

  const dueTimer = setInterval(() => {
    controller.processDue().catch((error) => {
      process.stderr.write(`warden timer: ${safeErrorMessage(error)}\n`);
    });
  }, options.dueIntervalMs ?? 1_000);
  const heartbeatTimer = setInterval(() => {
    controller.publishHeartbeat().catch((error) => {
      process.stderr.write(`warden widget: ${safeErrorMessage(error)}\n`);
    });
  }, options.heartbeatMs ?? 30_000);
  dueTimer.unref();
  heartbeatTimer.unref();

  return {
    controller,
    server,
    port: effectivePort,
    async close() {
      clearInterval(dueTimer);
      clearInterval(heartbeatTimer);
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await releaseStateLock();
    },
  };
}

async function acquireStateLock(stateDir) {
  await mkdir(stateDir, { recursive: true });
  const lockPath = join(stateDir, 'service.lock');
  const owner = `${process.pid}:${randomUUID()}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${owner}\n`);
      await handle.close();
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        try {
          if ((await readFile(lockPath, 'utf8')).trim() === owner) await unlink(lockPath);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const existing = await readFile(lockPath, 'utf8').catch(() => '');
      const pid = Number(existing.split(':', 1)[0]);
      if (Number.isInteger(pid) && processIsAlive(pid)) {
        throw new WardenError('service-running', `Warden already owns state directory ${stateDir}`, 409);
      }
      if (!Number.isInteger(pid)) {
        const lockInfo = await stat(lockPath).catch(() => null);
        if (lockInfo && Date.now() - lockInfo.mtimeMs < 10_000) {
          throw new WardenError('service-starting', `Warden is already acquiring state directory ${stateDir}`, 409);
        }
      }
      await unlink(lockPath).catch((unlinkError) => {
        if (unlinkError?.code !== 'ENOENT') throw unlinkError;
      });
    }
  }
  throw new WardenError('lock-failed', `Could not lock Warden state directory ${stateDir}`, 409);
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function handleRequest({ request, response, controller, bindingDoctor, port, dashboardPath }) {
  validateHostAndOrigin(request, port);
  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (request.method === 'GET' && url.pathname === '/api/state') {
    sendJson(response, 200, { ok: true, state: controller.getState() });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/doctor') {
    const binding = controller.getBinding();
    const bindingResult = binding ? await bindingDoctor(binding) : null;
    sendJson(response, 200, {
      ok: true,
      service: { port, phase: controller.getState().phase },
      binding: bindingResult,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/action') {
    if (request.headers['x-warden-request'] !== '1') {
      throw new WardenError('missing-request-header', 'X-Warden-Request: 1 is required', 403);
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      throw new WardenError('invalid-content-type', 'Content-Type must be application/json', 415);
    }
    const payload = await readJsonBody(request);
    const state = await controller.action(payload);
    sendJson(response, 200, { ok: true, state });
    return;
  }

  if (request.method === 'GET' && ['/', '/dashboard.html'].includes(url.pathname)) {
    const dashboard = await readFile(dashboardPath);
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      'x-content-type-options': 'nosniff',
    });
    response.end(dashboard);
    return;
  }

  throw new WardenError('not-found', 'Not found', 404);
}

function validateHostAndOrigin(request, port) {
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  if (!allowedHosts.has(request.headers.host)) {
    throw new WardenError('invalid-host', 'Host is not allowed', 403);
  }
  const origin = request.headers.origin;
  if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)) {
    throw new WardenError('invalid-origin', 'Origin is not allowed', 403);
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new WardenError('body-too-large', 'Request body is too large', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new WardenError('invalid-json', 'Request body must be valid JSON');
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendError(response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const status = error instanceof WardenError ? error.status : error?.code === 'ENOENT' ? 404 : 500;
  const code = error instanceof WardenError ? error.code : error?.code === 'ENOENT' ? 'dashboard-missing' : 'internal-error';
  const message = error instanceof WardenError ? error.message : 'Warden could not complete the request';
  sendJson(response, status, { ok: false, error: { code, message } });
}

async function defaultDispatcher(binding, tick) {
  const { dispatchTick } = await import('./t3-bridge.mjs');
  return dispatchTick(binding, tick);
}

async function defaultBindingDoctor(binding) {
  const { doctorBinding } = await import('./t3-bridge.mjs');
  return doctorBinding(binding);
}

async function desktopNotifier({ title, body }) {
  const { notifyUser } = await import('./notify.mjs');
  const result = await notifyUser(body, { title });
  if (result?.delivered === false) throw new Error(result.errors?.join('; ') || 'notification was not delivered');
}

function makeWidgetWriter(widgetsDir) {
  const widgetPath = join(widgetsDir, 'warden.json');
  return async (widget) => {
    await mkdir(widgetsDir, { recursive: true });
    const temporaryPath = `${widgetPath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(widget, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, widgetPath);
  };
}

async function requestService({ port, method = 'GET', path, body }) {
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body === undefined ? {} : {
        'content-type': 'application/json',
        'x-warden-request': '1',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new WardenError('service-unavailable', `Warden service is unavailable on port ${port}: ${safeErrorMessage(error)}`, 503);
  }
  const result = await response.json();
  if (!response.ok) {
    throw new WardenError(result.error?.code ?? 'service-error', result.error?.message ?? `HTTP ${response.status}`, response.status);
  }
  return result;
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) throw new WardenError('missing-input', 'Expected a JSON object on stdin');
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new WardenError('invalid-json', 'stdin must contain one JSON object');
  }
}

function parseArguments(argv) {
  const options = {
    port: DEFAULT_PORT,
    stateDir: '~/.local/state/warden',
    widgetsDir: '~/.t3/userdata/widgets',
    noNotify: false,
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--port') options.port = parsePort(argv[++index]);
    else if (argument === '--state-dir') options.stateDir = requiredOption(argv[++index], '--state-dir');
    else if (argument === '--widgets-dir') options.widgetsDir = requiredOption(argv[++index], '--widgets-dir');
    else if (argument === '--no-notify') options.noNotify = true;
    else if (argument === '--help' || argument === '-h') positional.push('help');
    else if (argument.startsWith('-')) throw new WardenError('unknown-option', `Unknown option: ${argument}`);
    else positional.push(argument);
  }
  if (positional.length > 1) throw new WardenError('too-many-arguments', 'Expected one command');
  return { command: positional[0] ?? 'help', options };
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new WardenError('invalid-port', '--port must be from 1 to 65535');
  return port;
}

function requiredOption(value, option) {
  if (!value || value.startsWith('-')) throw new WardenError('missing-option-value', `${option} needs a value`);
  return value;
}

function expandHome(path) {
  if (path === '~') return homedir();
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

function helpText() {
  return `warden: persistent accountability controller

Usage:
  warden.mjs [options] serve
  warden.mjs [options] status
  warden.mjs [options] start       # read the start payload from stdin
  warden.mjs [options] action      # read any action payload from stdin
  warden.mjs [options] doctor

Options:
  --port NUMBER         localhost service port (default: 1339)
  --state-dir PATH      state directory (default: ~/.local/state/warden)
  --widgets-dir PATH    T3 widget directory (default: ~/.t3/userdata/widgets)
  --no-notify           disable notify-send reminders

Start JSON:
  {"binding":{"baseDir":"/path/to/t3","baseUrl":"http://127.0.0.1:...","threadId":"...","providerThreadId":"...","bearerTokenFile":"/run/user/.../t3-token"},"endAt":"2026-09-15T18:00:00.000Z","blocks":[{"id":"focus","title":"Ship the controller","minutes":50}],"reminders":[{"id":"lunch","title":"Eat lunch","at":"2026-09-15T12:00:00.000Z"}]}

Action JSON:
  {"action":"done","id":"focus"}
  {"action":"skip","id":"focus"}
  {"action":"extend","minutes":15}
  {"action":"pause"} | {"action":"resume"} | {"action":"break","minutes":10} | {"action":"stop"}
  {"action":"check-in","id":"<pending tick id>","verdict":"on-plan|drift|break|unknown","note":"optional","nextMinutes":25}
  {"action":"replan","blocks":[{"id":"next","title":"New future block","minutes":25}]}
  {"action":"ack-reminder","id":"lunch"} | {"action":"snooze-reminder","id":"lunch","minutes":10}
`;
}

async function main(argv) {
  const { command, options } = parseArguments(argv);
  if (command === 'help') {
    process.stdout.write(helpText());
    return;
  }
  if (command === 'serve') {
    const service = await createWardenServer(options);
    process.stdout.write(`warden listening on http://127.0.0.1:${service.port}\n`);
    const shutdown = async () => {
      await service.close();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return;
  }
  if (command === 'status') {
    const result = await requestService({ port: options.port, path: '/api/state' });
    process.stdout.write(`${JSON.stringify(result.state, null, 2)}\n`);
    return;
  }
  if (command === 'start' || command === 'action') {
    const payload = await readStdinJson();
    const body = command === 'start' ? { ...payload, action: 'start' } : payload;
    const result = await requestService({ port: options.port, method: 'POST', path: '/api/action', body });
    process.stdout.write(`${JSON.stringify(result.state, null, 2)}\n`);
    return;
  }
  if (command === 'doctor') {
    const result = await requestService({ port: options.port, path: '/api/doctor' });
    process.stdout.write(JSON.stringify({
      ok: true,
      service: `http://127.0.0.1:${options.port}`,
      phase: result.service.phase,
      binding: result.binding,
      stateDir: expandHome(options.stateDir),
      widgetsDir: expandHome(options.widgetsDir),
    }, null, 2) + '\n');
    return;
  }
  throw new WardenError('unknown-command', `Unknown command: ${command}\n\n${helpText()}`);
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return await realpath(process.argv[1]) === await realpath(SCRIPT_PATH);
  } catch {
    return SCRIPT_PATH === resolve(process.argv[1]);
  }
}

if (await isMainModule()) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`warden: ${safeErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
