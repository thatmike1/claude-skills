import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

/** expands a leading ~ to the home directory (path.resolve leaves ~ untouched) */
function expandHome(p) {
    if (p === "~") return homedir();
    if (p.startsWith("~/")) return join(homedir(), p.slice(2));
    return p;
}

/**
 * writes artifact/config.json and seeds the shared theme base (style.css +
 * artifact.js) into <artifactsRoot>/_shared so generated artifacts can link it.
 * existing shared files are kept as-is to preserve user customizations.
 */
export function writeArtifactConfig(values, repoDir) {
    const artifactsRoot = resolve(expandHome(values.artifactsRoot));
    const sharedDir = join(artifactsRoot, "_shared");
    const lines = [];

    writeFileSync(
        join(repoDir, "artifact", "config.json"),
        JSON.stringify({ artifactsRoot }, null, 2) + "\n"
    );
    lines.push("wrote artifact/config.json");

    // seed the shared theme base — idempotent: only writes files that are missing
    mkdirSync(sharedDir, { recursive: true });
    const assets = join(repoDir, "artifact", "assets");
    for (const file of ["style.css", "artifact.js"]) {
        const dest = join(sharedDir, file);
        if (existsSync(dest)) {
            lines.push(`kept existing _shared/${file}`);
        } else {
            copyFileSync(join(assets, file), dest);
            lines.push(`seeded _shared/${file}`);
        }
    }

    return lines;
}
