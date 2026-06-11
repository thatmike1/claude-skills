import { useState } from "react";
import { Box, Text, useInput } from "ink";

const METHODS = [
    {
        value: "symlink",
        label: "symlink (recommended)",
        hint: "skills stay live-linked to this repo — git pull updates them in place",
    },
    {
        value: "copy",
        label: "copy",
        hint: "standalone snapshot in ~/.claude/skills — copies shared/ helpers too",
    },
];

/** symlink vs copy picker */
export function MethodSelect({ onConfirm }) {
    const [cursor, setCursor] = useState(0);

    useInput((input, key) => {
        if (key.upArrow || key.downArrow || input === "j" || input === "k") {
            setCursor((c) => (c + 1) % METHODS.length);
        } else if (key.return) {
            onConfirm(METHODS[cursor].value);
        }
    });

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold>install method</Text>
            </Box>
            {METHODS.map((method, i) => {
                const active = i === cursor;
                return (
                    <Box key={method.value} flexDirection="column">
                        <Box>
                            <Text color={active ? "cyan" : undefined}>{active ? "❯ " : "  "}</Text>
                            <Text bold color={active ? "cyan" : undefined}>
                                {method.label}
                            </Text>
                        </Box>
                        <Box marginLeft={4} marginBottom={i < METHODS.length - 1 ? 1 : 0}>
                            <Text dimColor>{method.hint}</Text>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}
