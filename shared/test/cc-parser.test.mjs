import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractMessageText, isNoise, parseSessionFile, projectMatches, truncateText } from '../cc-parser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASIC = join(HERE, 'fixtures', 'session-basic.jsonl');

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
