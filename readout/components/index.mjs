import {
    createElement as h,
    cloneElement,
    Children,
    isValidElement,
    useContext,
} from "react";
import { preloadPatchDiff, preloadMultiFileDiff } from "@pierre/diffs/ssr";
import {
    AnchorContext,
    CalloutsGroupContext,
    DiffContext,
    DocContext,
    freshCounters,
    useAnchor,
} from "./contexts.mjs";
import { findChildElement, kebabCase, langLabel, toText } from "./util.mjs";
import { calloutIcon, moonIcon, sunIcon, versionIcon } from "./icons.mjs";

/**
 * pierre diff SSR theme options: follow the page's color-scheme with zero JS
 * via light-dark() in the shadow CSS. shared by patch and old/new modes.
 */
const DIFF_THEME = { dark: "pierre-dark", light: "pierre-light" };

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
 * @param {{
 *   children: import("react").ReactNode,
 *   diffRegistry?: { promises: Map<string, Promise<void>>, results: Map<string, string> },
 * }} props children and the optional two-pass diff registry
 * @returns {import("react").ReactElement} providers
 */
export function RootProviders({ children, diffRegistry = null }) {
    const doc = { sectionOrdinal: 0 };
    const rootScope = { slug: "root", counters: freshCounters() };
    return h(
        DiffContext.Provider,
        { value: diffRegistry },
        h(
            DocContext.Provider,
            { value: doc },
            h(AnchorContext.Provider, { value: rootScope }, children)
        )
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
        h(
            "div",
            { className: "masthead-top", key: "top" },
            h(
                "div",
                { className: "masthead-titles", key: "titles" },
                eyebrow ? h("p", { className: "eyebrow", key: "eyebrow" }, eyebrow) : null,
                h("h1", { key: "h1" }, titleToNodes(title))
            ),
            h(
                "button",
                {
                    className: "theme-toggle",
                    type: "button",
                    "aria-label": "toggle theme",
                    key: "theme-toggle",
                },
                sunIcon(),
                moonIcon()
            )
        ),
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
 * diagram block. two modes:
 *  - mermaid (default): prefer the `code` prop, falls back to children text,
 *    emits a <pre class="mermaid"> the client renders.
 *  - rich: pass an `html` string (e.g. a hand-authored SVG/markup figure); it
 *    is injected into a .diagram-canvas inside a .diagram.diagram-rich wrapper.
 * @param {{ code?: string, html?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .diagram
 */
export function Diagram({ code, html, children }) {
    const anchor = useAnchor("diagram");
    if (html != null) {
        return h(
            "div",
            { className: "diagram diagram-rich breakout", "data-anchor": anchor },
            h("div", {
                className: "diagram-canvas",
                dangerouslySetInnerHTML: { __html: html },
            })
        );
    }
    const source = code != null ? code : toText(children);
    return h(
        "div",
        { className: "diagram breakout", "data-anchor": anchor },
        h("pre", { className: "mermaid" }, source)
    );
}

/**
 * build a pierre diff SSR preload promise for the given props, keyed on which
 * authoring mode is used (unified `patch` string, or `oldText`/`newText` pair).
 * both resolve to `{ prerenderedHTML }`.
 * @param {{ patch?: string, oldText?: string, newText?: string, split?: boolean, filename?: string }} props diff props
 * @returns {Promise<{ prerenderedHTML: string }>} preload result
 */
function preloadDiff({ patch, oldText, newText, split, filename }) {
    const options = {
        diffStyle: split ? "split" : "unified",
        theme: DIFF_THEME,
    };
    if (patch != null) {
        return preloadPatchDiff({ patch, options });
    }
    const name = filename || "file";
    return preloadMultiFileDiff({
        oldFile: { name, contents: oldText != null ? oldText : "" },
        newFile: { name, contents: newText != null ? newText : "" },
        options,
    });
}

/**
 * syntax-highlighted diff, prerendered to static HTML by @pierre/diffs during a
 * warm SSR pass and pulled from the shared registry on the real pass. the
 * markup follows the page color-scheme with zero client JS. the commentable
 * anchor lives on the OUTER wrapper (not the shadow host) so comment pins land
 * in the light DOM. authored via a unified `patch` string, or `oldText`+`newText`.
 * @param {{
 *   patch?: string,
 *   oldText?: string,
 *   newText?: string,
 *   split?: boolean,
 *   filename?: string,
 * }} props props
 * @returns {import("react").ReactElement} .diffwrap
 */
export function Diff({ patch, oldText, newText, split, filename }) {
    const anchor = useAnchor("diff");
    const registry = useContext(DiffContext);
    const html = registry && registry.results.has(anchor)
        ? registry.results.get(anchor)
        : null;
    if (registry && html == null && !registry.promises.has(anchor)) {
        registry.promises.set(
            anchor,
            preloadDiff({ patch, oldText, newText, split, filename }).then((r) => {
                registry.results.set(anchor, r.prerenderedHTML);
            })
        );
    }
    return h(
        "div",
        { className: "diffwrap breakout", "data-anchor": anchor },
        h(
            "div",
            { className: "diff-shadow" },
            html != null
                ? h("template", {
                      shadowrootmode: "open",
                      dangerouslySetInnerHTML: { __html: html },
                  })
                : null
        )
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
 * convert a single GFM task-list `<li>` (an `<input type="checkbox">` followed
 * by its label content) into the .check DOM: a .box marker plus the remaining
 * label nodes, with `.done` when the checkbox is checked.
 * @param {import("react").ReactElement} li task-list item element
 * @returns {import("react").ReactElement} li.check
 */
function taskItemToCheck(li) {
    let done = false;
    const rest = [];
    Children.forEach(li.props.children, (child) => {
        if (isValidElement(child) && child.type === "input") {
            done = child.props.checked === true || child.props.defaultChecked === true;
            return;
        }
        rest.push(child);
    });
    return h(
        "li",
        { className: done ? "check done" : "check" },
        h("span", { className: "box", key: "box" }),
        rest
    );
}

/**
 * checklist. two authoring modes:
 *  - explicit: <Check> children (each renders an li.check).
 *  - markdown-driven: a GFM task list (`- [ ]` / `- [x]`) passed as children;
 *    its <li> items are re-tagged into the .check vocabulary in place.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} ul.checklist
 */
export function Checklist({ children }) {
    const anchor = useAnchor("checklist");
    const list = findChildElement(children, "ul");
    if (list) {
        const items = Children.map(list.props.children, (li) =>
            isValidElement(li) && li.type === "li" ? taskItemToCheck(li) : li
        );
        return h("ul", { className: "checklist", "data-anchor": anchor }, items);
    }
    return h("ul", { className: "checklist", "data-anchor": anchor }, children);
}

/**
 * one checklist item. `done` renders the checked state.
 * @param {{ done?: boolean, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} li.check
 */
export function Check({ done, children }) {
    return h(
        "li",
        { className: done ? "check done" : "check" },
        h("span", { className: "box", key: "box" }),
        children
    );
}

/**
 * vertical timeline. children are <Event> rows.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} ol.timeline
 */
export function Timeline({ children }) {
    const anchor = useAnchor("timeline");
    return h("ol", { className: "timeline", "data-anchor": anchor }, children);
}

/**
 * one timeline row: a time label, a marker dot, and a titled body.
 * @param {{ time?: string, title?: string, children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} li.tl-event
 */
export function Event({ time, title, children }) {
    return h(
        "li",
        { className: "tl-event" },
        h("span", { className: "tl-time", key: "time" }, time),
        h("span", { className: "tl-dot", key: "dot" }),
        h(
            "div",
            { className: "tl-body", key: "body" },
            h("div", { className: "tl-title", key: "title" }, title),
            h("div", { className: "tl-detail", key: "detail" }, children)
        )
    );
}

/**
 * grid of stat tiles. children are <Stat> tiles.
 * @param {{ children?: import("react").ReactNode }} props props
 * @returns {import("react").ReactElement} .stattiles
 */
export function StatTiles({ children }) {
    const anchor = useAnchor("stattiles");
    return h("div", { className: "stattiles", "data-anchor": anchor }, children);
}

/**
 * one stat tile: a big value, a label, and an optional delta whose trend
 * (up|down|flat) tags the .stat-delta for directional styling.
 * @param {{
 *   label?: import("react").ReactNode,
 *   value?: import("react").ReactNode,
 *   delta?: import("react").ReactNode,
 *   trend?: string,
 * }} props props
 * @returns {import("react").ReactElement} .stat
 */
export function Stat({ label, value, delta, trend }) {
    return h(
        "div",
        { className: "stat" },
        h("div", { className: "stat-value", key: "value" }, value),
        h("div", { className: "stat-label", key: "label" }, label),
        delta != null
            ? h("div", { className: `stat-delta ${trend || "flat"}`, key: "delta" }, delta)
            : null
    );
}

/**
 * nest a flat list of file entries into a tree keyed by path segment. leaf
 * segments carry the file's status/note; intermediate segments are directories.
 * @param {Array<{ path: string, status?: string, note?: string }>} paths entries
 * @returns {{ children: Map<string, object> }} root tree node
 */
function buildFileTree(paths) {
    const root = { children: new Map() };
    for (const entry of paths) {
        const parts = String(entry.path || "")
            .split("/")
            .filter(Boolean);
        let node = root;
        parts.forEach((part, i) => {
            if (!node.children.has(part)) {
                node.children.set(part, { name: part, children: new Map() });
            }
            node = node.children.get(part);
            if (i === parts.length - 1) {
                node.file = { status: entry.status, note: entry.note };
            }
        });
    }
    return root;
}

/**
 * render one file-tree node: a directory (li.ft-dir with a nested list) or a
 * file leaf (li.ft-file.{status} with an optional note).
 * @param {{ name: string, children: Map<string, object>, file?: { status?: string, note?: string } }} node tree node
 * @returns {import("react").ReactElement} li.ft-item
 */
function renderFileNode(node) {
    const isFile = node.file != null && node.children.size === 0;
    if (isFile) {
        const status = node.file.status || "modified";
        return h(
            "li",
            { className: `ft-item ft-file ${status}` },
            h("span", { className: "ft-name", key: "name" }, node.name),
            node.file.note
                ? h("span", { className: "ft-note", key: "note" }, node.file.note)
                : null
        );
    }
    return h(
        "li",
        { className: "ft-item ft-dir" },
        h("span", { className: "ft-name", key: "name" }, node.name),
        renderFileList(node, null, "children")
    );
}

/**
 * render a tree node's children as a <ul>. the root list carries the `ft-root`
 * class; nested directory lists are unclassed.
 * @param {{ children: Map<string, object> }} node tree node
 * @param {string|null} className list class (ft-root at the top level)
 * @param {string} key react key for the list element
 * @returns {import("react").ReactElement} ul
 */
function renderFileList(node, className, key) {
    const items = [];
    for (const child of node.children.values()) {
        items.push(cloneElement(renderFileNode(child), { key: child.name }));
    }
    return h("ul", { className: className || undefined, key }, items);
}

/**
 * file-tree block. nests `paths` (each `{ path, status, note }`, status ∈
 * added|modified|removed|renamed) by path segment into a directory tree.
 * @param {{ paths?: Array<{ path: string, status?: string, note?: string }> }} props props
 * @returns {import("react").ReactElement} .filetree
 */
export function FileTree({ paths }) {
    const anchor = useAnchor("filetree");
    const tree = buildFileTree(paths || []);
    return h(
        "div",
        { className: "filetree breakout", "data-anchor": anchor },
        renderFileList(tree, "ft-root", "root")
    );
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
    Diff,
    DataTable,
    Mark,
    Checklist,
    Check,
    Timeline,
    Event,
    StatTiles,
    Stat,
    FileTree,
    History,
    Entry,
    pre: Pre,
};
