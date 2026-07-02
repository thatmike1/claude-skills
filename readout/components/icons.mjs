import { createElement as h } from "react";

/**
 * shared stroke props for the inline callout / masthead icons. inline SVG
 * only — the skill vocabulary forbids emoji as icons.
 */
const STROKE = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

/**
 * callout glyph keyed by callout type, lifted verbatim from the v1 template so
 * the four themes style them unchanged.
 * @param {string} type success|info|warning|danger
 * @returns {import("react").ReactElement} svg element
 */
export function calloutIcon(type) {
    const common = { viewBox: "0 0 24 24", strokeWidth: 1.6, ...STROKE };
    if (type === "success") {
        return h(
            "svg",
            common,
            h("path", { key: "a", d: "M21.5 12a9.5 9.5 0 1 1-3.2-7.1" }),
            h("path", { key: "b", d: "M9 11.5l3 3L22 5" })
        );
    }
    if (type === "warning") {
        return h(
            "svg",
            common,
            h("path", {
                key: "a",
                d: "M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z",
            }),
            h("path", { key: "b", d: "M12 9v4" }),
            h("path", { key: "c", d: "M12 17h.01" })
        );
    }
    if (type === "danger") {
        return h(
            "svg",
            common,
            h("circle", { key: "a", cx: "12", cy: "12", r: "9.5" }),
            h("path", { key: "b", d: "M15 9l-6 6" }),
            h("path", { key: "c", d: "M9 9l6 6" })
        );
    }
    // info (default)
    return h(
        "svg",
        common,
        h("circle", { key: "a", cx: "12", cy: "12", r: "9.5" }),
        h("path", { key: "b", d: "M12 16v-5" }),
        h("path", { key: "c", d: "M12 8h.01" })
    );
}

/**
 * sun glyph for the masthead theme toggle (shown in dark mode to offer light).
 * @returns {import("react").ReactElement} svg element
 */
export function sunIcon() {
    return h(
        "svg",
        {
            className: "icon-sun",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            strokeWidth: 1.8,
            "aria-hidden": "true",
            ...STROKE,
        },
        h("circle", { key: "a", cx: "12", cy: "12", r: "4.5" }),
        h("path", {
            key: "b",
            d: "M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77",
        })
    );
}

/**
 * moon glyph for the masthead theme toggle (shown in light mode to offer dark).
 * @returns {import("react").ReactElement} svg element
 */
export function moonIcon() {
    return h(
        "svg",
        {
            className: "icon-moon",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            strokeWidth: 1.8,
            "aria-hidden": "true",
            ...STROKE,
        },
        h("path", { d: "M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" })
    );
}

/**
 * gear glyph shown inside the masthead .version-chip.
 * @returns {import("react").ReactElement} svg element
 */
export function versionIcon() {
    return h(
        "svg",
        {
            width: "12",
            height: "12",
            viewBox: "0 0 24 24",
            strokeWidth: 2,
            "aria-hidden": "true",
            ...STROKE,
        },
        h("path", {
            d: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4",
        })
    );
}
