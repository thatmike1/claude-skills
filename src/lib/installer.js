import { existsSync, mkdirSync, symlinkSync, unlinkSync, cpSync, lstatSync, rmSync } from "fs";
import { join } from "path";

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
export function installSkill({ repoDir, targetDir, name, method }) {
    const source = join(repoDir, name);
    const target = join(targetDir, name);

    if (!existsSync(source)) {
        return { ok: false, error: `skill directory not found: ${source}` };
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
        return { ok: true, label: method === "symlink" ? "symlinked" : "copied" };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * installs the shared/ helper modules next to the skills — copied skills import
 * ../../shared/*.mjs, which resolves to <targetDir>/shared. symlink installs
 * resolve through their real path, but we link shared/ anyway for layout parity.
 */
export function installShared({ repoDir, targetDir, method }) {
    return installSkill({ repoDir, targetDir, name: "shared", method });
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
