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

let inner;
try {
    const tree = h(
        RootProviders,
        null,
        h(
            "main",
            { className: "page" },
            h(Masthead, { fm }),
            h(Content, { components })
        )
    );
    inner = renderToStaticMarkup(tree);
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
<link rel="stylesheet" href="../_shared/style.css" />
</head>
<body>
${inner}
<script src="../_shared/comments.js"></script>
<script src="../_shared/artifact.js"></script>
</body>
</html>
`;

try {
    await writeFile(outputPath, html, "utf8");
} catch (err) {
    fail(`cannot write output ${outputPath}`, err);
}

process.stdout.write(`readout compile: wrote ${basename(outputPath)} -> ${outputPath}\n`);
