import {
    createElement as h,
    cloneElement,
    useContext,
} from "react";
import {
    AnchorContext,
    CalloutsGroupContext,
    DocContext,
    freshCounters,
    useAnchor,
} from "./contexts.mjs";
import { findChildElement, kebabCase, langLabel, toText } from "./util.mjs";
import { calloutIcon, versionIcon } from "./icons.mjs";

const CALLOUT_LABELS = {
    success: "Success",
    info: "Info",
    warning: "Warning",
    danger: "Danger",
};

/**
 * root providers wrapping the whole rendered tree. establishes a fresh
 * per-compile document scope (section numbering) and the "root" anchor scope
 * for blocks that live outside any <Section>. one object per render — the
 * single SSR pass mutates them in document order.
 * @param {{ children: import("react").ReactNode }} props children
 * @returns {import("react").ReactElement} providers
 */
export function RootProviders({ children }) {
    const doc = { sectionOrdinal: 0 };
    const rootScope = { slug: "root", counters: freshCounters() };
    return h(
        DocContext.Provider,
        { value: doc },
        h(AnchorContext.Provider, { value: rootScope }, children)
    );
}

/**
 * split a frontmatter title on |accented| into masthead <h1> nodes. the
 * segment inside pipes becomes an <em> on its own line, matching the v1
 * "Plain part<br /><em>accent</em>" masthead shape.
 * @param {string} title raw title
 * @returns {import("react").ReactNode} h1 children
 */
function titleToNodes(title) {
    const match = /^(.*?)\|(.+?)\|(.*)$/.exec(title || "");
    if (!match) return title;
    const [, before, accent, after] = match;
    const nodes = [];
    const head = before.trimEnd();
    if (head) {
        nodes.push(head);
        nodes.push(h("br", { key: "br" }));
    }
    nodes.push(h("em", { key: "em" }, accent));
    if (after) nodes.push(after);
    return nodes;
}

/**
 * masthead built from frontmatter (not authored in MDX). renders the v1
 * .masthead vocabulary: .eyebrow, h1 (with optional <em>), .meta with
 * .version-chip, and .lead.
 * @param {{ fm: Record<string, unknown> }} props frontmatter bag
 * @returns {import("react").ReactElement} header
 */
export function Masthead({ fm }) {
    const { title, eyebrow, lead, version = 1, date } = fm;
    return h(
        "header",
        { className: "masthead", "data-anchor": "masthead" },
        eyebrow ? h("p", { className: "eyebrow", key: "eyebrow" }, eyebrow) : null,
        h("h1", { key: "h1" }, titleToNodes(title)),
        h(
            "p",
            { className: "meta", key: "meta" },
            date ? h("span", { key: "date" }, "Updated: ", date) : null,
            date ? h("span", { className: "dot", key: "dot" }, "·") : null,
            h(
                "span",
                { className: "version-chip", key: "ver" },
                versionIcon(),
                " Version ",
                String(version)
            )
        ),
        lead ? h("p", { className: "lead", key: "lead" }, lead) : null
    );
}

/**
 * numbered content section. auto-assigns a two-digit .marker ordinal and opens
 * a fresh anchor scope keyed by the kebab-slug of the title.
 * @param {{ title: string, intro?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} section
 */
export function Section({ title, intro, children }) {
    const doc = useContext(DocContext);
    doc.sectionOrdinal += 1;
    const ordinal = String(doc.sectionOrdinal).padStart(2, "0");
    const slug = kebabCase(title);
    const scope = { slug, counters: freshCounters() };
    return h(
        "section",
        { "data-anchor": `s-${slug}` },
        h("h2", null, h("span", { className: "marker" }, ordinal), title),
        intro ? h("p", { className: "section-intro" }, intro) : null,
        h(AnchorContext.Provider, { value: scope }, children)
    );
}

/**
 * key-points list. re-tags an authored markdown bullet list as ul.keypoints so
 * the themes render their custom markers.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} ul.keypoints
 */
export function KeyPoints({ children }) {
    const anchor = useAnchor("keypoints");
    const list = findChildElement(children, "ul");
    if (list) {
        return cloneElement(list, { className: "keypoints", "data-anchor": anchor });
    }
    return h("ul", { className: "keypoints", "data-anchor": anchor }, children);
}

/**
 * explicit wrapper grouping several adjacent callouts into one .callouts row.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .callouts
 */
export function Callouts({ children }) {
    return h(
        "div",
        { className: "callouts" },
        h(CalloutsGroupContext.Provider, { value: true }, children)
    );
}

/**
 * a single callout: icon + label + text. renders bare inside <Callouts>,
 * otherwise wraps itself in a .callouts row so it works standalone.
 * @param {{ type?: string, label?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} callout
 */
export function Callout({ type = "info", label, children }) {
    const anchor = useAnchor("callout");
    const grouped = useContext(CalloutsGroupContext);
    const item = h(
        "div",
        { className: `callout ${type}`, "data-anchor": anchor },
        h("span", { className: "ico", "aria-hidden": "true" }, calloutIcon(type)),
        h(
            "div",
            { className: "body" },
            h("span", { className: "label" }, label || CALLOUT_LABELS[type] || "Note"),
            h("p", { className: "text" }, children)
        )
    );
    return grouped ? item : h("div", { className: "callouts" }, item);
}

/**
 * severity pill row.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .chips
 */
export function Chips({ children }) {
    return h("div", { className: "chips" }, children);
}

/**
 * a single severity pill. defaults its label to the uppercased type.
 * @param {{ type?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .chip
 */
export function Chip({ type = "fyi", children }) {
    return h(
        "span",
        { className: `chip ${type}` },
        children != null ? children : type.toUpperCase()
    );
}

/**
 * shared code renderer for both <Code> and fenced ``` blocks. emits the v1
 * .codewrap structure with a language tag and a highlight.js-ready <code>.
 * @param {{ lang?: string, code: string }} props props
 * @returns {import("react").ReactElement} .codewrap
 */
function CodeBlock({ lang, code }) {
    const anchor = useAnchor("code");
    const codeClass = lang ? `language-${lang}` : undefined;
    return h(
        "div",
        { className: "codewrap breakout", "data-anchor": anchor },
        h("span", { className: "langtag" }, langLabel(lang)),
        h("pre", null, h("code", codeClass ? { className: codeClass } : null, code))
    );
}

/**
 * explicit code block. prefer the `code` prop; falls back to children text.
 * @param {{ lang?: string, code?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .codewrap
 */
export function Code({ lang, code, children }) {
    return h(CodeBlock, { lang, code: code != null ? code : toText(children) });
}

/**
 * MDX override for fenced code blocks. markdown emits <pre><code
 * class="language-x">…; this re-tags it into the .codewrap vocabulary so plain
 * ``` fences and <Code> produce identical output.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .codewrap
 */
export function Pre({ children }) {
    const code = findChildElement(children, "code");
    const props = code && code.props ? code.props : {};
    const match = /language-([\w-]+)/.exec(props.className || "");
    const lang = match ? match[1] : "";
    const source = toText(props.children).replace(/\n$/, "");
    return h(CodeBlock, { lang, code: source });
}

/**
 * mermaid diagram. prefer the `code` prop; falls back to children text.
 * @param {{ code?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .diagram
 */
export function Diagram({ code, children }) {
    const anchor = useAnchor("diagram");
    const source = code != null ? code : toText(children);
    return h(
        "div",
        { className: "diagram breakout", "data-anchor": anchor },
        h("pre", { className: "mermaid" }, source)
    );
}

/**
 * ✓ / ✕ cell mark. <Mark yes /> is a check, <Mark no /> is a cross.
 * @param {{ yes?: boolean, no?: boolean }} props props
 * @returns {import("react").ReactElement} .mark
 */
export function Mark({ yes, no }) {
    const isNo = no !== undefined && no !== false;
    if (isNo) return h("span", { className: "mark no", title: "No" }, "✕");
    return h("span", { className: "mark yes", title: "Yes" }, "✓");
}

/**
 * data table. two authoring modes:
 *  - props-driven: `headers` (string[]) + `rows` (node[][]); `nosort` marks
 *    non-sortable columns by index or header text.
 *  - markdown-driven: pass a GFM table as children; it is re-tagged in place.
 * `sortable` adds the click-to-sort class, `filter` adds the live row filter.
 * @param {{
 *   sortable?: boolean,
 *   filter?: string,
 *   headers?: string[],
 *   rows?: import("react").ReactNode[][],
 *   nosort?: Array<number|string>,
 *   children?: import("react").ReactNode,
 * }} props props
 * @returns {import("react").ReactElement} .tablewrap
 */
export function DataTable({ sortable, filter, headers, rows, nosort, children }) {
    const anchor = useAnchor("table");
    const wrapProps = { className: "tablewrap breakout", "data-anchor": anchor };
    if (filter) wrapProps["data-filter"] = typeof filter === "string" ? filter : "Filter…";

    let table;
    if (headers && rows) {
        const noSet = new Set((nosort || []).map(String));
        table = h(
            "table",
            sortable ? { className: "sortable" } : null,
            h(
                "thead",
                null,
                h(
                    "tr",
                    null,
                    headers.map((head, i) => {
                        const skip = noSet.has(String(i)) || noSet.has(String(head));
                        return h(
                            "th",
                            { key: i, scope: "col", ...(skip ? { "data-nosort": true } : {}) },
                            head
                        );
                    })
                )
            ),
            h(
                "tbody",
                null,
                rows.map((row, ri) =>
                    h(
                        "tr",
                        { key: ri },
                        row.map((cell, ci) => h("td", { key: ci }, cell))
                    )
                )
            )
        );
    } else {
        const found = findChildElement(children, "table");
        if (found && sortable) {
            const merged = `${found.props.className || ""} sortable`.trim();
            table = cloneElement(found, { className: merged });
        } else {
            table = found || children;
        }
    }
    return h("div", wrapProps, table);
}

/**
 * version-history footer. renders the "Version history" heading, the
 * ul.history rows (via <Entry> children) and the .smallprint provenance line.
 * @param {{ session?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} footer
 */
export function History({ session, children }) {
    return h(
        "footer",
        null,
        h("h2", null, "Version history"),
        h("ul", { className: "history" }, children),
        h(
            "p",
            { className: "smallprint" },
            "Generated by a Claude Code session",
            session
                ? [" · ", h("span", { className: "session", key: "session" }, session)]
                : null
        )
    );
}

/**
 * one version-history row.
 * @param {{ v: string|number, d: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} li
 */
export function Entry({ v, d, children }) {
    return h(
        "li",
        null,
        h("span", { className: "v" }, `v${v}`),
        h("span", { className: "d" }, d),
        h("span", { className: "what" }, children)
    );
}

/**
 * component map handed to the MDX runtime. custom components are referenced by
 * name in MDX; `pre` overrides fenced code blocks into the .codewrap shape.
 */
export const components = {
    Section,
    KeyPoints,
    Callout,
    Callouts,
    Chips,
    Chip,
    Code,
    Diagram,
    DataTable,
    Mark,
    History,
    Entry,
    pre: Pre,
};
