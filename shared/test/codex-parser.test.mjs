import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// the parser resolves CODEX_HOME once at import, so the fake home has to exist first
const CODEX_HOME = mkdtempSync(join(tmpdir(), 'codex-home-'));
process.env.CODEX_HOME = CODEX_HOME;

const SESSION = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const OLDER = '0199a1b2-c3d4-7e5f-8a9b-ffffffffffff';
const LEGACY = '0199a1b2-c3d4-7e5f-8a9b-eeeeeeeeeeee';

/** writes one rollout under sessions/YYYY/MM/DD the way Codex files them. */
function writeRollout(id, day, records, { mtimeSec, threadName } = {}) {
  const [y, m, d] = day.split('-');
  const dir = join(CODEX_HOME, 'sessions', y, m, d);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `rollout-${day}T08-00-00-${id}.jsonl`);
  writeFileSync(path, records.map(r => JSON.stringify(r)).join('\n') + '\n');
  if (mtimeSec) utimesSync(path, mtimeSec, mtimeSec);
  if (threadName) {
    writeFileSync(join(CODEX_HOME, 'session_index.jsonl'), JSON.stringify({ id, thread_name: threadName, updated_at: `${day}T08:00:00Z` }) + '\n', { flag: 'a' });
  }
  return path;
}

const at = (h, m = 0) => `2026-09-10T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

writeRollout(SESSION, '2026-09-10', [
  { timestamp: at(8), type: 'session_meta', payload: { id: SESSION, timestamp: at(8), cwd: '/home/someone/git/demo', originator: 'codex_cli_rs', cli_version: '0.50.0', source: 'cli', git: { branch: 'main', commit_hash: 'abc' } } },
  { timestamp: at(8), type: 'turn_context', payload: { cwd: '/home/someone/git/demo', model: 'gpt-6-astra', effort: 'low', approval_policy: 'on-request' } },
  // the harness injects its context as a user message; that is noise, not the human
  { timestamp: at(8), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions for /home/someone/git/demo\n\nbe nice' }] } },
  { timestamp: at(8), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>\n  <cwd>/home/someone/git/demo</cwd>\n</environment_context>' }] } },
  { timestamp: at(8, 1), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'list the directory' }] } },
  { timestamp: at(8, 1), type: 'event_msg', payload: { type: 'user_message', message: 'list the directory' } },
  { timestamp: at(8, 1), type: 'response_item', payload: { type: 'reasoning', summary: [{ type: 'summary_text', text: '**Listing**\n\nls it is.' }], content: null, encrypted_content: 'gAAAA' } },
  { timestamp: at(8, 1), type: 'response_item', payload: { type: 'function_call', name: 'shell', arguments: '{"command":["bash","-lc","ls  -la"],"workdir":"/home/someone/git/demo"}', call_id: 'call_1' } },
  { timestamp: at(8, 1), type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_1', output: '{"output":"total 0\\n","metadata":{"exit_code":0,"duration_seconds":0.01}}' } },
  { timestamp: at(8, 2), type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** End Patch', call_id: 'call_2' } },
  { timestamp: at(8, 2), type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'call_2', output: '{"output":"error: no such file","metadata":{"exit_code":1}}' } },
  { timestamp: at(8, 3), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Empty directory.' }] } },
  // the UI feed repeats the assistant turn; it must not render twice
  { timestamp: at(8, 3), type: 'event_msg', payload: { type: 'agent_message', message: 'Empty directory.' } },
  { timestamp: at(8, 3), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 10 } } } },
], { mtimeSec: 1_790_000_000, threadName: 'Listing a directory' });

writeRollout(OLDER, '2026-09-09', [
  { timestamp: '2026-09-09T07:00:00.000Z', type: 'session_meta', payload: { id: OLDER, timestamp: '2026-09-09T07:00:00.000Z', cwd: '/home/someone/git/elsewhere', git: {} } },
  { timestamp: '2026-09-09T07:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello there' }] } },
], { mtimeSec: 1_780_000_000 });

// an older rollout that only carries assistant turns as UI events
writeRollout(LEGACY, '2026-09-08', [
  { timestamp: '2026-09-08T07:00:00.000Z', type: 'session_meta', payload: { id: LEGACY, timestamp: '2026-09-08T07:00:00.000Z', cwd: '/home/someone/git/legacy' } },
  { timestamp: '2026-09-08T07:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] } },
  { timestamp: '2026-09-08T07:00:02.000Z', type: 'event_msg', payload: { type: 'agent_message', message: 'hello from the event feed', phase: 'final_answer' } },
], { mtimeSec: 1_770_000_000 });

const {
  codexRolloutPath, codexToolLine, discoverRecentCodexSessions, parseCodexTranscript, readCodexSessionMeta,
} = await import('../codex-parser.mjs');

test('codexRolloutPath finds a rollout by the id in its file name, and is null otherwise', () => {
  assert.ok(codexRolloutPath(SESSION).endsWith(`-${SESSION}.jsonl`));
  assert.ok(codexRolloutPath(SESSION).includes('/sessions/2026/09/10/'));
  assert.equal(codexRolloutPath('no-such-session'), null);
  assert.equal(codexRolloutPath(''), null);
});

test('readCodexSessionMeta reads the head of the file only', () => {
  const meta = readCodexSessionMeta(codexRolloutPath(SESSION));
  assert.deepEqual(meta, { sessionId: SESSION, cwd: '/home/someone/git/demo', branch: 'main', timestamp: at(8), source: 'cli' });
  assert.equal(readCodexSessionMeta('/definitely/not/here.jsonl'), null);
});

test('parseCodexTranscript maps the response_item stream onto the peek message shape', async () => {
  const parsed = await parseCodexTranscript(SESSION, { includeThinking: true });

  assert.equal(parsed.kind, 'codex');
  assert.equal(parsed.sessionId, SESSION);
  assert.equal(parsed.project, '/home/someone/git/demo');
  assert.equal(parsed.branch, 'main');
  assert.equal(parsed.model, 'gpt-6-astra');
  assert.equal(parsed.date, '2026-09-10');
  assert.equal(parsed.aiTitle, 'Listing a directory');
  assert.deepEqual(parsed.messages.map(m => m.role), ['user', 'assistant', 'assistant', 'result', 'assistant', 'result', 'assistant']);
  // seq is the line index, so it survives as a --since cursor on a growing file
  assert.deepEqual(parsed.messages.map(m => m.seq), [4, 6, 7, 8, 9, 10, 11]);
  assert.equal(parsed.messages.at(-1).text, 'Empty directory.');
});

test('parseCodexTranscript drops the injected context and keeps the human', async () => {
  const parsed = await parseCodexTranscript(SESSION);
  assert.equal(parsed.messages[0].text, 'list the directory');
  assert.equal(parsed.messages.filter(m => m.role === 'user').length, 1);
});

test('parseCodexTranscript decodes tool arguments and outputs', async () => {
  const parsed = await parseCodexTranscript(SESSION);
  const [shell, shellOut, patch, patchOut] = parsed.messages.slice(1, 5);
  assert.deepEqual(shell.tools, [{ name: 'shell', input: { command: ['bash', '-lc', 'ls  -la'], workdir: '/home/someone/git/demo' } }]);
  assert.equal(shellOut.text, 'total 0');
  assert.equal(patch.tools[0].name, 'apply_patch');
  assert.equal(patchOut.text, 'error: no such file\n[exit 1]');
});

test('parseCodexTranscript honours includeResults and includeThinking', async () => {
  const withThinking = await parseCodexTranscript(SESSION, { includeThinking: true });
  assert.match(withThinking.messages[1].thinking, /ls it is/);

  const bare = await parseCodexTranscript(SESSION, { includeResults: false });
  assert.equal(bare.messages.some(m => m.role === 'result'), false);
  assert.equal(bare.messages.some(m => m.thinking), false);
});

test('parseCodexTranscript falls back to agent_message events when no assistant items exist', async () => {
  const parsed = await parseCodexTranscript(LEGACY);
  assert.deepEqual(parsed.messages.map(m => [m.role, m.text]), [['user', 'hi'], ['assistant', 'hello from the event feed']]);
});

test('parseCodexTranscript returns null for an unknown session', async () => {
  assert.equal(await parseCodexTranscript('no-such-session'), null);
});

test('discoverRecentCodexSessions orders by activity, filters by project, reads a title or first prompt', async () => {
  const all = await discoverRecentCodexSessions({ limit: 10 });
  assert.deepEqual(all.map(s => s.sessionId), [SESSION, OLDER, LEGACY]);
  assert.equal(all[0].aiTitle, 'Listing a directory');
  assert.equal(all[1].aiTitle, null);
  assert.equal(all[1].firstPrompt, 'hello there');

  const filtered = await discoverRecentCodexSessions({ projectContains: 'elsewhere', limit: 10 });
  assert.deepEqual(filtered.map(s => s.sessionId), [OLDER]);
  assert.equal((await discoverRecentCodexSessions({ limit: 1 })).length, 1);
});

test('codexToolLine summarises each tool by the argument that identifies it', () => {
  assert.equal(codexToolLine({ name: 'shell', input: { command: ['bash', '-lc', 'ls  -la'] } }), '  → shell: bash -lc ls -la');
  assert.equal(codexToolLine({ name: 'exec_command', input: { cmd: 'git status' } }), '  → exec_command: git status');
  assert.equal(codexToolLine({ name: 'apply_patch', input: { input: '*** Begin Patch\n*** Update File: a.ts\n*** Add File: b.ts\n*** End Patch' } }), '  → apply_patch: a.ts, b.ts');
  assert.equal(codexToolLine({ name: 'update_plan', input: { plan: [{ step: 'read', status: 'completed' }, { step: 'edit', status: 'pending' }] } }), '  → update_plan: read | edit');
  assert.equal(codexToolLine({ name: 'web_search', input: { query: 'codex rollout format' } }), '  → web_search: codex rollout format');
  assert.equal(codexToolLine({ name: 'mystery', input: { raw: 'not json' } }), '  → mystery: not json');
  assert.equal(codexToolLine({ name: 'shell', input: { command: 'abcdef' } }, 3), '  → shell: abc...');
});
