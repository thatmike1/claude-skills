import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { lerpHex } from "../lib/gradient.js";

const CONFETTI_HEIGHT = 5;
const CONFETTI_FRAMES = 14;
const FRAME_MS = 90;
const EXIT_DELAY_MS = 600;
const GLYPHS = ["*", "✦", "·", "+", "❋", "○", "✧"];

/**
 * final summary with a short ascii confetti rain — because installing things
 * should feel like something happened. auto-exits after the rain settles.
 */
export function Done({ results, targetDir, notes }) {
    const { exit } = useApp();
    const [frame, setFrame] = useState(0);

    const width = Math.min((process.stdout.columns ?? 80) - 4, 64);
    const particles = useMemo(() => makeParticles(width), [width]);

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((f) => {
                if (f + 1 >= CONFETTI_FRAMES) clearInterval(timer);
                return f + 1;
            });
        }, FRAME_MS);
        return () => clearInterval(timer);
    }, []);

    const raining = frame < CONFETTI_FRAMES;

    useEffect(() => {
        if (!raining) {
            const timer = setTimeout(exit, EXIT_DELAY_MS);
            return () => clearTimeout(timer);
        }
    }, [raining, exit]);

    useInput(() => exit());

    const entries = Object.entries(results).filter(([name]) => name !== "shared");
    const installed = entries.filter(([, r]) => r.ok);
    const failed = entries.filter(([, r]) => !r.ok);
    const shared = results.shared;

    return (
        <Box flexDirection="column">
            {raining && (
                <Box flexDirection="column" marginBottom={1}>
                    {Array.from({ length: CONFETTI_HEIGHT }, (_, row) => (
                        <Text key={row}>
                            {confettiRow(particles, row, frame, width).map((segment, i) => (
                                <Text key={i} color={segment.color}>
                                    {segment.text}
                                </Text>
                            ))}
                        </Text>
                    ))}
                </Box>
            )}

            <Text bold color="green">
                ✓ {installed.length} of {entries.length} skill{entries.length === 1 ? "" : "s"} installed to{" "}
                {targetDir}
            </Text>

            {shared?.ok && (
                <Box marginLeft={2}>
                    <Text dimColor>+ shared parser helpers ({shared.label})</Text>
                </Box>
            )}

            {failed.map(([name, result]) => (
                <Box key={name} marginLeft={2}>
                    <Text color="red">✗ {name} — {result.error}</Text>
                </Box>
            ))}

            {notes.map((note) => (
                <Box key={note} marginLeft={2}>
                    <Text color="yellow">⚠ {note}</Text>
                </Box>
            ))}

            <Box marginTop={1}>
                <Text dimColor>restart claude code to pick up the new skills.</Text>
            </Box>
        </Box>
    );
}

/** generates falling confetti particles with randomized column, delay, glyph, and hue */
function makeParticles(width) {
    return Array.from({ length: Math.max(Math.floor(width * 0.7), 20) }, () => ({
        col: Math.floor(Math.random() * width),
        delay: Math.floor(Math.random() * (CONFETTI_FRAMES - CONFETTI_HEIGHT)),
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        color: lerpHex("#00d7ff", "#ff5fd7", Math.random()),
    }));
}

/** builds one row of the confetti grid as colored segments for the current frame */
function confettiRow(particles, row, frame, width) {
    const cells = new Array(width).fill(null);
    for (const particle of particles) {
        if (frame - particle.delay === row) cells[particle.col] = particle;
    }

    const segments = [];
    let blanks = 0;
    for (const cell of cells) {
        if (!cell) {
            blanks++;
            continue;
        }
        if (blanks > 0) segments.push({ text: " ".repeat(blanks), color: undefined });
        blanks = 0;
        segments.push({ text: cell.glyph, color: cell.color });
    }
    if (segments.length === 0) segments.push({ text: " ", color: undefined });
    return segments;
}
