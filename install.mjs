#!/usr/bin/env node

/**
 * interactive installer for claude-skills — a React terminal app built on ink.
 * this entry stays a plain .mjs: it guards the environment, bootstraps the npm
 * dependencies on first run, then hands off to the JSX app via tsx.
 *
 * usage: node install.mjs
 */

import { existsSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 22) {
    console.error(`claude-skills installer needs Node 22+ (you have ${process.versions.node}).`);
    process.exit(1);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("this installer needs an interactive terminal (TTY).");
    process.exit(1);
}

// self-bootstrap: the bin can be run straight after clone, before npm install
if (!existsSync(join(__dirname, "node_modules", "ink"))) {
    console.log("first run — installing installer dependencies (one-time, ~2s)...\n");
    try {
        execSync("npm install", { cwd: __dirname, stdio: "inherit" });
    } catch {
        console.error("\nnpm install failed — run it manually in the repo root and retry.");
        process.exit(1);
    }
}

const { tsImport } = await import("tsx/esm/api");

try {
    await tsImport("./src/app.jsx", import.meta.url);
} catch (err) {
    console.error("error:", err?.message ?? err);
    process.exit(1);
}
