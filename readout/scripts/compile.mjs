#!/usr/bin/env node
/**
 * compile a readout .mdx source into a static HTML page using the v1 artifact
 * class vocabulary, so the existing themes style it unchanged.
 *
 * usage:
 *   node readout/scripts/compile.mjs <input.mdx> [--out <output.html>]
 *
 * default output path is the input path with a .html extension. exits non-zero
 * with a readable message on frontmatter / MDX compile / render failure — the
 * agent reads stderr to fix its MDX.
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import matter from "gray-matter";
import { components, Masthead, RootProviders } from "../components/index.mjs";

/**
 * parse `--out <path>` and the positional input from argv.
 * @param {string[]} argv raw args (process.argv.slice(2))
 * @returns {{ input?: string, out?: string }} parsed args
 */
function parseArgs(argv) {
    const parsed = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--out" || arg === "-o") {
            parsed.out = argv[i + 1];
            i += 1;
        } else if (arg.startsWith("--out=")) {
            parsed.out = arg.slice("--out=".length);
        } else if (!parsed.input && !arg.startsWith("-")) {
            parsed.input = arg;
        }
    }
    return parsed;
}

/**
 * escape a string for safe use inside an HTML text node / element.
 * @param {string} value raw string
 * @returns {string} escaped string
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * fail with a readable message on stderr and a non-zero exit code.
 * @param {string} message headline message
 * @param {unknown} [detail] optional error detail
 * @returns {never}
 */
function fail(message, detail) {
    process.stderr.write(`readout compile: ${message}\n`);
    if (detail instanceof Error) {
        process.stderr.write(`${detail.message}\n`);
    } else if (detail != null) {
        process.stderr.write(`${String(detail)}\n`);
    }
    process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
    fail("missing input. usage: compile.mjs <input.mdx> [--out <output.html>]");
}

const inputPath = resolve(args.input);
const outputPath = args.out
    ? resolve(args.out)
    : inputPath.replace(/\.mdx?$/i, ".html");

let raw;
try {
    raw = await readFile(inputPath, "utf8");
} catch (err) {
    fail(`cannot read input ${inputPath}`, err);
}

let frontmatter;
let body;
try {
    const parsed = matter(raw);
    frontmatter = parsed.data || {};
    body = parsed.content;
} catch (err) {
    fail("invalid frontmatter (check the YAML between the --- fences)", err);
}

if (!frontmatter.title) {
    fail('missing required frontmatter field "title"');
}
const version = Number.isFinite(Number(frontmatter.version))
    ? Number(frontmatter.version)
    : 1;
const fm = { ...frontmatter, version };

let Content;
try {
    const mod = await evaluate(body, {
        ...runtime,
        remarkPlugins: [remarkGfm],
        baseUrl: pathToFileURL(inputPath).href,
    });
    Content = mod.default;
} catch (err) {
    fail("MDX compile failed", err);
}

// diff registry shared across both render passes. the async <Diff> component
// registers a warm-up promise per anchor on pass 1 (each filling results with
// its prerendered HTML), then reads results to emit the real declarative
// shadow-DOM block on pass 2. see RootProviders in components/index.mjs.
const diffRegistry = { promises: new Map(), results: new Map() };

/**
 * build the full render tree for one pass. anchors are byte-stable across
 * passes because RootProviders mints a fresh doc/root scope on each call.
 * @returns {import("react").ReactElement} render tree
 */
function buildTree() {
    return h(
        RootProviders,
        { diffRegistry },
        h(
            "main",
            { className: "page" },
            h(Masthead, { fm }),
            h(Content, { components })
        )
    );
}

let inner;
try {
    // pass 1 (warm): diffs register their prerender promises into the registry.
    // with no diffs, this markup is already final and is kept as-is.
    inner = renderToStaticMarkup(buildTree());
    if (diffRegistry.promises.size > 0) {
        // wait for every diff to prerender, then render again for real — the
        // pass-1 markup (diff placeholders) is discarded.
        await Promise.all(diffRegistry.promises.values());
        inner = renderToStaticMarkup(buildTree());
    }
} catch (err) {
    fail("MDX render failed", err);
}

const title = escapeHtml(fm.title.replace(/\|/g, ""));
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<script>try{var t=localStorage.getItem("readout-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}</script>
<link rel="stylesheet" href="../_shared/style.css" />
</head>
<body>
${inner}
<script src="../_shared/comments.js"></script>
<script src="../_shared/artifact.js"></script>
<script src="../_shared/visits.js"></script>
</body>
</html>
`;

// note: @pierre/diffs embeds an ~8KB icon sprite per diff. we deliberately do
// NOT dedupe it: each diff renders inside its own declarative shadow root and
// its icons reference the sprite via <use href="#id">, which SVG scopes to the
// containing tree — a shared sprite outside the shadow root would not resolve.
// duplication is the cost of shadow-DOM isolation.

try {
    await writeFile(outputPath, html, "utf8");
} catch (err) {
    fail(`cannot write output ${outputPath}`, err);
}

process.stdout.write(`readout compile: wrote ${basename(outputPath)} -> ${outputPath}\n`);
