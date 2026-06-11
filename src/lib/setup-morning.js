import { writeFileSync } from "fs";
import { join, resolve } from "path";

/** writes morning/config.json from collected setup values; returns confirmation lines */
export function writeMorningConfig(values, repoDir) {
    const config = {
        gitAuthor: values.gitAuthor,
        repoDir: resolve(values.repoDir),
        workRemotePattern: values.workRemotePattern,
        personalRemotePattern: values.personalRemotePattern,
    };

    const configPath = join(repoDir, "morning", "config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    return ["wrote morning/config.json"];
}
