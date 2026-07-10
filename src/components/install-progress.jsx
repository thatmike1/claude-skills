import { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { ensureSkillsDir, installSkill, installShared, sharedInstallNeeded } from "../lib/installer.js";

const ROW_STAGGER_MS = 160;

/**
 * runs the actual installs sequentially with a spinner per row. the fs ops are
 * synchronous, so each row is staggered by a short delay — without yielding back
 * to the renderer the spinners would never paint a frame.
 */
export function InstallProgress({ skills, method, repoDir, targetDir, dryRun = false, onDone }) {
    const rows = useMemo(() => {
        const list = skills.map((s) => ({ name: s.name, kind: "skill" }));
        if (sharedInstallNeeded(skills)) list.unshift({ name: "shared", kind: "helpers" });
        return list;
    }, [skills]);

    const [results, setResults] = useState({});

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!dryRun) ensureSkillsDir(targetDir);
            const collected = {};

            for (const row of rows) {
                await sleep(ROW_STAGGER_MS);
                if (cancelled) return;
                const result =
                    row.kind === "helpers"
                        ? installShared({ repoDir, targetDir, method, dryRun })
                        : installSkill({ repoDir, targetDir, name: row.name, method, dryRun });
                collected[row.name] = result;
                setResults({ ...collected });
            }

            await sleep(400);
            if (!cancelled) onDone(collected);
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold>{dryRun ? "dry run — nothing will be written" : "installing"}</Text>
            </Box>
            {rows.map((row) => {
                const result = results[row.name];
                return (
                    <Box key={row.name} marginLeft={2}>
                        {!result ? (
                            <Text color="cyan">
                                <Spinner type="dots" />
                            </Text>
                        ) : result.ok ? (
                            <Text color="green">✓</Text>
                        ) : (
                            <Text color="red">✗</Text>
                        )}
                        <Text bold> {row.name.padEnd(17)}</Text>
                        <Text dimColor>
                            {!result
                                ? "installing…"
                                : result.ok
                                  ? `${result.label}${row.kind === "helpers" ? " (shared parsers)" : ""}`
                                  : `failed: ${result.error}`}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
