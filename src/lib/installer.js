import {
    existsSync,
    mkdirSync,
    symlinkSync,
    unlinkSync,
    cpSync,
    lstatSync,
    rmSync,
    readdirSync,
} from "fs";
import { join, dirname } from "path";

/** ensures the target skills directory exists */
export function ensureSkillsDir(targetDir) {
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
}

/** removes an existing install (symlink or directory); returns false on failure */
export function removeExisting(target) {
    if (!existsSync(target) && !isDanglingSymlink(target)) return true;
    try {
        const stat = lstatSync(target);
        if (stat.isSymbolicLink()) {
            unlinkSync(target);
        } else if (stat.isDirectory()) {
            rmSync(target, { recursive: true, force: true });
        }
        return true;
    } catch {
        return false;
    }
}

/** installs a single skill via symlink or copy; returns a structured result for the UI */
export function installSkill({ repoDir, targetDir, name, dir = name, method, dryRun = false }) {
    const source = join(repoDir, dir);
    const target = join(targetDir, name);

    if (!existsSync(source)) {
        return { ok: false, error: `skill directory not found: ${source}` };
    }

    const agentsSource = join(source, "agents");
    const agentFiles = existsSync(agentsSource)
        ? readdirSync(agentsSource).filter((f) => f.endsWith(".md"))
        : [];

    // dry run: validate the source, report the plan, touch nothing
    if (dryRun) {
        const verb = method === "symlink" ? "would symlink" : "would copy";
        const replaces =
            existsSync(target) || isDanglingSymlink(target) ? " (replaces existing)" : "";
        const agents = agentFiles.length ? ` + ${agentFiles.length} agent file(s)` : "";
        return { ok: true, label: `${verb}${replaces}${agents}`, dryRun: true };
    }

    if (!removeExisting(target)) {
        return { ok: false, error: `could not remove existing install at ${target}` };
    }

    try {
        if (method === "symlink") {
            symlinkSync(source, target);
        } else {
            cpSync(source, target, { recursive: true });
        }
        // skills that ship subagent definitions carry them in <skill>/agents/;
        // Claude Code only reads agents from ~/.claude/agents, so those files are
        // always copied there (even on symlink installs) rather than linked
        let agentLabel = "";
        if (agentFiles.length) {
            const agentsDir = join(dirname(targetDir), "agents");
            mkdirSync(agentsDir, { recursive: true });
            for (const file of agentFiles) {
                cpSync(join(agentsSource, file), join(agentsDir, file));
            }
            agentLabel = ` + ${agentFiles.length} agent file(s)`;
        }
        return { ok: true, label: `${method === "symlink" ? "symlinked" : "copied"}${agentLabel}` };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * installs the shared/ helper modules next to the skills — copied skills import
 * ../../shared/*.mjs, which resolves to <targetDir>/shared. symlink installs
 * resolve through their real path, but we link shared/ anyway for layout parity.
 */
export function installShared({ repoDir, targetDir, method, dryRun = false }) {
    return installSkill({ repoDir, targetDir, name: "shared", method, dryRun });
}

/** true when any selected skill imports from shared/ — installed alongside for both methods */
export function sharedInstallNeeded(selectedSkills) {
    return selectedSkills.some((skill) => skill.needsShared);
}

/** a symlink whose target is gone: existsSync says false but the link still occupies the path */
function isDanglingSymlink(target) {
    try {
        return lstatSync(target).isSymbolicLink();
    } catch {
        return false;
    }
}
