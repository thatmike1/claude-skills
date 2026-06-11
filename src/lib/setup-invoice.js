import { writeFileSync } from "fs";
import { join, resolve } from "path";

/** writes invoice-subjects/config.json from collected setup values; returns confirmation lines */
export function writeInvoiceConfig(values, repoDir) {
    const projectNames = {};
    for (const [key, value] of Object.entries(values)) {
        const repo = key.startsWith("projectName:") ? key.slice("projectName:".length) : null;
        if (repo && value && value !== repo) projectNames[repo] = value;
    }

    const config = {
        gitAuthor: values.gitAuthor,
        repoDir: resolve(values.repoDir),
        workRepos: values.workRepos,
        language: values.language,
        projectNames,
        forbiddenWords: [],
    };

    const configPath = join(repoDir, "invoice-subjects", "config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

    const lines = ["wrote invoice-subjects/config.json"];
    if (values.workRepos.length === 0) {
        lines.push("no repos specified — edit invoice-subjects/config.json later");
    }
    return lines;
}
