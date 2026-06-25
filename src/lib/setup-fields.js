import { resolve } from "path";
import { detectGitAuthor, defaultRepoDir, defaultArtifactsRoot } from "./detect.js";
import { writeMorningConfig } from "./setup-morning.js";
import { writeInvoiceConfig } from "./setup-invoice.js";
import { writeArtifactConfig } from "./setup-artifact.js";

/** splits a comma/space separated repo list into clean names */
function splitRepos(input) {
    return input.split(/[\s,]+/).filter(Boolean);
}

/**
 * declarative setup forms — each skill that needs configuration gets a field list
 * the generic <SkillSetup> component walks through, plus a pure writer function.
 * `default` may be a function for lazy detection (resolved once at form mount).
 */
export const SETUP_FIELDS = {
    morning: {
        title: "morning setup",
        fields: [
            { key: "gitAuthor", label: "git author email", default: () => detectGitAuthor() },
            {
                key: "repoDir",
                label: "repo directory",
                default: () => defaultRepoDir(),
                transform: resolve,
            },
            { key: "workRemotePattern", label: "work remote pattern", default: "gitlab" },
            { key: "personalRemotePattern", label: "personal remote pattern", default: "github" },
        ],
        write: writeMorningConfig,
    },
    "invoice-subjects": {
        title: "invoice-subjects setup",
        fields: [
            { key: "gitAuthor", label: "git author email", default: () => detectGitAuthor() },
            {
                key: "repoDir",
                label: "repo directory",
                default: () => defaultRepoDir(),
                transform: resolve,
            },
            {
                key: "workRepos",
                label: "work repo names (comma-separated)",
                default: "",
                transform: splitRepos,
            },
            { key: "language", label: "language for invoice output", default: "czech" },
        ],
        // per-repo display names only exist once we know which repos were entered
        dynamicFields: (values) =>
            (values.workRepos ?? []).map((repo) => ({
                key: `projectName:${repo}`,
                label: `display name for ${repo}`,
                default: repo,
            })),
        write: writeInvoiceConfig,
    },
    artifact: {
        title: "artifact setup",
        fields: [
            {
                key: "artifactsRoot",
                label: "artifacts directory (where generated HTML docs live)",
                default: () => defaultArtifactsRoot(),
                transform: resolve,
            },
        ],
        write: writeArtifactConfig,
    },
};
