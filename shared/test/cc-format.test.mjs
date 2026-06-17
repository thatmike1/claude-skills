import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown, toJsonl, toolCountsFrom, toSessionView } from '../cc-format.mjs';

const SESSIONS = [
  {
    sessionId: 's1',
    title: 'Demo session',
    date: '2026-06-01',
    project: 'demo',
    branch: 'main',
    model: 'claude-opus-4-8',
    userMessages: ['u1', 'u2', 'u3', 'u4', 'u5'],
    assistantTexts: ['a1', 'a2'],
    toolCounts: { Bash: 3, Read: 1 },
  },
];

test('toMarkdown renders meta, tools, and message sections', () => {
  const md = toMarkdown(SESSIONS, {});
  assert.ok(md.includes('### Demo session'));
  assert.ok(md.includes('**Date:** 2026-06-01'));
  assert.ok(md.includes('**Model:** claude-opus-4-8'));
  assert.ok(md.includes('**Tools:** Bash×3, Read×1'));
  assert.ok(md.includes('- u1'));
});

test('toMarkdown caps lists and shows the remainder count', () => {
  const md = toMarkdown(SESSIONS, { maxUserMessages: 2 });
  assert.ok(md.includes('- u1'));
  assert.ok(md.includes('- u2'));
  assert.ok(!md.includes('- u3'));
  assert.ok(md.includes('*...and 3 more*'));
});

test('toMarkdown handles the empty case', () => {
  assert.ok(toMarkdown([], {}).includes('No sessions found'));
});

test('toolCountsFrom counts tool_use across messages', () => {
  const parsed = {
    messages: [
      { role: 'assistant', tools: [{ name: 'Bash' }, { name: 'Read' }] },
      { role: 'assistant', tools: [{ name: 'Bash' }] },
      { role: 'user' },
    ],
  };
  assert.deepEqual(toolCountsFrom(parsed), { Bash: 2, Read: 1 });
});

test('toSessionView merges discovery metadata with parsed signal', () => {
  const discovered = { summary: '', firstPrompt: 'fp', date: '2026-06-01', project: 'demo' };
  const parsed = {
    sessionId: 's1', aiTitle: 'Title', branch: 'main', model: 'claude-opus-4-8',
    project: null, date: null, userMessages: ['u'], assistantTexts: ['a'],
    messages: [{ role: 'assistant', tools: [{ name: 'Edit' }] }],
  };
  const view = toSessionView(discovered, parsed);
  assert.equal(view.title, 'Title');       // aiTitle wins
  assert.equal(view.date, '2026-06-01');    // from discovery
  assert.equal(view.project, 'demo');
  assert.equal(view.model, 'claude-opus-4-8');
  assert.deepEqual(view.toolCounts, { Edit: 1 });
});

test('toJsonl emits one valid JSON record per line', () => {
  const out = toJsonl([{ a: 1 }, { b: 2 }]);
  const lines = out.split('\n');
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), { a: 1 });
  assert.deepEqual(JSON.parse(lines[1]), { b: 2 });
});
