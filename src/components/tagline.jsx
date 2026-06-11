import { useMemo } from "react";
import { Box, Text } from "ink";

const TAGLINES = [
    "React. In your terminal. We're not sorry.",
    "13 skills, zero chill.",
    "your terminal called — it wants to be a component tree",
    "now with 100% more virtual DOM than your last installer",
    "useState(\"in a TTY\")",
    "the goblin approves of this installer",
    "flexbox in a terminal. what a time to be alive.",
    "ship skills, not boilerplate",
    "this used to be a readline loop. look at it now.",
    "morning, evening, and everything in between",
];

/** one random tagline, picked once at mount */
export function Tagline() {
    const line = useMemo(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)], []);
    return (
        <Box marginBottom={1}>
            <Text dimColor italic>
                {line}
            </Text>
        </Box>
    );
}
