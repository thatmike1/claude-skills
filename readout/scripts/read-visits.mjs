#!/usr/bin/env node
/**
 * read-visits.mjs — who viewed a readout, and when.
 *
 * usage:
 *   node read-visits.mjs [<project>/<slug> | <slug>] [flags]
 *
 * flags:
 *   --since <ISO>       only visits on/after this date
 *   --days <n>          shorthand for --since (n days back from now)
 *   --bots              include bot/crawler user-agents (hidden by default)
 *   --json              raw JSON output
 *   --pb-url <url>      override the PocketBase base URL
 *
 * with a doc argument prints that doc's visit log (per-viewer summary + recent
 * visits); without one prints a summary across all docs. reads the superuser-
 * only readout_visits collection, so pbToken in config.json is required. a
 * bare slug resolves its project from the current git toplevel basename.
 *
 * zero npm dependencies — Node 22 built-ins only (global fetch).
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename } from "node:path";
import { execSync } from "node:child_process";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_PB_URL = "https://readout.ssscribe.app";
const BOT_UA = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit/i;

/** parse argv into an options object. */
function parseArgs(argv) {
  const out = { doc: null, since: null, json: false, bots: false, pbUrl: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--bots") out.bots = true;
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--days") {
      const n = Number(argv[++i]);
      if (!Number.isNaN(n)) out.since = new Date(Date.now() - n * 86400000).toISOString();
    } else if (a === "--pb-url") out.pbUrl = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else if (!a.startsWith("--") && out.doc === null) out.doc = a;
  }
  return out;
}

/** load config.json next to SKILL.md, with graceful defaults. */
function loadConfig() {
  const defaults = { pbUrl: DEFAULT_PB_URL };
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

/** fetch all visit rows matching the filter, following pagination. */
async function fetchVisits(pbUrl, token, docId, since) {
  const parts = [];
  if (docId) parts.push(`doc_id='${docId}'`);
  if (since) parts.push(`created>='${since}'`);
  const filter = parts.length ? `(${parts.join(" && ")})` : "";
  const base =
    `${pbUrl.replace(/\/$/, "")}/api/collections/readout_visits/records` +
    `?sort=created&perPage=500${filter ? `&filter=${encodeURIComponent(filter)}` : ""}`;
  const items = [];
  for (let page = 1; ; page++) {
    let res;
    try {
      res = await fetch(`${base}&page=${page}`, {
        headers: { Accept: "application/json", Authorization: token },
      });
    } catch (e) {
      throw new Error(`network error reaching ${pbUrl}: ${e.message}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} from readout_visits`);
    const json = await res.json();
    items.push(...(json.items || []));
    if (page >= (json.totalPages || 1)) break;
  }
  return items;
}

/** aggregate visits into per-viewer {count, first, last} stats. */
function byViewer(items) {
  const stats = {};
  for (const v of items) {
    const s = (stats[v.viewer] ||= { count: 0, first: v.created, last: v.created });
    s.count++;
    if (v.created < s.first) s.first = v.created;
    if (v.created > s.last) s.last = v.created;
  }
  return stats;
}

/** render one doc's visit log: per-viewer summary + recent visits. */
function renderDoc(docId, items, botCount) {
  const viewers = byViewer(items);
  const names = Object.keys(viewers).sort((a, b) => viewers[b].last.localeCompare(viewers[a].last));
  const lines = [
    `# Visits — ${docId}`,
    "",
    `${items.length} visit${items.length === 1 ? "" : "s"} by ${names.length} viewer${names.length === 1 ? "" : "s"}.` +
      (botCount ? ` (${botCount} bot hit${botCount === 1 ? "" : "s"} hidden; --bots to include)` : ""),
    "",
  ];
  for (const n of names) {
    const s = viewers[n];
    lines.push(`- **${n}** — ${s.count} visit${s.count === 1 ? "" : "s"}, last ${relTime(s.last)}, first ${relTime(s.first)}`);
  }
  const recent = items.slice(-15).reverse();
  lines.push("", "## Recent");
  for (const v of recent) {
    const ref = v.referrer ? ` (from ${v.referrer})` : "";
    lines.push(`- ${v.viewer} — ${relTime(v.created)}${ref}`);
  }
  return lines.join("\n");
}

/** render the all-docs summary table. */
function renderAll(items, botCount) {
  const docs = {};
  for (const v of items) (docs[v.doc_id] ||= []).push(v);
  const ids = Object.keys(docs).sort(
    (a, b) => docs[b][docs[b].length - 1].created.localeCompare(docs[a][docs[a].length - 1].created)
  );
  const lines = [
    `# Readout visits — all docs`,
    "",
    `${items.length} visit${items.length === 1 ? "" : "s"} across ${ids.length} doc${ids.length === 1 ? "" : "s"}.` +
      (botCount ? ` (${botCount} bot hit${botCount === 1 ? "" : "s"} hidden; --bots to include)` : ""),
    "",
  ];
  for (const id of ids) {
    const list = docs[id];
    const viewers = Object.keys(byViewer(list));
    const named = viewers.filter((n) => n !== "anonymous");
    const who = named.length ? named.join(", ") + (viewers.includes("anonymous") ? ", anonymous" : "") : "anonymous only";
    lines.push(`- **${id}** — ${list.length} visit${list.length === 1 ? "" : "s"}, last ${relTime(list[list.length - 1].created)} (${who})`);
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "usage: read-visits.mjs [<project>/<slug> | <slug>] [--since <ISO>] [--days <n>] [--bots] [--json] [--pb-url <url>]\n"
    );
    return;
  }
  const cfg = loadConfig();
  const pbUrl = args.pbUrl || cfg.pbUrl || DEFAULT_PB_URL;
  if (!cfg.pbToken) {
    process.stderr.write("error: readout_visits is superuser-only; pbToken in config.json is required\n");
    process.exit(2);
  }

  const docId = resolveDocId(args.doc);
  let items;
  try {
    items = await fetchVisits(pbUrl, cfg.pbToken, docId, args.since);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }

  let botCount = 0;
  if (!args.bots) {
    const kept = items.filter((v) => !BOT_UA.test(v.ua || ""));
    botCount = items.length - kept.length;
    items = kept;
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ docId, total: items.length, botsHidden: botCount, items }, null, 2) + "\n");
    return;
  }
  if (items.length === 0) {
    process.stdout.write(
      `No visits${docId ? ` on ${docId}` : ""}${args.since ? ` since ${args.since}` : ""}.` +
        (botCount ? ` (${botCount} bot hit${botCount === 1 ? "" : "s"} hidden)` : "") +
        "\n"
    );
    return;
  }
  process.stdout.write((docId ? renderDoc(docId, items, botCount) : renderAll(items, botCount)) + "\n");
}

// resolve argv[1] through symlinks so a symlinked skill dir (.claude/skills -> git/claude-skills)
// still matches import.meta.url, which node canonicalizes to the real path — otherwise main() never runs.
let isCli = false;
try {
  isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
} catch {
  /* argv[1] unreadable — treat as not directly invoked */
}
if (isCli) main();
