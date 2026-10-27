#!/usr/bin/env node
/**
 * read-comments.mjs — pull readout comments back into an agent session.
 *
 * usage:
 *   node read-comments.mjs [<project>/<slug> | <slug>] [flags]
 *
 * flags:
 *   --since <ISO>       only comments created on/after this date
 *   --new               only comments not yet consumed (seen) by the agent
 *   --all               include resolved comments (default hides them)
 *   --consume           mark the listed comments as consumed (needs pbToken)
 *   --resolve <ids>     mark comma-separated comment ids resolved (needs pbToken;
 *                       no doc argument required)
 *   --password <pw>     decrypt comments on a protected readout (or READOUT_PASSWORD)
 *   --json              raw JSON output
 *   --pb-url <url>      override the PocketBase base URL
 *
 * resolves the doc id, fetches comments from the PocketBase readout_comments
 * collection, and prints them grouped by anchor with reply threading. a doc id
 * (or slug) is required unless --resolve is used; a bare slug resolves its
 * project from the current git toplevel basename (fallback cwd basename).
 *
 * workflow states (superuser-only updates, written with config.pbToken):
 *   consumed — the agent has seen the comment (read-comments --consume)
 *   resolved — the agent addressed it (read-comments --resolve <ids>)
 *
 * zero npm dependencies — Node 22 built-ins only (global fetch).
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename } from "node:path";
import { execSync } from "node:child_process";
import { deriveCommentKeys, decryptComment, isCommentEnvelope } from "./protect.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_PB_URL = "https://readout.ssscribe.app";

/** parse argv into an options object. */
function parseArgs(argv) {
  const out = {
    doc: null,
    since: null,
    json: false,
    all: false,
    newOnly: false,
    consume: false,
    resolve: null,
    pbUrl: null,
    password: process.env.READOUT_PASSWORD || null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--all") out.all = true;
    else if (a === "--new") out.newOnly = true;
    else if (a === "--consume") out.consume = true;
    else if (a === "--resolve") out.resolve = argv[++i];
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--password") out.password = argv[++i];
    else if (a.startsWith("--password=")) out.password = a.slice("--password=".length);
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
async function fetchComments(pbUrl, docId, opts) {
  const parts = [`doc_id='${docId}'`];
  if (opts.since) parts.push(`created>='${opts.since}'`);
  if (!opts.all) parts.push("resolved=false");
  if (opts.newOnly) parts.push("consumed=false");
  const filter = `(${parts.join(" && ")})`;
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

/** PATCH one comment record; returns true on success. */
async function patchComment(pbUrl, token, id, body) {
  const url = `${pbUrl.replace(/\/$/, "")}/api/collections/readout_comments/records/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    process.stderr.write(`warn: could not update ${id} (HTTP ${res.status}) ${text}\n`);
    return false;
  }
  return true;
}

/**
 * decrypt encrypted-comment records in place: recover real author/body/anchor
 * from each ciphertext body. plaintext records pass through untouched (a doc is
 * normally all-or-nothing, but mixed history is handled). records that fail to
 * decrypt — posted under a previous password, or junk — are dropped and counted.
 * @param {object[]} items fetched records
 * @param {string} password readout password
 * @param {string} docId "<project>/<slug>" (keys derive from it)
 * @returns {Promise<{items: object[], undecryptable: number}>} usable records + skip count
 */
export async function decryptItems(items, password, docId) {
  const keys = await deriveCommentKeys(password, docId);
  const out = [];
  let undecryptable = 0;
  for (const c of items) {
    if (!isCommentEnvelope(c.body)) {
      out.push(c);
      continue;
    }
    try {
      const p = await decryptComment(keys, JSON.parse(c.body));
      c.author = p.author;
      c.body = p.body;
      c.anchor_id = p.anchor;
      out.push(c);
    } catch {
      undecryptable++;
    }
  }
  return { items: out, undecryptable };
}

/** group comments by anchor_id, preserving created order within each group. */
function groupByAnchor(items) {
  const groups = {};
  for (const c of items) {
    (groups[c.anchor_id] ||= []).push(c);
  }
  return groups;
}

/** status tags for one comment, e.g. "[for human] [resolved]". */
function tags(c) {
  const t = [];
  if (c.audience === "human") t.push("[for human]");
  if (c.resolved) t.push("[resolved]");
  else if (c.consumed) t.push("[seen]");
  return t.length ? " " + t.join(" ") : "";
}

/** render one comment line at the given indent depth. */
function renderComment(c, depth) {
  const pad = "  ".repeat(depth);
  return `${pad}- **${c.author}** (${relTime(c.created)}) \`${c.id}\`${tags(c)}: ${c.body}`;
}

/** render an anchor group as a reply-threaded list: roots first, replies indented. */
function renderThread(list) {
  const byId = new Map(list.map((c) => [c.id, c]));
  const children = {};
  const roots = [];
  for (const c of list) {
    if (c.parent_id && byId.has(c.parent_id)) (children[c.parent_id] ||= []).push(c);
    else roots.push(c);
  }
  const lines = [];
  const walk = (c, depth) => {
    lines.push(renderComment(c, depth));
    for (const r of children[c.id] || []) walk(r, depth + 1);
  };
  for (const c of roots) walk(c, 0);
  return lines;
}

/** render grouped comments as agent-readable markdown. */
function renderMarkdown(docId, groups, total) {
  const lines = [`# Comments on ${docId}`, "", `${total} comment${total === 1 ? "" : "s"}.`, ""];
  // order anchors by their most recent activity, newest last
  const anchors = Object.keys(groups).sort((a, b) => {
    const la = groups[a][groups[a].length - 1].created;
    const lb = groups[b][groups[b].length - 1].created;
    return Date.parse(la) - Date.parse(lb);
  });
  for (const anchor of anchors) {
    lines.push(`## ${anchor}`);
    lines.push(...renderThread(groups[anchor]));
    lines.push("");
  }
  lines.push("Mark addressed comments: read-comments.mjs --resolve <id,id,...>");
  return lines.join("\n").trimEnd();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "usage: read-comments.mjs [<project>/<slug> | <slug>] [--since <ISO>] [--new] [--all]\n" +
        "                         [--consume] [--resolve <id,id,...>] [--password <pw>] [--json] [--pb-url <url>]\n"
    );
    return;
  }
  const cfg = loadConfig();
  const pbUrl = args.pbUrl || cfg.pbUrl || DEFAULT_PB_URL;

  // --resolve is a pure write operation on record ids; no doc needed
  if (args.resolve) {
    if (!cfg.pbToken) {
      process.stderr.write("error: --resolve needs pbToken in config.json\n");
      process.exit(2);
    }
    const ids = args.resolve.split(",").map((s) => s.trim()).filter(Boolean);
    let ok = 0;
    for (const id of ids) {
      if (await patchComment(pbUrl, cfg.pbToken, id, { resolved: true, consumed: true })) ok++;
    }
    process.stdout.write(`Resolved ${ok}/${ids.length} comment${ids.length === 1 ? "" : "s"}.\n`);
    process.exit(ok === ids.length ? 0 : 1);
  }

  const docId = resolveDocId(args.doc);
  if (!docId) {
    process.stderr.write("error: a doc id or slug is required (e.g. pracino/auth-flow or auth-flow)\n");
    process.exit(2);
  }

  let items;
  try {
    items = await fetchComments(pbUrl, docId, args);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }

  // encrypted comments (protected readouts): bodies are ciphertext until we
  // derive the key from the password. without one, refuse to dump ciphertext.
  let undecryptable = 0;
  const encryptedCount = items.filter((c) => isCommentEnvelope(c.body)).length;
  if (encryptedCount > 0) {
    if (!args.password) {
      process.stdout.write(
        `This readout has ${encryptedCount} encrypted comment${encryptedCount === 1 ? "" : "s"}. ` +
          `Re-run with --password <pw> (or set READOUT_PASSWORD) to read ${encryptedCount === 1 ? "it" : "them"}.\n`,
      );
      return;
    }
    const res = await decryptItems(items, args.password, docId);
    items = res.items;
    undecryptable = res.undecryptable;
  }

  if (args.consume) {
    if (!cfg.pbToken) {
      process.stderr.write("error: --consume needs pbToken in config.json\n");
      process.exit(2);
    }
    for (const c of items.filter((c) => !c.consumed)) {
      if (await patchComment(pbUrl, cfg.pbToken, c.id, { consumed: true })) c.consumed = true;
    }
  }

  const groups = groupByAnchor(items);
  if (args.json) {
    process.stdout.write(JSON.stringify({ docId, total: items.length, undecryptable, groups }, null, 2) + "\n");
    return;
  }
  const skipNote = undecryptable
    ? `\n\n_Skipped ${undecryptable} undecryptable comment${undecryptable === 1 ? "" : "s"} (likely posted under a previous password)._`
    : "";
  if (items.length === 0) {
    const scope = args.newOnly ? "new " : args.all ? "" : "open ";
    process.stdout.write(`No ${scope}comments on ${docId}${args.since ? ` since ${args.since}` : ""}.${skipNote}\n`);
    return;
  }
  process.stdout.write(renderMarkdown(docId, groups, items.length) + skipNote + "\n");
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
