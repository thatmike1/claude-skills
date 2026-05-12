#!/usr/bin/env node

/**
 * builds a lightweight index of all Claude Code conversations.
 */

import { discoverSessions } from '../../shared/cc-parser.mjs';

async function main() {
  const sessions = await discoverSessions();
  console.log(JSON.stringify(sessions, null, 2));

  const projects = new Map();
  for (const session of sessions) {
    projects.set(session.project, (projects.get(session.project) || 0) + 1);
  }

  console.error(`\n--- ${sessions.length} sessions across ${projects.size} projects ---`);
  for (const [project, count] of [...projects.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.error(`${String(count).padStart(6)}  ${project}`);
  }
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
