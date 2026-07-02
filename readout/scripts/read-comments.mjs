#!/usr/bin/env node
/**
 * read-comments.mjs — pull readout comments back into an agent session.
 *
 * usage:
 *   node read-comments.mjs [<project>/<slug> | <slug>] [--since <ISO date>] [--json] [--pb-url <url>]
 *
 * resolves the doc id, fetches comments from the PocketBase readout_comments
 * collection, and prints them grouped by anchor. a doc id (or slug) is required;
 * a bare slug resolves its project from the current git toplevel basename
 * (fallback cwd basename), matching the v1 skill convention.
 *
 * zero npm dependencies — Node 22 built-ins only (global fetch).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { execSync } from "node:child_process";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_PB_URL = "https://readout.ssscribe.app";

/** parse argv into { doc, since, json, pbUrl }. */
function parseArgs(argv) {
  const out = { doc: null, since: null, json: false, pbUrl: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--pb-url") out.pbUrl = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else if (!a.startsWith("--") && out.doc === null) out.doc = a;
  }
  return out;
}

/** load config.json next to SKILL.md, with graceful defaults. */
function loadConfig() {
  const defaults = { pbUrl: DEFAULT_PB_URL, root: join(process.env.HOME || "", "git", "readouts") };
  try {
    const raw = readFileSync(join(SKILL_DIR, "config.json"), "utf8");
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

/** current git repo basename, or cwd basename as fallback. */
function currentProject() {
  try {
    const top = execSync("git rev-parse --show-toplevel", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (top) return basename(top);
  } catch {
    /* not a git repo */
  }
  return basename(process.cwd());
}

/** resolve a doc argument to a full "<project>/<slug>" id. */
function resolveDocId(arg) {
  if (!arg) return null;
  const clean = arg.replace(/^\/+/, "").replace(/\.html$/i, "");
  if (clean.includes("/")) return clean;
  return `${currentProject()}/${clean}`;
}

/** short relative time like "3h ago" / "2d ago", falling back to a date. */
function relTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso || "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toISOString().slice(0, 10);
}

/** fetch every comment for a doc (perPage=500 cap; single readout stays under it). */
async function fetchComments(pbUrl, docId, since) {
  let filter = `(doc_id='${docId}')`;
  if (since) filter = `(doc_id='${docId}' && created>='${since}')`;
  const url =
    `${pbUrl.replace(/\/$/, "")}/api/collections/readout_comments/records` +
    `?filter=${encodeURIComponent(filter)}&sort=created&perPage=500`;
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new Error(`network error reaching ${pbUrl}: ${e.message}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
  }
  const json = await res.json();
  return json.items || [];
}

/** group comments by anchor_id, preserving created order within each group. */
function groupByAnchor(items) {
  const groups = {};
  for (const c of items) {
    (groups[c.anchor_id] ||= []).push(c);
  }
  return groups;
}

/** render grouped comments as agent-readable markdown. */
function renderMarkdown(docId, groups, total) {
  const lines = [`# Comments on ${docId}`, "", `${total} comment${total === 1 ? "" : "s"} total.`, ""];
  // order anchors by their most recent activity, newest last
  const anchors = Object.keys(groups).sort((a, b) => {
    const la = groups[a][groups[a].length - 1].created;
    const lb = groups[b][groups[b].length - 1].created;
    return Date.parse(la) - Date.parse(lb);
  });
  for (const anchor of anchors) {
    lines.push(`## ${anchor}`);
    for (const c of groups[anchor]) {
      lines.push(`- **${c.author}** (${relTime(c.created)}): ${c.body}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "usage: read-comments.mjs [<project>/<slug> | <slug>] [--since <ISO date>] [--json] [--pb-url <url>]\n"
    );
    return;
  }
  const cfg = loadConfig();
  const pbUrl = args.pbUrl || cfg.pbUrl || DEFAULT_PB_URL;
  const docId = resolveDocId(args.doc);
  if (!docId) {
    process.stderr.write("error: a doc id or slug is required (e.g. pracino/auth-flow or auth-flow)\n");
    process.exit(2);
  }

  let items;
  try {
    items = await fetchComments(pbUrl, docId, args.since);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }

  const groups = groupByAnchor(items);
  if (args.json) {
    process.stdout.write(JSON.stringify({ docId, total: items.length, groups }, null, 2) + "\n");
    return;
  }
  if (items.length === 0) {
    process.stdout.write(`No comments on ${docId}${args.since ? ` since ${args.since}` : ""}.\n`);
    return;
  }
  process.stdout.write(renderMarkdown(docId, groups, items.length) + "\n");
}

main();
