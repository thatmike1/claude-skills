#!/usr/bin/env node
// stand-in for the real ccbrowse CLI: prints one canned session plus one whose
// title echoes the argv, so tests can assert both mapping and argument passing.

const argv = process.argv.slice(2);
const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'content';

process.stderr.write('index is stale: 3 of 5490 logs changed since it was built\n');

const canned = {
  session_id: '550bef00-dcdd-46b4-b7f2-aaa6f6acb805',
  project: '/home/u/git/alpha',
  branch: 'main',
  title: mode === 'semantic' ? 'Semantic hit' : 'Keyword hit',
  first_prompt: 'hey can you look at the index',
  created: '2026-08-14T09:18:19.871Z',
  modified: '2026-08-14T14:26:50.990Z',
  day: '2026-08-14',
  n_user: 12,
  n_assistant: 20,
  snip: 'the `MATERIALIZED` CTE is required',
  n_hits: 3,
  via_subagent: mode === 'semantic' ? 0 : 1,
  titled: true,
};

const echo = { ...canned, session_id: 'echo-session', title: argv.join(' '), n_hits: 0, via_subagent: 0 };

process.stdout.write(JSON.stringify({ total: 2, mode, sessions: [canned, echo] }));
