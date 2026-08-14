#!/usr/bin/env node

/**
 * shared subagent handling for the /morning (and /evening) gather scripts.
 *
 * on an orchestrated session the parent transcript only holds the dispatch and
 * the final summary — the implementation lives in the subagent transcripts. a
 * briefing built from parents alone reports yesterday with the middle missing.
 */

import { parseSessionFile } from '../../shared/cc-parser.mjs';

// blocks rendered per session; one orchestration run can spawn dozens
export const MAX_SUBAGENTS_PER_SESSION = 8;

/** best human label for a subagent record. */
export function subagentLabel(sub) {
  return sub.description || sub.name || sub.agentType || sub.agentId;
}

/**
 * parses the subagent transcripts owned by a session.
 *
 * @param {object} session   discovery record, carrying `subagents`
 * @param {object} [opts]
 * @param {number} [opts.maxLength] per-message truncation, same as the parent's
 * @returns {Promise<{entries: {label: string, model: ?string, parsed: object}[], omitted: number}>}
 */
export async function collectSubagentParses(session, opts = {}) {
  const subagents = session.subagents || [];
  const entries = [];

  for (const sub of subagents.slice(0, MAX_SUBAGENTS_PER_SESSION)) {
    let parsed;
    try {
      parsed = await parseSessionFile(sub.filePath, { maxLength: opts.maxLength });
    } catch {
      continue;
    }
    if (!parsed.messages.length) continue;
    entries.push({ label: subagentLabel(sub), model: sub.model || parsed.model, parsed });
  }

  return { entries, omitted: Math.max(0, subagents.length - MAX_SUBAGENTS_PER_SESSION) };
}
