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
 * folder glyph for DocShelf directory rows in the file tree.
 * @returns {import("react").ReactElement} svg element
 */
export function folderIcon() {
    return h(
        "svg",
        {
            className: "ds-ico ds-ico-dir",
            width: "15",
            height: "15",
            viewBox: "0 0 24 24",
            strokeWidth: 1.7,
            "aria-hidden": "true",
            ...STROKE,
        },
        h("path", {
            d: "M3 6.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.6H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        })
    );
}

/**
 * document glyph for DocShelf file rows, varied by content kind: "text" (lined
 * page), "data" (braces) or "code" (angle brackets). the folded corner is
 * shared; the inner marks distinguish the kind.
 * @param {string} kind text|data|code
 * @returns {import("react").ReactElement} svg element
 */
export function docIcon(kind) {
    const common = {
        className: `ds-ico ds-ico-file ds-ico-${kind}`,
        width: "15",
        height: "15",
        viewBox: "0 0 24 24",
        strokeWidth: 1.7,
        "aria-hidden": "true",
        ...STROKE,
    };
    const page = h("path", {
        key: "page",
        d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z",
    });
    const fold = h("path", { key: "fold", d: "M14 3v5h5" });
    if (kind === "code") {
        return h(
            "svg",
            common,
            page,
            fold,
            h("path", { key: "a", d: "M10.5 12.5 9 14l1.5 1.5" }),
            h("path", { key: "b", d: "M13.5 12.5 15 14l-1.5 1.5" })
        );
    }
    if (kind === "data") {
        return h(
            "svg",
            common,
            page,
            fold,
            h("path", { key: "a", d: "M11 12c-1 0-1.3.5-1.3 1.3S9.4 15 8.7 15c.7 0 1 .4 1 1.2S10 17 11 17" }),
            h("path", { key: "b", d: "M13 12c1 0 1.3.5 1.3 1.3s.3 1.2 1 1.2c-.7 0-1 .4-1 1.2S14 17 13 17" })
        );
    }
    return h(
        "svg",
        common,
        page,
        fold,
        h("path", { key: "a", d: "M8.5 13h5" }),
        h("path", { key: "b", d: "M8.5 16h7" })
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
