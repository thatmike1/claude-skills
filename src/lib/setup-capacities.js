import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * writes capacities auth + space ID from collected setup values; returns confirmation lines.
 * token goes to references/auth.md, space ID replaces the YOUR_SPACE_ID placeholder in SKILL.md.
 */
export function writeCapacitiesConfig(values, repoDir) {
    const lines = [];

    if (!values.token) {
        lines.push("token skipped — set it up later in capacities/references/auth.md");
    } else {
        const authPath = join(repoDir, "capacities", "references", "auth.md");
        writeFileSync(
            authPath,
            `# Capacities API Authentication

Bearer token for API access:

\`\`\`
${values.token}
\`\`\`

Use in all requests as:
\`\`\`
Authorization: Bearer ${values.token}
\`\`\`
`
        );
        lines.push("wrote token to capacities/references/auth.md");
    }

    if (values.spaceId) {
        const skillPath = join(repoDir, "capacities", "SKILL.md");
        const content = readFileSync(skillPath, "utf-8");
        if (content.includes("YOUR_SPACE_ID")) {
            writeFileSync(skillPath, content.replaceAll("YOUR_SPACE_ID", values.spaceId));
            lines.push("updated space ID in capacities/SKILL.md");
        } else if (content.includes(values.spaceId)) {
            lines.push("space ID already set in capacities/SKILL.md");
        } else {
            // placeholder consumed by a previous run with a different ID — too ambiguous to regex-swap safely
            lines.push(
                "space ID already configured — edit capacities/SKILL.md manually to change it"
            );
        }
    }

    return lines;
}
