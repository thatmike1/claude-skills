#!/usr/bin/env node

/**
 * extracts clean evidence from indexed Claude Code sessions and Codex history.
 */

import { readFileSync } from 'fs';
import { discoverSessions, parseSessionFile } from '../../shared/cc-parser.mjs';
import { discoverCodexSessions } from '../../shared/codex-parser.mjs';

const DEFAULT_CODEX_DAYS = 365;

/** reads all stdin as a UTF-8 string. */
function readStdin() {
  return readFileSync(0, 'utf-8');
}

/** returns an ISO date string days before today. */
function daysAgoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** converts a Claude Code index entry to clean evidence. */
async function extractClaudeEvidence(session) {
  if (!session.filePath) return null;
  try {
    const parsed = await parseSessionFile(session.filePath);
    return {
      source: 'claude-code',
      sessionId: session.sessionId,
      project: session.project,
      summary: session.summary || parsed.aiTitle || '',
      firstPrompt: session.firstPrompt || '',
      timestamp: session.timestamp || null,
      filePath: session.filePath,
      aiTitle: parsed.aiTitle,
      branch: parsed.branch,
      userMessages: parsed.userMessages,
      assistantTexts: parsed.assistantTexts,
    };
  } catch {
    return null;
  }
}

/** converts a Codex parsed session to clean evidence. */
function extractCodexEvidence(session) {
  return {
    source: 'codex',
    sessionId: session.sessionId,
    project: session.cwd,
    summary: session.threadName || '',
    firstPrompt: session.userMessages[0] || '',
    timestamp: null,
    filePath: session.filePath,
    branch: session.branch,
    userMessages: session.userMessages,
    assistantTexts: session.agentMessages.map(message => message.text),
    rolloutSummary: session.rolloutSummary,
  };
}

async function main() {
  const input = readStdin().trim();
  const indexedSessions = input ? JSON.parse(input) : await discoverSessions();
  const claudeSessions = [];

  for (const session of indexedSessions) {
    const evidence = await extractClaudeEvidence(session);
    if (evidence) claudeSessions.push(evidence);
  }

  const from = daysAgoDate(DEFAULT_CODEX_DAYS);
  const to = new Date().toISOString().slice(0, 10);
  const codexSessions = await discoverCodexSessions(from, to);

  const report = {
    generatedAt: new Date().toISOString(),
    claudeCode: claudeSessions,
    codex: codexSessions.map(extractCodexEvidence),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error('error:', err.message);
  process.exit(1);
});
