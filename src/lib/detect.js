import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";

/** detects git author email from global git config, empty string if unset */
export function detectGitAuthor() {
    try {
        return execSync("git config --global user.email", { encoding: "utf-8" }).trim();
    } catch {
        return "";
    }
}

/** default directory where the user keeps their git repos */
export function defaultRepoDir() {
    return join(homedir(), "git");
}

/** target directory for installed skills */
export function skillsDir() {
    return join(homedir(), ".claude", "skills");
}
