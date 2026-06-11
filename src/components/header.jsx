import { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import cfonts from "cfonts";
import { hslToHex, lerpHex } from "../lib/gradient.js";

const ANIMATION_FRAMES = 18;
const FRAME_MS = 80;
const GRADIENT_FROM = "#00d7ff";
const GRADIENT_TO = "#ff5fd7";

/**
 * big cfonts banner, rainbow-sweeping for ~1.5s on mount before settling into
 * a static cyan→magenta gradient. colors are applied per column via ink <Text>,
 * never by letting cfonts print itself (that would bypass ink's renderer).
 */
export function Header() {
    const lines = useMemo(() => renderBanner(), []);
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((f) => {
                if (f + 1 >= ANIMATION_FRAMES) clearInterval(timer);
                return f + 1;
            });
        }, FRAME_MS);
        return () => clearInterval(timer);
    }, []);

    const settled = frame >= ANIMATION_FRAMES;
    const width = Math.max(...lines.map((line) => line.length), 1);

    return (
        <Box flexDirection="column">
            {lines.map((line, row) => (
                <Text key={row}>
                    {colorSegments(line, width, frame, settled).map((segment, i) => (
                        <Text key={i} color={segment.color}>
                            {segment.text}
                        </Text>
                    ))}
                </Text>
            ))}
        </Box>
    );
}

/** renders the banner text with a terminal-width-aware font fallback */
function renderBanner() {
    const columns = process.stdout.columns ?? 80;
    const font = columns >= 96 ? "block" : columns >= 50 ? "tiny" : "console";
    const result = cfonts.render("claude-skills", {
        font,
        colors: ["white"],
        background: "transparent",
        letterSpacing: 1,
        space: false,
        env: "node",
    });
    const raw = typeof result === "object" && result.string ? result.string : "claude-skills";
    return stripAnsi(raw).split("\n").filter((line) => line.trim().length > 0);
}

/** splits a line into same-colored chunks — rainbow sweep while animating, static gradient after */
function colorSegments(line, width, frame, settled) {
    const segments = [];
    let current = null;

    for (let col = 0; col < line.length; col++) {
        const char = line[col];
        const color = settled
            ? lerpHex(GRADIENT_FROM, GRADIENT_TO, col / Math.max(width - 1, 1))
            : hslToHex((col * 6 + frame * 24) % 360, 0.85, 0.62);

        if (current && current.color === color) {
            current.text += char;
        } else {
            current = { text: char, color };
            segments.push(current);
        }
    }
    return segments;
}

function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, "");
}
