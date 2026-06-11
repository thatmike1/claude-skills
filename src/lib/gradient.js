/**
 * tiny color helpers for the header animation and confetti —
 * ink <Text> accepts hex colors, so we just compute hex strings.
 */

/** converts hsl (h in degrees, s/l in 0..1) to a #rrggbb hex string */
export function hslToHex(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => {
        const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return Math.round(c * 255)
            .toString(16)
            .padStart(2, "0");
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** linearly interpolates between two hex colors, t in 0..1 */
export function lerpHex(fromHex, toHex, t) {
    const from = parseHex(fromHex);
    const to = parseHex(toHex);
    const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
    return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** returns n colors forming a two-stop gradient */
export function gradientStops(fromHex, toHex, n) {
    if (n <= 1) return [fromHex];
    return Array.from({ length: n }, (_, i) => lerpHex(fromHex, toHex, i / (n - 1)));
}

/** parses #rrggbb into [r, g, b] */
function parseHex(hex) {
    const clean = hex.replace("#", "");
    return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
}
