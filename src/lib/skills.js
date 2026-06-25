import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseFrontmatter } from "./frontmatter.js";
import { SETUP_FIELDS } from "./setup-fields.js";

/**
 * curated one-line blurbs for the picker — SKILL.md descriptions are long
 * trigger-text for the model, not for humans scrolling a list.
 * skills without an entry fall back to a truncated frontmatter description.
 */
const SHORT_BLURBS = {
    morning: "Daily briefing — aggregates CC/Codex sessions, git, memory into a morning plan",
    evening: "End-of-day receipts — proves what actually got done today",
    goblin: "Neurodivergent thought structuring — braindumps, decompose, estimate, decide",
    "invoice-subjects": "Invoice subjects + newsletter blurb from git history",
    "ai-cv-scanner": "Mine conversation history for AI experience evidence",
    "cc-audit": "Audit your Claude Code setup — flags anti-patterns with fixes",
    scan: "Query past CC conversations for a date range / project",
    panels: "Engagement style — comic-book layout with severity tags",
    detective: "Engagement style — debugging as a case log",
    punchy: "Engagement style — hot-take-first, minimal prose",
    "live-prompt": "Handoff prompts for attended fresh-instance sessions",
    "afk-prompt": "Autonomous-run prompts + picking tasks safe to run unattended",
    artifact: "Session artifacts — polished single-page HTML docs from your work",
};

// skills whose scripts import from ../../shared — copy installs must also copy
// shared/ or those imports break. re-derive with:
//   grep -rl "shared/" --include="*.mjs" .
export const SHARED_CONSUMERS = ["morning", "ai-cv-scanner", "cc-audit", "scan"];

/** skill -> skill it depends on at runtime (soft dependency, warn only) */
export const SKILL_DEPENDENCIES = { evening: "morning" };

/** preferred display order; discovered skills not listed here sort after, alphabetically */
const DISPLAY_ORDER = [
    "morning",
    "evening",
    "goblin",
    "invoice-subjects",
    "ai-cv-scanner",
    "cc-audit",
    "scan",
    "artifact",
    "live-prompt",
    "afk-prompt",
    "panels",
    "detective",
    "punchy",
];

/** tiny flavor glyph per skill shown in the picker */
const GLYPHS = {
    morning: "☀",
    evening: "☾",
    goblin: "♟",
    "invoice-subjects": "€",
    "ai-cv-scanner": "❂",
    "cc-audit": "✚",
    scan: "⌕",
    "live-prompt": "➳",
    "afk-prompt": "☍",
    panels: "▦",
    detective: "☂",
    punchy: "✸",
    artifact: "▤",
};

/**
 * discovers installable skills by scanning the repo for directories containing
 * a SKILL.md — no hardcoded list, so new skills show up automatically
 */
export function discoverSkills(repoDir, targetDir) {
    const entries = readdirSync(repoDir, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
            continue;

        const skillMd = join(repoDir, entry.name, "SKILL.md");
        if (!existsSync(skillMd)) continue;

        let frontmatter = {};
        try {
            frontmatter = parseFrontmatter(readFileSync(skillMd, "utf-8"));
        } catch {
            // unreadable frontmatter is not fatal — the dir name is enough to install
        }

        const name = entry.name;
        skills.push({
            name,
            blurb: SHORT_BLURBS[name] ?? truncate(frontmatter.description ?? "", 80),
            glyph: GLYPHS[name] ?? "◆",
            hasSetup: name in SETUP_FIELDS,
            installed: existsSync(join(targetDir, name)),
            needsShared: SHARED_CONSUMERS.includes(name),
        });
    }

    return skills.sort((a, b) => orderOf(a.name) - orderOf(b.name) || a.name.localeCompare(b.name));
}

function orderOf(name) {
    const idx = DISPLAY_ORDER.indexOf(name);
    return idx === -1 ? DISPLAY_ORDER.length : idx;
}

function truncate(text, max) {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
