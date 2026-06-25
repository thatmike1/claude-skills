import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

/** the four shipped themes; the first is the default when none/invalid is given */
const THEMES = ["dossier", "editorial", "terminal", "brutalist"];

/** expands a leading ~ to the home directory (path.resolve leaves ~ untouched) */
function expandHome(p) {
    if (p === "~") return homedir();
    if (p.startsWith("~/")) return join(homedir(), p.slice(2));
    return p;
}

/**
 * writes artifact/config.json and seeds the shared theme base into
 * <artifactsRoot>/_shared: artifact.js, every theme under _shared/themes/, and
 * the active stylesheet (_shared/style.css = the chosen theme). artifacts link
 * the stable _shared/style.css, so switching theme is one file copy over it.
 * theme files are skill-owned and always refreshed; artifact.js is kept if it
 * already exists to preserve user customizations.
 */
export function writeArtifactConfig(values, repoDir) {
    const artifactsRoot = resolve(expandHome(values.artifactsRoot));
    const theme = THEMES.includes(values.theme) ? values.theme : THEMES[0];
    const sharedDir = join(artifactsRoot, "_shared");
    const themesDir = join(sharedDir, "themes");
    const lines = [];

    writeFileSync(
        join(repoDir, "artifact", "config.json"),
        JSON.stringify({ artifactsRoot, theme }, null, 2) + "\n"
    );
    lines.push(`wrote artifact/config.json (theme: ${theme})`);

    mkdirSync(themesDir, { recursive: true });
    const assets = join(repoDir, "artifact", "assets");
    const assetThemes = join(assets, "themes");

    // keep existing artifact.js (may carry user tweaks); seed if missing
    const jsDest = join(sharedDir, "artifact.js");
    if (existsSync(jsDest)) {
        lines.push("kept existing _shared/artifact.js");
    } else {
        copyFileSync(join(assets, "artifact.js"), jsDest);
        lines.push("seeded _shared/artifact.js");
    }

    // refresh all theme files — skill-owned, safe to overwrite
    for (const file of readdirSync(assetThemes)) {
        if (!file.endsWith(".css")) continue;
        copyFileSync(join(assetThemes, file), join(themesDir, file));
    }
    lines.push(`seeded _shared/themes/ (${THEMES.join(", ")})`);

    // set the active stylesheet to the chosen theme
    copyFileSync(join(assetThemes, `${theme}.css`), join(sharedDir, "style.css"));
    lines.push(`set active theme → _shared/style.css (${theme})`);

    return lines;
}
