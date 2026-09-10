import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';

// the parser resolves AGY_HOME once at import, so the fake home has to exist first
const AGY_HOME = mkdtempSync(join(tmpdir(), 'agy-home-'));
process.env.AGY_HOME = AGY_HOME;

const CONV = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';

function writeConversation(id, steps, { title, workspace, mtimeSec } = {}) {
  const logs = join(AGY_HOME, 'brain', id, '.system_generated', 'logs');
  mkdirSync(logs, { recursive: true });
  const transcript = join(logs, 'transcript_full.jsonl');
  writeFileSync(transcript, steps.map(s => JSON.stringify(s)).join('\n') + '\n');
  // discovery ranks by transcript mtime, so the fixtures need distinct ones
  if (mtimeSec) utimesSync(transcript, mtimeSec, mtimeSec);

  if (title) {
    mkdirSync(join(AGY_HOME, 'annotations'), { recursive: true });
    writeFileSync(join(AGY_HOME, 'annotations', `${id}.pbtxt`), `title:"${title}"`);
  }

  if (workspace) {
    // agy stores the workspace inside a protobuf blob; only the URI is read back
    mkdirSync(join(AGY_HOME, 'conversations'), { recursive: true });
    const db = new DatabaseSync(join(AGY_HOME, 'conversations', `${id}.db`));
    db.exec('CREATE TABLE trajectory_metadata_blob (id text, data blob)');
    const payload = Buffer.from(`\x12\x2cfile://${workspace}\x1a\x04main`, 'latin1');
    db.prepare('INSERT INTO trajectory_metadata_blob VALUES (?, ?)').run('main', payload);
    db.close();
  }
}

writeConversation(CONV, [
  {
    step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', status: 'DONE',
    created_at: '2026-09-10T10:06:00Z',
    content: '<USER_REQUEST>\nlist the directory\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: whenever.\n</ADDITIONAL_METADATA>',
  },
  {
    step_index: 1, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE',
    created_at: '2026-09-10T10:06:01Z',
    thinking: '**Planning**\n\nlist it.',
    tool_calls: [{ name: 'run_command', args: { CommandLine: '"ls -la"', Cwd: '"/tmp"', toolAction: '"Listing"' } }],
  },
  {
    step_index: 2, source: 'MODEL', type: 'GENERIC', status: 'RUNNING',
    created_at: '2026-09-10T10:06:02Z',
    content: 'Created At: 2026-09-10T12:06:02+02:00\nCompleted At: 2026-09-10T12:06:03+02:00\nThe command exited with code 0.',
  },
  {
    step_index: 3, source: 'SYSTEM', type: 'SYSTEM_MESSAGE', status: 'DONE',
    created_at: '2026-09-10T10:06:03Z',
    content: 'The following is a <SYSTEM_MESSAGE> not actually sent by the user.\n\n<SYSTEM_MESSAGE>\ntask finished\n</SYSTEM_MESSAGE>',
  },
  {
    step_index: 4, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE',
    created_at: '2026-09-10T10:06:04Z',
    content: 'Done.',
  },
], { title: 'Listing A Directory', workspace: '/home/someone/git/demo', mtimeSec: 1_790_000_000 });

writeConversation(OTHER, [
  { step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', status: 'DONE', created_at: '2026-09-09T08:00:00Z', content: 'hello' },
], { workspace: '/home/someone/git/elsewhere', mtimeSec: 1_780_000_000 });

const { agyTitle, agyToolLine, agyTranscriptPath, agyWorkspace, discoverAgySessions, parseAgySession } =
  await import('../agy-parser.mjs');

test('agyTranscriptPath prefers the untruncated transcript and returns null when absent', () => {
  assert.ok(agyTranscriptPath(CONV).endsWith('transcript_full.jsonl'));
  assert.equal(agyTranscriptPath('no-such-conversation'), null);
});

test('agyTitle reads the annotation, and is null when agy has not named the conversation', () => {
  assert.equal(agyTitle(CONV), 'Listing A Directory');
  assert.equal(agyTitle(OTHER), null);
});

test('agyWorkspace lifts the workspace path out of the metadata blob', () => {
  assert.equal(agyWorkspace(CONV), '/home/someone/git/demo');
  assert.equal(agyWorkspace('no-such-conversation'), null);
});

test('parseAgySession maps steps onto the peek message shape', async () => {
  const parsed = await parseAgySession(CONV, { includeThinking: true });

  assert.equal(parsed.kind, 'agy');
  assert.equal(parsed.sessionId, CONV);
  assert.equal(parsed.project, '/home/someone/git/demo');
  assert.equal(parsed.aiTitle, 'Listing A Directory');
  assert.equal(parsed.date, '2026-09-10');
  assert.deepEqual(parsed.messages.map(m => m.role), ['user', 'assistant', 'result', 'system', 'assistant']);
  // step_index doubles as the --since cursor, so it must survive parsing
  assert.deepEqual(parsed.messages.map(m => m.seq), [0, 1, 2, 3, 4]);
});

test('parseAgySession unwraps the user request and drops the metadata envelope', async () => {
  const parsed = await parseAgySession(CONV);
  assert.equal(parsed.messages[0].text, 'list the directory');
});

test('parseAgySession decodes the JSON-encoded tool arguments', async () => {
  const parsed = await parseAgySession(CONV);
  assert.deepEqual(parsed.messages[1].tools, [
    { name: 'run_command', input: { CommandLine: 'ls -la', Cwd: '/tmp', toolAction: 'Listing' } },
  ]);
});

test('parseAgySession strips result and system boilerplate but keeps the payload', async () => {
  const parsed = await parseAgySession(CONV);
  assert.equal(parsed.messages[2].text, 'The command exited with code 0.');
  assert.equal(parsed.messages[2].status, 'RUNNING');
  assert.equal(parsed.messages[3].text, 'task finished');
});

test('parseAgySession honours includeResults and includeThinking', async () => {
  const withResults = await parseAgySession(CONV, { includeThinking: true });
  assert.match(withResults.messages[1].thinking, /list it/);

  const without = await parseAgySession(CONV, { includeResults: false });
  assert.equal(without.messages.some(m => m.role === 'result'), false);
  assert.equal(without.messages[1].thinking, undefined);
});

test('parseAgySession returns null for a conversation with no transcript', async () => {
  assert.equal(await parseAgySession('no-such-conversation'), null);
});

test('discoverAgySessions orders by activity and filters by project', () => {
  const all = discoverAgySessions({ limit: 10 });
  assert.deepEqual(all.map(s => s.sessionId), [CONV, OTHER]);

  const filtered = discoverAgySessions({ projectContains: 'elsewhere', limit: 10 });
  assert.deepEqual(filtered.map(s => s.sessionId), [OTHER]);

  assert.equal(discoverAgySessions({ limit: 1 }).length, 1);
});

test('agyToolLine summarises each tool by the argument that identifies it', () => {
  assert.equal(agyToolLine({ name: 'run_command', input: { CommandLine: 'ls  -la' } }), '  → run_command: ls -la');
  assert.equal(agyToolLine({ name: 'view_file', input: { AbsolutePath: '/a.ts', StartLine: 1, EndLine: 9 } }), '  → view_file: /a.ts (1-9)');
  assert.equal(agyToolLine({ name: 'search_web', input: { query: 'gemini' } }), '  → search_web: gemini');
  assert.equal(agyToolLine({ name: 'mystery_tool', input: { toolAction: 'Doing a thing' } }), '  → mystery_tool: Doing a thing');
  assert.equal(agyToolLine({ name: 'run_command', input: { CommandLine: 'abcdef' } }, 3), '  → run_command: abc...');
});
