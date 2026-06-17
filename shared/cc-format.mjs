#!/usr/bin/env node

/**
 * formatters that render structured session data into output formats.
 * the parser produces data; these turn it into a human digest or machine JSONL.
 */

const DEFAULT_MAX_USER_MESSAGES = 20;
const DEFAULT_MAX_ASSISTANT_MESSAGES = 12;

/** {toolName: count} across a parsed session's messages. */
export function toolCountsFrom(parsed) {
  const counts = {};
  for (const msg of parsed.messages || []) {
    for (const tool of msg.tools || []) counts[tool.name] = (counts[tool.name] || 0) + 1;
  }
  return counts;
}

/**
 * merges discovery metadata with a parsed session into a digest view consumed
 * by toMarkdown. shared by scan / morning so the digest shape stays consistent.
 */
export function toSessionView(discovered, parsed) {
  return {
    sessionId: parsed.sessionId,
    title: parsed.aiTitle || discovered?.summary || discovered?.firstPrompt || parsed.sessionId,
    date: discovered?.date || parsed.date,
    project: discovered?.project || parsed.project,
    branch: parsed.branch,
    model: parsed.model,
    userMessages: parsed.userMessages,
    assistantTexts: parsed.assistantTexts,
    toolCounts: toolCountsFrom(parsed),
  };
}

/** renders a "- item" list with a "...and N more" tail when capped. */
function renderList(items, cap) {
  const lines = [];
  const shown = cap == null ? items : items.slice(0, cap);
  for (const item of shown) lines.push(`- ${item}`);
  if (cap != null && items.length > cap) {
    lines.push(`- *...and ${items.length - cap} more*`);
  }
  return lines;
}

/** compact "Read×3, Bash×2" summary from a {toolName: count} map. */
function renderToolCounts(toolCounts) {
  const entries = Object.entries(toolCounts || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  return entries.map(([name, count]) => `${name}×${count}`).join(', ');
}

/** formats one session block. */
function formatSession(session, opts) {
  const {
    maxUserMessages = DEFAULT_MAX_USER_MESSAGES,
    maxAssistantMessages = DEFAULT_MAX_ASSISTANT_MESSAGES,
  } = opts;

  const lines = [];
  const title = session.title || session.aiTitle || session.firstPrompt || session.sessionId || 'session';
  lines.push(`### ${title}`, '');

  const meta = [];
  if (session.date) meta.push(`**Date:** ${session.date}`);
  if (session.project) meta.push(`**Project:** ${session.project}`);
  if (session.branch) meta.push(`**Branch:** ${session.branch}`);
  if (session.model) meta.push(`**Model:** ${session.model}`);
  if (meta.length) lines.push(meta.join(' | '), '');

  const tools = renderToolCounts(session.toolCounts);
  if (tools) lines.push(`**Tools:** ${tools}`, '');

  if (session.userMessages?.length) {
    lines.push('**User said:**', ...renderList(session.userMessages, maxUserMessages), '');
  }
  if (session.assistantTexts?.length) {
    lines.push('**Assistant did:**', ...renderList(session.assistantTexts, maxAssistantMessages), '');
  }

  return lines.join('\n');
}

/**
 * renders an array of session views as a markdown digest.
 * @param {object[]} sessions  merged discovery + parsed records
 * @param {object} [opts]  { header, scope, maxUserMessages, maxAssistantMessages }
 */
export function toMarkdown(sessions, opts = {}) {
  const lines = [];
  if (opts.header) lines.push(opts.header, '');
  lines.push(`## Claude Code Sessions (${sessions.length})`, '');
  if (!sessions.length) {
    lines.push('*No sessions found for this range/scope.*');
    return lines.join('\n');
  }
  for (const session of sessions) {
    lines.push(formatSession(session, opts));
    lines.push('---', '');
  }
  return lines.join('\n');
}

/** renders sessions as JSONL — one JSON record per line for machine consumption. */
export function toJsonl(sessions) {
  return sessions.map(session => JSON.stringify(session)).join('\n');
}
