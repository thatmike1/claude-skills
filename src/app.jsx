import { useEffect, useMemo, useState } from "react";
import { Box, Text, render, useApp } from "ink";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { Header } from "./components/header.jsx";
import { Tagline } from "./components/tagline.jsx";
import { SkillSelect } from "./components/skill-select.jsx";
import { MethodSelect } from "./components/method-select.jsx";
import { SkillSetup } from "./components/skill-setup.jsx";
import { InstallProgress } from "./components/install-progress.jsx";
import { Done } from "./components/done.jsx";
import { discoverSkills } from "./lib/skills.js";
import { skillsDir } from "./lib/detect.js";

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIR = skillsDir();
const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");

/**
 * step machine: select → method → setup (one per selected setup-skill) → install → done.
 * the header stays mounted across all steps; completed setup forms leave a short
 * summary log above the active step.
 */
function App() {
    const { exit } = useApp();
    const [skills] = useState(() => discoverSkills(REPO_DIR, TARGET_DIR));
    const [step, setStep] = useState("select");
    const [selected, setSelected] = useState([]);
    const [method, setMethod] = useState("symlink");
    const [setupIndex, setSetupIndex] = useState(0);
    const [setupLog, setSetupLog] = useState([]);
    const [results, setResults] = useState({});

    const setupQueue = useMemo(() => selected.filter((s) => s.hasSetup), [selected]);

    useEffect(() => {
        if (step === "aborted") exit();
    }, [step, exit]);

    const confirmSelection = (picked) => {
        if (picked.length === 0) {
            setStep("aborted");
            return;
        }
        setSelected(picked);
        setStep("method");
    };

    const confirmMethod = (picked) => {
        setMethod(picked);
        setStep(setupQueue.length > 0 ? "setup" : "install");
    };

    const completeSetup = (skillName) => (lines) => {
        setSetupLog((log) => [...log, { skill: skillName, lines }]);
        if (setupIndex + 1 < setupQueue.length) {
            setSetupIndex(setupIndex + 1);
        } else {
            setStep("install");
        }
    };

    const finishInstall = (collected) => {
        setResults(collected);
        setStep("done");
    };

    return (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
            <Header />
            <Tagline />

            {DRY_RUN && (
                <Box marginBottom={1}>
                    <Text color="yellow">⚠ dry run — previewing changes, nothing will be written</Text>
                </Box>
            )}

            {setupLog.map((entry) => (
                <Box key={entry.skill} flexDirection="column" marginBottom={1}>
                    {entry.lines.map((line) => (
                        <Text key={line} dimColor>
                            ✓ {entry.skill}: {line}
                        </Text>
                    ))}
                </Box>
            ))}

            {step === "select" && <SkillSelect skills={skills} onConfirm={confirmSelection} />}
            {step === "method" && <MethodSelect onConfirm={confirmMethod} />}
            {step === "setup" && (
                <SkillSetup
                    key={setupQueue[setupIndex].name}
                    skillName={setupQueue[setupIndex].name}
                    repoDir={REPO_DIR}
                    dryRun={DRY_RUN}
                    onComplete={completeSetup(setupQueue[setupIndex].name)}
                />
            )}
            {step === "install" && (
                <InstallProgress
                    skills={selected}
                    method={method}
                    repoDir={REPO_DIR}
                    targetDir={TARGET_DIR}
                    dryRun={DRY_RUN}
                    onDone={finishInstall}
                />
            )}
            {step === "done" && (
                <Done
                    results={results}
                    targetDir={TARGET_DIR}
                    dryRun={DRY_RUN}
                    notes={doneNotes(skills, selected, method)}
                />
            )}
            {step === "aborted" && <Text dimColor>nothing selected — see you next time.</Text>}
        </Box>
    );
}

/** warnings worth repeating on the final screen */
function doneNotes(skills, selected, method) {
    const notes = [];
    const names = new Set(selected.map((s) => s.name));
    const morningInstalled = skills.find((s) => s.name === "morning")?.installed;
    if (method === "copy" && names.has("evening") && !names.has("morning") && !morningInstalled) {
        notes.push("evening needs morning installed to run its gather script");
    }
    return notes;
}

const app = render(<App />);
await app.waitUntilExit();
