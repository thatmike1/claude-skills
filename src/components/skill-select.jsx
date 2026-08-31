import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { CATEGORIES, SKILL_DEPENDENCIES } from "../lib/skills.js";

/**
 * checkbox multi-select for skills grouped by category — space toggles, `a` toggles
 * all visible, `d` expands the deprecated group, enter confirms, q/escape quits
 * with an empty selection
 */
export function SkillSelect({ skills, onConfirm }) {
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState(() => new Set());
    const [showDeprecated, setShowDeprecated] = useState(false);

    const rows = useMemo(() => buildRows(skills, showDeprecated), [skills, showDeprecated]);
    const pickable = rows.filter((row) => row.kind === "skill").map((row) => row.skill);

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
                nextCursor = (nextCursor - 1 + pickable.length) % pickable.length;
            } else if (ch === "j") {
                nextCursor = (nextCursor + 1) % pickable.length;
            } else if (ch === " ") {
                const name = pickable[nextCursor].name;
                setSelected((prev) => {
                    const next = new Set(prev);
                    next.has(name) ? next.delete(name) : next.add(name);
                    return next;
                });
            } else if (ch === "a") {
                setSelected((prev) => {
                    const all = pickable.map((s) => s.name);
                    return all.every((name) => prev.has(name)) ? new Set() : new Set(all);
                });
            } else if (ch === "d") {
                setShowDeprecated((prev) => !prev);
            } else if (ch === "q") {
                onConfirm([]);
                return;
            }
        }
        setCursor(nextCursor);
    });

    const warnings = dependencyWarnings(skills, selected);
    const activeName = pickable[Math.min(cursor, pickable.length - 1)]?.name;

    return (
        <Box flexDirection="column">
            <Text bold>pick your skills</Text>
            <Box marginBottom={1}>
                <Text dimColor>↑/↓ move · space toggle · a all · d deprecated · enter confirm · q quit</Text>
            </Box>

            {rows.map((row) =>
                row.kind === "header" ? (
                    <Box key={`h:${row.title}`} marginTop={row.first ? 0 : 1} marginLeft={2}>
                        <Text dimColor>{row.title.toUpperCase()}</Text>
                    </Box>
                ) : (
                    <SkillRow
                        key={row.skill.name}
                        skill={row.skill}
                        active={row.skill.name === activeName}
                        checked={selected.has(row.skill.name)}
                    />
                ),
            )}

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

function SkillRow({ skill, active, checked }) {
    return (
        <Box>
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
}

/**
 * interleaves category headers with their skills. skills in no category get an
 * "other" header; deprecated skills sit under a final header that reads as a
 * collapsed count until expanded
 */
function buildRows(skills, showDeprecated) {
    const rows = [];
    const placed = new Set();
    const live = skills.filter((s) => !s.deprecated);
    const deprecated = skills.filter((s) => s.deprecated);

    for (const category of CATEGORIES) {
        const members = live.filter((s) => category.skills.includes(s.name));
        if (members.length === 0) continue;
        rows.push({ kind: "header", title: category.title, first: rows.length === 0 });
        for (const skill of members) {
            rows.push({ kind: "skill", skill });
            placed.add(skill.name);
        }
    }

    const other = live.filter((s) => !placed.has(s.name));
    if (other.length > 0) {
        rows.push({ kind: "header", title: "other", first: rows.length === 0 });
        for (const skill of other) rows.push({ kind: "skill", skill });
    }

    if (deprecated.length > 0) {
        const title = showDeprecated
            ? `deprecated (d to collapse)`
            : `▸ deprecated (${deprecated.length}) · d to expand`;
        rows.push({ kind: "header", title, first: rows.length === 0 });
        if (showDeprecated) for (const skill of deprecated) rows.push({ kind: "skill", skill });
    }

    return rows;
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
