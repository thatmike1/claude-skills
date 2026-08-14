#!/usr/bin/env node

/**
 * extracts clean evidence from indexed Claude Code sessions and Codex history.
 */

import { readFileSync } from 'fs';
import { discoverSessions, parseSessionFile } from '../../shared/cc-parser.mjs';
import { toolCountsFrom } from '../../shared/cc-format.mjs';
import { discoverCodexSessions } from '../../shared/codex-parser.mjs';

const DEFAULT_CODEX_DAYS = 365;
// subagent transcripts mined per session, and how much of each is kept. the
// parent is captured whole, but one orchestration run can spawn dozens of
// agents — uncapped, the delegated half would dwarf the report
const MAX_SUBAGENTS_PER_SESSION = 8;
const SUBAGENT_MSG_CAPS = { maxLength: 2000, maxUserMessages: 3, maxAssistantMessages: 8 };

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

/**
 * mines a session's subagent transcripts.
 *
 * on orchestrated sessions this is where the implementation work actually
 * happened — the parent only dispatched and summarised, so tool usage and
 * sophistication signal read far too low without it.
 *
 * @param {object} session discovery record, carrying `subagents`
 * @returns {Promise<object[]>} per-subagent evidence
 */
async function extractSubagentEvidence(session) {
  const subagents = session.subagents || [];
  const evidence = [];

  for (const sub of subagents.slice(0, MAX_SUBAGENTS_PER_SESSION)) {
    let parsed;
    try {
      parsed = await parseSessionFile(sub.filePath, SUBAGENT_MSG_CAPS);
    } catch {
      continue;
    }
    if (!parsed.messages.length) continue;
    evidence.push({
      agentId: sub.agentId,
      name: sub.name,
      description: sub.description,
      agentType: sub.agentType,
      model: sub.model || parsed.model,
      messageCount: parsed.messages.length,
      toolCounts: toolCountsFrom(parsed),
      assistantTexts: parsed.assistantTexts,
    });
  }

  return evidence;
}

/** converts a Claude Code index entry to clean evidence. */
async function extractClaudeEvidence(session) {
  if (!session.filePath) return null;
  try {
    const parsed = await parseSessionFile(session.filePath);
    const toolCounts = toolCountsFrom(parsed);
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
      model: parsed.model,
      // scope + sophistication signal: high counts = big session; Skill/Agent/mcp__* = advanced usage
      messageCount: parsed.messages.length,
      toolCounts,
      userMessages: parsed.userMessages,
      assistantTexts: parsed.assistantTexts,
      subagents: await extractSubagentEvidence(session),
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
