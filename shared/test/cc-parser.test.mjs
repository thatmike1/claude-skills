import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildIndex,
  discoverSessions,
  discoverSessionsFromDisk,
  discoverSessionsFromIndex,
  extractMessageText,
  isNoise,
  parseSessionFile,
  projectMatches,
  truncateText,
} from '../cc-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASIC = join(HERE, 'fixtures', 'session-basic.jsonl');
const PROJECTS = join(HERE, 'fixtures', 'projects');

test('extractMessageText handles string, array-with-text, and array-without-text', () => {
  assert.equal(extractMessageText('plain'), 'plain');
  assert.equal(extractMessageText([{ type: 'text', text: 'hi' }]), 'hi');
  assert.equal(extractMessageText([{ type: 'tool_result', content: 'x' }]), '');
  assert.equal(extractMessageText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'a\nb');
  assert.equal(extractMessageText(null), '');
});

test('truncateText respects maxLength and Infinity', () => {
  assert.equal(truncateText('abcdef', 3), 'abc...');
  assert.equal(truncateText('abcdef', Infinity), 'abcdef');
  assert.equal(truncateText('abc', 10), 'abc');
});

test('isNoise flags command tags and empties', () => {
  assert.equal(isNoise('<command-name>scan</command-name>'), true);
  assert.equal(isNoise(''), true);
  assert.equal(isNoise('real message'), false);
});

test('REGRESSION: array-content user message is captured, not dropped', async () => {
  const parsed = await parseSessionFile(BASIC);
  assert.ok(
    parsed.userMessages.some(m => m.includes('REQUIREMENTS: must support dark mode')),
    'array-content user message must appear in userMessages',
  );
  assert.ok(
    parsed.messages.some(m => m.role === 'user' && m.text.includes('REQUIREMENTS')),
    'array-content user message must appear in structured messages',
  );
});

test('tool_result-only and noise user records are skipped', async () => {
  const parsed = await parseSessionFile(BASIC);
  // only 2 real user messages: the plain string and the array-content one
  assert.equal(parsed.userMessages.length, 2);
  assert.equal(parsed.userMessages[0], 'first plain message hello');
  assert.ok(!parsed.userMessages.some(m => m.includes('command-name')));
  assert.ok(!parsed.userMessages.some(m => m.includes('ok done')));
});

test('assistant text, tools, model, branch, and aiTitle are extracted', async () => {
  const parsed = await parseSessionFile(BASIC);
  assert.equal(parsed.branch, 'main');
  assert.equal(parsed.model, 'claude-opus-4-8');
  assert.equal(parsed.aiTitle, 'Migration and requirements chat');
  assert.equal(parsed.date, '2026-06-01');

  // 2 assistant text bodies (the tool-only assistant has no text)
  assert.equal(parsed.assistantTexts.length, 2);

  const bashMsg = parsed.messages.find(m => m.role === 'assistant' && m.tools?.some(t => t.name === 'Bash'));
  assert.ok(bashMsg, 'assistant Bash tool_use captured');
  assert.equal(bashMsg.tools.find(t => t.name === 'Bash').input.command, 'npm run migrate');

  // tool-only assistant message exists in messages but contributes no text
  assert.ok(parsed.messages.some(m => m.role === 'assistant' && !m.text && m.tools?.some(t => t.name === 'Read')));
});

test('per-message timestamp is attached', async () => {
  const parsed = await parseSessionFile(BASIC);
  assert.equal(parsed.messages[0].ts, '2026-06-01T10:00:00.000Z');
});

test('thinking is off by default, captured with includeThinking', async () => {
  const off = await parseSessionFile(BASIC);
  assert.ok(!off.messages.some(m => m.thinking));

  const on = await parseSessionFile(BASIC, { includeThinking: true });
  assert.ok(on.messages.some(m => m.thinking?.includes('secret plan')));
});

test('maxLength option truncates message bodies', async () => {
  const parsed = await parseSessionFile(BASIC, { maxLength: 10 });
  // "first plain message hello" -> "first plai" + "..."
  assert.equal(parsed.userMessages[0], 'first plai...');
  assert.equal(parsed.userMessages[0].length, 13); // 10 chars + '...'
});

test('maxUserMessages cap keeps the first N user messages', async () => {
  const parsed = await parseSessionFile(BASIC, { maxUserMessages: 1 });
  assert.equal(parsed.userMessages.length, 1);
  assert.equal(parsed.userMessages[0], 'first plain message hello');
});

test('legacy flat fields match the structured messages', async () => {
  const parsed = await parseSessionFile(BASIC);
  const fromMessages = parsed.messages.filter(m => m.role === 'user').map(m => m.text);
  assert.deepEqual(parsed.userMessages, fromMessages);
});

test('projectMatches handles indexed (absolute) and fallback (decoded) projects', () => {
  // indexed project carries an absolute path
  assert.ok(projectMatches({ project: '/home/u/git/foo', projectDir: '-home-u-git-foo' }, '/home/u/git/foo'));
  // project without a sessions-index.json carries the slash-form name — match via encoded dir
  assert.ok(projectMatches({ project: 'foo', projectDir: '-home-u-git-foo' }, '/home/u/git/foo'));
  assert.ok(!projectMatches({ project: 'bar', projectDir: '-home-u-git-bar' }, '/home/u/git/foo'));
  // no filter matches everything
  assert.ok(projectMatches({ project: 'anything' }, null));
});

test('REGRESSION: a stale sessions-index.json does not shadow the directory listing', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  const ids = sessions.map(s => s.sessionId).sort();
  assert.deepEqual(ids, ['sess-one', 'sess-three', 'sess-two', 'tiny-with-subs']);
});

test('enumeration skips top-level agent-*.jsonl and files under 100 bytes', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  assert.ok(!sessions.some(s => s.sessionId === 'agent-foo'));
  assert.ok(!sessions.some(s => s.sessionId === 'tiny'));
});

test('enumerated sessions carry timestamp and firstPrompt read from the JSONL', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  const two = sessions.find(s => s.sessionId === 'sess-two');
  assert.equal(two.timestamp, '2026-06-02T11:00:00.000Z');
  assert.equal(two.date, '2026-06-02');
  assert.equal(two.firstPrompt, 'session two asks about the cache eviction policy');
  assert.equal(two.projectDir, '-home-u-git-alpha');
});

test('discoverSessionsFromIndex stays exported as a deprecated alias', () => {
  assert.equal(discoverSessionsFromIndex, discoverSessionsFromDisk);
});

test('subagent transcripts are attached with sidecar metadata', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  const one = sessions.find(s => s.sessionId === 'sess-one');
  // 2 flat + 1 from workflows/wf_test
  assert.equal(one.subagents.length, 3);

  const withMeta = one.subagents.find(a => a.agentId === 'sess-one~agent-aaa');
  assert.ok(withMeta, 'agentId derived from the file path, not the record sessionId');
  assert.equal(withMeta.name, 'agent-aaa');
  assert.equal(withMeta.description, 'Find widget layout code');
  assert.equal(withMeta.agentType, 'Explore');
  assert.equal(withMeta.model, 'claude-haiku-4-5');
  assert.equal(withMeta.spawnDepth, 1);
  assert.equal(withMeta.filePath, join(PROJECTS, '-home-u-git-alpha', 'sess-one', 'subagents', 'agent-aaa.jsonl'));

  const noMeta = one.subagents.find(a => a.agentId === 'sess-one~agent-bbb');
  assert.equal(noMeta.name, 'agent-bbb');
  assert.equal(noMeta.description, '');
  assert.equal(noMeta.agentType, null);
  assert.equal(noMeta.model, null);
  assert.equal(noMeta.spawnDepth, null);

  // flat-layout subagents carry no workflow
  assert.equal(withMeta.workflowId, null);
  assert.equal(noMeta.workflowId, null);
});

test('workflow agent transcripts are attached, journal.jsonl is not', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  const one = sessions.find(s => s.sessionId === 'sess-one');

  assert.ok(!one.subagents.some(a => a.name === 'journal'), 'journal.jsonl is not an agent transcript');

  const wf = one.subagents.find(a => a.workflowId === 'wf_test');
  assert.ok(wf, 'workflow subagent attached');
  assert.equal(wf.agentId, 'sess-one~wf_test~agent-ccc');
  assert.equal(wf.name, 'agent-ccc');
  assert.equal(wf.description, 'Layout audit step');
  assert.equal(wf.agentType, 'workflow-step');
  assert.equal(
    wf.filePath,
    join(PROJECTS, '-home-u-git-alpha', 'sess-one', 'subagents', 'workflows', 'wf_test', 'agent-ccc.jsonl'),
  );
});

test('a sub-100-byte session is kept when it owns subagent transcripts', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  const tiny = sessions.find(s => s.sessionId === 'tiny-with-subs');
  assert.ok(tiny, 'session under the size floor is recovered because it spawned subagents');
  assert.equal(tiny.subagents.length, 1);
  assert.equal(tiny.subagents[0].agentId, 'tiny-with-subs~agent-ddd');
  // no timestamp record in the file — falls back to mtime rather than going null
  assert.ok(tiny.timestamp);
});

test('sessions without a subagents dir get an empty array', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  for (const id of ['sess-two', 'sess-three']) {
    assert.deepEqual(sessions.find(s => s.sessionId === id).subagents, []);
  }
});

test('an attached subagent transcript parses like any session file', async () => {
  const sessions = await discoverSessionsFromDisk({ projectsDir: PROJECTS });
  const one = sessions.find(s => s.sessionId === 'sess-one');
  const parsed = await parseSessionFile(one.subagents[0].filePath);
  assert.equal(parsed.userMessages[0], 'find where the widget layout is computed');
});

test('projectsDir threads through discoverSessions and buildIndex', async () => {
  const sessions = await discoverSessions({ projectsDir: PROJECTS });
  assert.equal(sessions.length, 4);

  const index = await buildIndex({ projectsDir: PROJECTS });
  assert.equal(index.length, 4);
  assert.equal(index.find(e => e.sessionId === 'sess-three').title, 'session three asks about the retry backoff schedule');
});
