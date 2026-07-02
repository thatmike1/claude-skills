#!/usr/bin/env node
/**
 * publish.mjs — compile a readout, refresh the local site, and ship it to the
 * PocketBase-backed static host at config.publicBaseUrl (comments + version
 * history included; the compiled HTML always loads comments.js same-origin, so
 * no per-file config injection is needed).
 *
 * flow:
 *   1. load config.json next to SKILL.md (see config.json.example)
 *   2. resolve the target readout (named slug, else most-recent .mdx in project)
 *   3. refresh <root>/_shared/ from the skill's assets (style.css, artifact.js,
 *      comments.js)
 *   4. compile the .mdx to .html via the compile CLI
 *   5. rebuild the project + root galleries
 *   6. deploy via config.deployCmd ({root} substituted) unless --no-deploy
 *   7. record a new version row in PocketBase (skipped with a warning if no token)
 *   8. print the public URL
 *
 * usage:
 *   node scripts/publish.mjs [slug] [--note "what changed"] [--no-deploy]
 *                            [--password <pw>]
 *
 * --password (or READOUT_PASSWORD env) publishes the readout protected:
 * the compiled HTML is encrypted at publish time (see protect.mjs) and the
 * served file is a static unlock shell + ciphertext. protected readouts get
 * no comments widget, are skipped by galleries, and their version snapshots
 * are stored encrypted. the password is never stored — pass it again on
 * every republish. mark the source with `protected: true` in the frontmatter
 * so a publish without the password fails instead of shipping plaintext.
 */
import {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    copyFileSync,
    readdirSync,
    statSync,
} from "node:fs";
import { encryptToEnvelope, buildUnlockShell } from "./protect.mjs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const skillDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** expands a leading ~ to the user's home directory */
function expandHome(p) {
    if (!p) return p;
    if (p === "~") return process.env.HOME;
    if (p.startsWith("~/")) return join(process.env.HOME, p.slice(2));
    return p;
}

/** prints a message and exits non-zero */
function fail(msg) {
    console.error(`publish: ${msg}`);
    process.exit(1);
}

// ── parse args ──────────────────────────────────────────────────────────────
let slugArg = null;
let note = "publish";
let deploy = true;
let password = process.env.READOUT_PASSWORD || "";
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-deploy") deploy = false;
    else if (a === "--note") note = argv[++i] ?? note;
    else if (a.startsWith("--note=")) note = a.slice("--note=".length);
    else if (a === "--password") password = argv[++i] ?? "";
    else if (a.startsWith("--password=")) password = a.slice("--password=".length);
    else if (!a.startsWith("-") && !slugArg) slugArg = a;
    else fail(`unexpected argument "${a}"`);
}

// ── load + validate config ──────────────────────────────────────────────────
const cfgPath = join(skillDir, "config.json");
if (!existsSync(cfgPath)) {
    fail(`config.json not found at ${cfgPath}. Copy config.json.example and fill it in.`);
}
let cfg;
try {
    cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
} catch (e) {
    fail(`config.json is not valid JSON: ${e.message}`);
}

const required = ["root", "publicBaseUrl", "pbUrl"];
if (deploy) required.push("deployCmd");
const missing = required.filter((k) => !cfg[k]);
if (missing.length) {
    fail(`config.json is missing required keys: ${missing.join(", ")}`);
}

const root = expandHome(cfg.root);
const publicBaseUrl = cfg.publicBaseUrl.replace(/\/$/, "");
const pbUrl = cfg.pbUrl.replace(/\/$/, "");

// ── resolve project + target readout ─────────────────────────────────────────
let project;
try {
    project = basename(
        execSync("git rev-parse --show-toplevel", {
            stdio: ["ignore", "pipe", "ignore"],
        })
            .toString()
            .trim(),
    );
} catch {
    project = basename(process.cwd());
}

const projDir = join(root, project);
if (!existsSync(projDir)) {
    fail(`no readouts for project "${project}" at ${projDir}`);
}

let mdxFile;
if (slugArg) {
    const slug = slugArg.replace(/\.(mdx|html)$/, "");
    mdxFile = join(projDir, `${slug}.mdx`);
    if (!existsSync(mdxFile)) fail(`${mdxFile} not found`);
} else {
    const cands = readdirSync(projDir)
        .filter((f) => f.endsWith(".mdx"))
        .map((f) => ({ f, m: statSync(join(projDir, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m);
    if (!cands.length) fail(`no .mdx readouts found in ${projDir}`);
    mdxFile = join(projDir, cands[0].f);
}

const slug = basename(mdxFile, ".mdx");
const docId = `${project}/${slug}`;
const htmlFile = join(projDir, `${slug}.html`);

console.log(`publish: target ${docId}`);

// ── protection guard ─────────────────────────────────────────────────────────
// `protected: true` in the frontmatter marks a source as password-protected;
// refusing to publish it without a password prevents an accidental plaintext
// republish (the password itself is never stored anywhere).
const mdxSource = readFileSync(mdxFile, "utf8");
const fmBlock = mdxSource.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const markedProtected = /^\s*protected:\s*true\s*$/m.test(fmBlock?.[1] ?? "");
if (markedProtected && !password) {
    fail(
        `${slug}.mdx is marked "protected: true" — pass --password (or set READOUT_PASSWORD) to publish it`,
    );
}
if (password && !markedProtected) {
    console.warn(
        `publish: warning — publishing protected, but ${slug}.mdx lacks "protected: true" in its frontmatter; add it so a future publish without the password fails instead of shipping plaintext`,
    );
}

// ── refresh _shared from the skill's assets ──────────────────────────────────
const assets = join(skillDir, "assets");
const outShared = join(root, "_shared");
mkdirSync(outShared, { recursive: true });

for (const a of ["style.css", "artifact.js", "comments.js"]) {
    const src = join(assets, a);
    if (!existsSync(src)) fail(`skill asset ${a} not found at ${src}`);
    copyFileSync(src, join(outShared, a));
}
console.log(`publish: refreshed ${outShared}`);

// ── compile ──────────────────────────────────────────────────────────────────
const compileBin = process.env.READOUT_COMPILE_BIN || join(skillDir, "scripts", "compile.mjs");
const compiled = spawnSync("node", [compileBin, mdxFile], { stdio: "inherit" });
if (compiled.status !== 0) {
    fail(`compile failed (exit ${compiled.status ?? "signal"}) for ${mdxFile}`);
}
if (!existsSync(htmlFile)) fail(`compile did not produce ${htmlFile}`);

// ── encrypt (protected readouts) ─────────────────────────────────────────────
if (password) {
    let html = readFileSync(htmlFile, "utf8");
    // keep comments.js, but switch it to encrypted mode: the readout_comments
    // API is publicly readable, so the widget must encrypt every body and hash
    // every anchor with a key derived from this password (see comments.js). the
    // meta tag is the signal; it rides inside the ciphertext, invisible pre-unlock.
    const encMeta = '<meta name="readout-comments" content="encrypted" />';
    if (!html.includes(encMeta)) {
        html = html.replace(/<\/head>/i, `${encMeta}</head>`);
    }
    const envelope = await encryptToEnvelope(html, password);
    writeFileSync(htmlFile, buildUnlockShell(envelope), "utf8");
    console.log(`publish: encrypted ${slug}.html (unlock shell + AES-GCM ciphertext)`);
}

// ── rebuild galleries ─────────────────────────────────────────────────────────
const galleryBin = join(skillDir, "scripts", "build-gallery.mjs");
for (const target of [projDir, root]) {
    const r = spawnSync("node", [galleryBin, target, root], { stdio: "inherit" });
    if (r.status !== 0) fail(`gallery build failed for ${target}`);
}

// ── deploy ────────────────────────────────────────────────────────────────────
if (deploy) {
    const cmd = cfg.deployCmd.replace(/\{root\}/g, root);
    console.log(`publish: deploying — ${cmd}`);
    try {
        execSync(cmd, { stdio: "inherit" });
    } catch (e) {
        fail(`deploy command failed: ${e.message}`);
    }
} else {
    console.log("publish: --no-deploy, skipping deploy");
}

// ── record version in PocketBase ──────────────────────────────────────────────
await recordVersion();

/** posts a new version row, numbering it one past the current max for this doc */
async function recordVersion() {
    if (!cfg.pbToken) {
        console.warn("publish: no pbToken in config — skipping version record");
        return;
    }
    const headers = { Authorization: cfg.pbToken, "Content-Type": "application/json" };
    let version = 1;
    try {
        const filter = encodeURIComponent(`(doc_id='${docId}')`);
        const listUrl = `${pbUrl}/api/collections/readout_versions/records?filter=${filter}&sort=-version&perPage=1`;
        const res = await fetch(listUrl, { headers });
        if (res.ok) {
            const data = await res.json();
            const current = data.items?.[0]?.version;
            if (typeof current === "number") version = current + 1;
        } else {
            console.warn(`publish: could not read existing versions (HTTP ${res.status})`);
        }
    } catch (e) {
        console.warn(`publish: version lookup failed: ${e.message}`);
    }

    try {
        // readout_versions is publicly readable — a plaintext snapshot would
        // leak a protected readout's source, so store it as an encrypted
        // envelope instead (decrypt with: protect.mjs decrypt --password).
        const mdx = password
            ? JSON.stringify(await encryptToEnvelope(mdxSource, password))
            : mdxSource;
        const res = await fetch(`${pbUrl}/api/collections/readout_versions/records`, {
            method: "POST",
            headers,
            body: JSON.stringify({ doc_id: docId, version, note, mdx }),
        });
        if (res.ok) {
            console.log(`publish: recorded version ${version} (${note})`);
        } else {
            const body = await res.text().catch(() => "");
            console.warn(`publish: version record failed (HTTP ${res.status}) ${body}`);
        }
    } catch (e) {
        console.warn(`publish: version record failed: ${e.message}`);
    }
}

// ── report ────────────────────────────────────────────────────────────────────
console.log(`\n✓ published ${docId}${password ? " (protected)" : ""}`);
console.log(`  ${publicBaseUrl}/${project}/${slug}.html`);
if (password) {
    console.log(`  share (auto-unlock): ${publicBaseUrl}/${project}/${slug}.html#pw=${encodeURIComponent(password)}`);
    console.log("  note: not listed in galleries; comments are end-to-end encrypted (read with: read-comments.mjs --password); republish requires the password");
} else {
    console.log(`  ${publicBaseUrl}/${project}/index.html`);
}
