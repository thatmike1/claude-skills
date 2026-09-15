import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { dispatchTick } from './t3-bridge.mjs';

const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;
const temporaryDirectories = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  globalThis.WebSocket = originalWebSocket;
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function bindingFixture(overrides = {}) {
  const baseDir = await mkdtemp(join(tmpdir(), 'warden-t3-bridge-'));
  temporaryDirectories.push(baseDir);
  const stateDir = join(baseDir, 'userdata');
  await mkdir(stateDir);
  await writeFile(
    join(stateDir, 'server-runtime.json'),
    JSON.stringify({
      version: 1,
      pid: process.pid,
      origin: 'http://127.0.0.1:3773',
      startedAt: new Date().toISOString(),
    }),
  );
  const database = new DatabaseSync(join(stateDir, 'state.sqlite'));
  database.exec(`
    CREATE TABLE provider_session_runtime (
      thread_id TEXT PRIMARY KEY, provider_name TEXT NOT NULL, resume_cursor_json TEXT
    );
    CREATE TABLE projection_threads (
      thread_id TEXT PRIMARY KEY, title TEXT NOT NULL, deleted_at TEXT,
      archived_at TEXT, runtime_mode TEXT NOT NULL, interaction_mode TEXT NOT NULL
    );
    INSERT INTO provider_session_runtime VALUES
      ('t3-thread-123', 'codex', '{"threadId":"codex-thread-456"}');
    INSERT INTO projection_threads VALUES
      ('t3-thread-123', 'Warden', NULL, NULL, 'full-access', 'default');
  `);
  database.close();
  const tokenFile = join(baseDir, 'token');
  await writeFile(tokenFile, 'secret\n', { mode: 0o600 });
  return {
    baseDir,
    baseUrl: 'http://127.0.0.1:3773',
    threadId: 't3-thread-123',
    providerThreadId: 'codex-thread-456',
    bearerTokenFile: tokenFile,
    ...overrides,
  };
}

class FakeWebSocket extends EventTarget {
  static instances = [];

  constructor(url) {
    super();
    this.url = String(url);
    this.sent = [];
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }

  send(value) {
    this.sent.push(value);
    const request = JSON.parse(value);
    queueMicrotask(() => {
      const event = new Event('message');
      event.data = JSON.stringify({
        _tag: 'Exit',
        requestId: request.id,
        exit: { _tag: 'Success', value: { sequence: 42 } },
      });
      this.dispatchEvent(event);
    });
  }

  close() {}
}

test('dispatchTick exchanges a ticket and sends the canonical T3 turn command', async () => {
  FakeWebSocket.instances = [];
  let ticketRequest;
  globalThis.fetch = async (url, options) => {
    ticketRequest = { url: String(url), options };
    return new Response(JSON.stringify({ ticket: 'short-lived-ticket' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  globalThis.WebSocket = FakeWebSocket;

  const result = await dispatchTick(
    await bindingFixture(),
    { id: '2026-09-16T08:30:00Z', text: 'warden tick' },
  );

  assert.equal(ticketRequest.url, 'http://127.0.0.1:3773/api/auth/websocket-ticket');
  assert.equal(ticketRequest.options.method, 'POST');
  assert.equal(ticketRequest.options.headers.authorization, 'Bearer secret');
  assert.equal(FakeWebSocket.instances.length, 1);
  const socket = FakeWebSocket.instances[0];
  const url = new URL(socket.url);
  assert.equal(url.protocol, 'ws:');
  assert.equal(url.pathname, '/ws');
  assert.equal(url.searchParams.get('wsTicket'), 'short-lived-ticket');
  assert.equal(url.searchParams.get('clientSurface'), 'cli');

  const request = JSON.parse(socket.sent[0]);
  assert.deepEqual(
    {
      tag: request.tag,
      commandId: request.payload.commandId,
      threadId: request.payload.threadId,
      messageId: request.payload.message.messageId,
      text: request.payload.message.text,
      runtimeMode: request.payload.runtimeMode,
      interactionMode: request.payload.interactionMode,
      attachments: request.payload.message.attachments,
      headers: request.headers,
    },
    {
      tag: 'orchestration.dispatchCommand',
      commandId: 'warden:2026-09-16T08:30:00Z',
      threadId: 't3-thread-123',
      messageId: 'warden-message:2026-09-16T08:30:00Z',
      text: 'warden tick',
      runtimeMode: 'full-access',
      interactionMode: 'default',
      attachments: [],
      headers: [],
    },
  );
  assert.deepEqual(result, {
    dispatched: true,
    commandId: 'warden:2026-09-16T08:30:00Z',
    messageId: 'warden-message:2026-09-16T08:30:00Z',
    sequence: 42,
  });
});

test('dispatchTick fails closed before auth when the runtime origin changes', async () => {
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error('unexpected fetch');
  };
  await assert.rejects(
    dispatchTick(await bindingFixture({ baseUrl: 'http://127.0.0.1:3774' }), {
      id: 'tick-origin',
      text: 'warden tick',
    }),
    /runtime identity mismatch/,
  );
  assert.equal(fetched, false);
});

test('dispatchTick uses the current T3 thread permissions instead of stale binding values', async () => {
  FakeWebSocket.instances = [];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ticket: 'ticket' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  globalThis.WebSocket = FakeWebSocket;
  const binding = await bindingFixture({ runtimeMode: 'full-access' });
  const database = new DatabaseSync(join(binding.baseDir, 'userdata', 'state.sqlite'));
  database.exec("UPDATE projection_threads SET runtime_mode = 'approval-required'");
  database.close();

  await dispatchTick(binding, { id: 'tick-permissions', text: 'warden tick' });
  const request = JSON.parse(FakeWebSocket.instances[0].sent[0]);
  assert.equal(request.payload.runtimeMode, 'approval-required');
});

test('dispatchTick refuses an archived target before auth', async () => {
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error('unexpected fetch');
  };
  const binding = await bindingFixture();
  const database = new DatabaseSync(join(binding.baseDir, 'userdata', 'state.sqlite'));
  database.exec("UPDATE projection_threads SET archived_at = '2026-09-15T20:00:00Z'");
  database.close();

  await assert.rejects(
    dispatchTick(binding, { id: 'tick-archived', text: 'warden tick' }),
    /expected one mapping.*found 0/,
  );
  assert.equal(fetched, false);
});

test('CLI entrypoint runs when invoked through a symlink', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'warden-t3-bridge-link-'));
  temporaryDirectories.push(directory);
  const link = join(directory, 't3-bridge.mjs');
  await symlink(fileURLToPath(new URL('./t3-bridge.mjs', import.meta.url)), link);
  const result = spawnSync(process.execPath, [link], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: t3-bridge\.mjs/);
});

test('dispatchTick rejects inline bearer credentials', async () => {
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(
    dispatchTick(await bindingFixture({ bearerToken: 'secret' }), {
      id: 'tick-inline',
      text: 'warden tick',
    }),
    /refuses inline bearerToken/,
  );
});

test('dispatchTick rejects a typed T3 RPC failure', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ticket: 'ticket' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  globalThis.WebSocket = class extends FakeWebSocket {
    send(value) {
      const request = JSON.parse(value);
      queueMicrotask(() => {
        const event = new Event('message');
        event.data = JSON.stringify({
          _tag: 'Exit',
          requestId: request.id,
          exit: {
            _tag: 'Failure',
            cause: [{ _tag: 'Fail', error: { message: "Thread 'gone' does not exist" } }],
          },
        });
        this.dispatchEvent(event);
      });
    }
  };

  await assert.rejects(
    dispatchTick(
      await bindingFixture(),
      { id: 'tick-1', text: 'warden tick' },
    ),
    /Thread 'gone' does not exist/,
  );
});

test('dispatchTick fails before opening a socket when ticket auth fails', async () => {
  let opened = false;
  globalThis.fetch = async () => new Response('invalid bearer', { status: 401 });
  globalThis.WebSocket = class {
    constructor() {
      opened = true;
    }
  };

  await assert.rejects(
    dispatchTick(
      await bindingFixture({ bearerTokenFile: join(tmpdir(), 'missing-token') }),
      { id: 'tick-2', text: 'warden tick' },
    ),
    /ENOENT/,
  );
  assert.equal(opened, false);
});
