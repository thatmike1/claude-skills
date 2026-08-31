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
    readout: "Publish session docs to the web — MDX-authored, themed, anchored comments",
    orchestrate: "Frontier lead plans, routes, verifies — cheap Claude/Codex workers execute",
    morning: "Daily briefing — aggregates CC/Codex sessions, git, memory into a morning plan",
    evening: "End-of-day receipts — proves what actually got done today",
    goblin: "Neurodivergent thought structuring — braindumps, decompose, estimate, decide",
    "invoice-subjects": "Invoice subjects + newsletter blurb from git history",
    "ai-cv-scanner": "Mine conversation history for AI experience evidence",
    "cc-audit": "Audit your Claude Code setup — flags anti-patterns with fixes",
    scan: "Query past CC conversations for a date range / project",
    peek: "Read another running CC session's transcript from disk, zero footprint",
    jarvis: "Ask one session about all your others — what's open, what to touch next",
    "find-out": "Research orchestrator — picks the surface, fans out, reconciles sources",
    "design-styles": "Frontend aesthetic direction + UX baseline, no per-project setup",
    panels: "Engagement style — comic-book layout with severity tags",
    detective: "Engagement style — debugging as a case log",
    punchy: "Engagement style — hot-take-first, minimal prose",
    "live-prompt": "Handoff prompts for attended fresh-instance sessions",
    "afk-prompt": "Autonomous-run prompts + picking tasks safe to run unattended",
};

// skills whose scripts import from ../../shared — copy installs must also copy
// shared/ or those imports break. re-derive with:
//   grep -rl "shared/" --include="*.mjs" .
export const SHARED_CONSUMERS = ["morning", "ai-cv-scanner", "cc-audit", "scan", "peek"];

/** skill -> skill it depends on at runtime (soft dependency, warn only) */
export const SKILL_DEPENDENCIES = { evening: "morning", jarvis: "peek" };

/**
 * picker groups, in display order. a skill missing from every group lands in
 * the last one; skills under deprecated/ form their own collapsed group.
 */
export const CATEGORIES = [
    { title: "sessions", skills: ["morning", "evening", "scan", "peek", "jarvis"] },
    { title: "delegate", skills: ["orchestrate", "find-out"] },
    { title: "publish", skills: ["readout"] },
    { title: "think & design", skills: ["goblin", "design-styles"] },
];

export const DEPRECATED_DIR = "deprecated";

/** tiny flavor glyph per skill shown in the picker */
const GLYPHS = {
    readout: "❖",
    orchestrate: "♬",
    morning: "☀",
    evening: "☾",
    goblin: "♟",
    "invoice-subjects": "€",
    "ai-cv-scanner": "❂",
    "cc-audit": "✚",
    scan: "⌕",
    peek: "◉",
    jarvis: "☉",
    "live-prompt": "➳",
    "afk-prompt": "☍",
    "find-out": "⌖",
    "design-styles": "✧",
    panels: "▦",
    detective: "☂",
    punchy: "✸",
};

/**
 * discovers installable skills by scanning the repo root and deprecated/ for
 * directories containing a SKILL.md — no hardcoded list, so new skills show up
 * automatically. each skill carries `dir`, its path relative to the repo root.
 */
export function discoverSkills(repoDir, targetDir) {
    const skills = [
        ...scanDir(repoDir, "", targetDir),
        ...scanDir(join(repoDir, DEPRECATED_DIR), DEPRECATED_DIR, targetDir),
    ];
    return skills.sort(
        (a, b) =>
            Number(a.deprecated) - Number(b.deprecated) ||
            orderOf(a.name) - orderOf(b.name) ||
            a.name.localeCompare(b.name),
    );
}

function scanDir(dir, relative, targetDir) {
    if (!existsSync(dir)) return [];
    const skills = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
            continue;

        const skillMd = join(dir, entry.name, "SKILL.md");
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
            dir: relative ? `${relative}/${name}` : name,
            deprecated: relative === DEPRECATED_DIR,
            blurb: SHORT_BLURBS[name] ?? truncate(frontmatter.description ?? "", 80),
            glyph: GLYPHS[name] ?? "◆",
            hasSetup: name in SETUP_FIELDS,
            installed: existsSync(join(targetDir, name)),
            needsShared: SHARED_CONSUMERS.includes(name),
        });
    }
    return skills;
}

/** position of a skill's category, then its position inside it */
function orderOf(name) {
    for (const [ci, category] of CATEGORIES.entries()) {
        const si = category.skills.indexOf(name);
        if (si !== -1) return ci * 100 + si;
    }
    return CATEGORIES.length * 100;
}

function truncate(text, max) {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
