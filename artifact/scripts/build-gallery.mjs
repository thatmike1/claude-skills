#!/usr/bin/env node
/**
 * builds a gallery index.html for an artifacts directory.
 *
 * usage: node build-gallery.mjs <dir> <artifactsRoot>
 *   <dir>           directory to index (a project dir, or the artifacts root)
 *   <artifactsRoot> artifacts root, used to compute the relative path to _shared
 *
 * lists direct *.html artifacts in <dir> as cards, plus immediate subdirectories
 * that contain their own index.html (per-project galleries / collections), and
 * writes <dir>/index.html using the shared theme. zero npm deps.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "fs";
import { join, relative, basename } from "path";

const [dir, artifactsRoot] = process.argv.slice(2);
if (!dir || !artifactsRoot) {
    console.error("usage: build-gallery.mjs <dir> <artifactsRoot>");
    process.exit(1);
}

const SKIP_DIRS = new Set(["_shared", "_previews"]);

/** decodes the handful of HTML entities our own templates emit */
function decode(s) {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

/** pulls the first capture group as plain text (tags stripped, entities decoded) */
function grab(html, re) {
    const m = html.match(re);
    return m ? decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
}

/** reads the card metadata an artifact exposes in its markup */
function readMeta(file) {
    const html = readFileSync(file, "utf8");
    return {
        title: grab(html, /<title>([\s\S]*?)<\/title>/) || basename(file, ".html"),
        updated: grab(html, /Updated:\s*([^<·]+)/),
        version: grab(html, /Version\s*(\d+)/),
        session: grab(html, /class="session">([\s\S]*?)<\/span>/),
        summary:
            grab(html, /<p class="lead">([\s\S]*?)<\/p>/) ||
            grab(html, /class="section-intro">([\s\S]*?)<\/p>/),
    };
}

function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const entries = readdirSync(dir, { withFileTypes: true });
const cards = [];

// direct artifact pages
for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".html") || e.name === "index.html") continue;
    const file = join(dir, e.name);
    cards.push({ ...readMeta(file), href: e.name, mtime: statSync(file).mtimeMs, kind: "page" });
}

// subdirectory collections (each with its own index.html)
for (const e of entries) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
    const idx = join(dir, e.name, "index.html");
    if (!existsSync(idx)) continue;
    const count = readdirSync(join(dir, e.name)).filter(
        (f) => f.endsWith(".html") && f !== "index.html",
    ).length;
    cards.push({
        title: e.name,
        updated: "",
        version: "",
        summary: `${count} artifact${count === 1 ? "" : "s"}`,
        href: `${e.name}/index.html`,
        mtime: statSync(idx).mtimeMs,
        kind: "collection",
    });
}

cards.sort((a, b) => b.mtime - a.mtime);

const trim = (p) => p.replace(/\/+$/, "");
const isRoot = trim(dir) === trim(artifactsRoot);
const sharedHref = relative(dir, join(artifactsRoot, "_shared")) || "_shared";
const galleryTitle = isRoot ? "Artifacts" : basename(trim(dir));

const cardsHtml = cards
    .map((c) => {
        const kicker = [c.version && `Version ${c.version}`, c.updated].filter(Boolean).join(" · ");
        const cls = c.kind === "collection" ? "card card-collection" : "card";
        return `      <li><a class="${cls}" href="${esc(c.href)}">
${kicker ? `        <span class="card-kicker">${esc(kicker)}</span>\n` : ""}        <span class="card-title">${esc(c.title)}</span>
${c.summary ? `        <span class="card-summary">${esc(c.summary)}</span>\n` : ""}${c.session ? `        <span class="card-session">${esc(c.session)}</span>\n` : ""}      </a></li>`;
    })
    .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(galleryTitle)} — Artifacts</title>
<link rel="stylesheet" href="${sharedHref}/style.css" />
</head>
<body>
<main class="page gallery-page">
  <header class="masthead">
    <p class="eyebrow">Gallery</p>
    <h1>${esc(galleryTitle)}</h1>
    <p class="meta">${cards.length} artifact${cards.length === 1 ? "" : "s"}</p>
  </header>
  <ul class="gallery">
${cardsHtml || '      <li><p class="card-summary">no artifacts yet</p></li>'}
  </ul>
</main>
<script src="${sharedHref}/artifact.js"></script>
</body>
</html>
`;

writeFileSync(join(dir, "index.html"), html);
console.log(`gallery: wrote ${join(dir, "index.html")} (${cards.length} cards)`);
