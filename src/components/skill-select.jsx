import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { SKILL_DEPENDENCIES } from "../lib/skills.js";

/**
 * checkbox multi-select for skills — space toggles, `a` toggles all,
 * enter confirms, q/escape quits with an empty selection
 */
export function SkillSelect({ skills, onConfirm }) {
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState(() => new Set());

    useInput((input, key) => {
        if (key.escape) {
            onConfirm([]);
            return;
        }
        if (key.return) {
            if (selected.size > 0) onConfirm(skills.filter((s) => selected.has(s.name)));
            return;
        }
        // fast typing / paste arrives as one chunk — process every character
        let nextCursor = cursor;
        for (const ch of key.upArrow ? "k" : key.downArrow ? "j" : input) {
            if (ch === "k") {
                nextCursor = (nextCursor - 1 + skills.length) % skills.length;
            } else if (ch === "j") {
                nextCursor = (nextCursor + 1) % skills.length;
            } else if (ch === " ") {
                const name = skills[nextCursor].name;
                setSelected((prev) => {
                    const next = new Set(prev);
                    next.has(name) ? next.delete(name) : next.add(name);
                    return next;
                });
            } else if (ch === "a") {
                setSelected((prev) =>
                    prev.size === skills.length ? new Set() : new Set(skills.map((s) => s.name)),
                );
            } else if (ch === "q") {
                onConfirm([]);
                return;
            }
        }
        setCursor(nextCursor);
    });

    const warnings = dependencyWarnings(skills, selected);

    return (
        <Box flexDirection="column">
            <Text bold>pick your skills</Text>
            <Box marginBottom={1}>
                <Text dimColor>↑/↓ move · space toggle · a all · enter confirm · q quit</Text>
            </Box>

            {skills.map((skill, i) => {
                const active = i === cursor;
                const checked = selected.has(skill.name);
                return (
                    <Box key={skill.name}>
                        <Box width={2} flexShrink={0}>
                            <Text color={active ? "cyan" : undefined}>{active ? "❯" : " "}</Text>
                        </Box>
                        <Box width={2} flexShrink={0}>
                            <Text color={checked ? "green" : "gray"}>{checked ? "◼" : "◻"}</Text>
                        </Box>
                        <Box width={2} flexShrink={0}>
                            <Text dimColor>{skill.glyph}</Text>
                        </Box>
                        <Box width={18} flexShrink={0}>
                            <Text bold color={active ? "cyan" : undefined}>
                                {skill.name}
                            </Text>
                        </Box>
                        <Box width={2} flexShrink={0}>
                            <Text color="yellow">{skill.hasSetup ? "⚙" : " "}</Text>
                        </Box>
                        <Box width={4} flexShrink={0}>
                            <Text color="yellow">{skill.installed ? "[✓]" : ""}</Text>
                        </Box>
                        <Box flexGrow={1}>
                            <Text dimColor wrap="truncate-end">
                                {skill.blurb}
                            </Text>
                        </Box>
                    </Box>
                );
            })}

            <Box marginTop={1}>
                <Text dimColor>⚙ has a setup step · [✓] already installed</Text>
            </Box>

            {warnings.map((warning) => (
                <Box key={warning} marginTop={1}>
                    <Text color="yellow" dimColor>
                        ⚠ {warning}
                    </Text>
                </Box>
            ))}
        </Box>
    );
}

/** warns when a selected skill depends on another that is neither selected nor installed */
function dependencyWarnings(skills, selected) {
    const warnings = [];
    for (const [dependent, dependency] of Object.entries(SKILL_DEPENDENCIES)) {
        if (!selected.has(dependent) || selected.has(dependency)) continue;
        const dep = skills.find((s) => s.name === dependency);
        if (!dep?.installed) {
            warnings.push(`${dependent} reuses ${dependency}'s gather script — consider selecting ${dependency} too`);
        }
    }
    return warnings;
}
