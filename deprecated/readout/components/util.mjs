import { Children, isValidElement } from "react";

/**
 * kebab-case a string for slugs and anchor ids (deterministic, ascii-only).
 * @param {string} value raw text
 * @returns {string} kebab slug
 */
export function kebabCase(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * find the first child React element of a given intrinsic type (e.g. "ul",
 * "table"). used to unwrap markdown-produced elements so a component can
 * re-tag them with the theme class vocabulary.
 * @param {import("react").ReactNode} children child nodes
 * @param {string} type intrinsic element type to match
 * @returns {import("react").ReactElement|null} matched element or null
 */
export function findChildElement(children, type) {
    let found = null;
    Children.forEach(children, (child) => {
        if (!found && isValidElement(child) && child.type === type) found = child;
    });
    return found;
}

/**
 * flatten a React node tree to its plain text content. used to lift the raw
 * source out of a fenced code block for the highlight.js <code> payload.
 * @param {import("react").ReactNode} node node tree
 * @returns {string} concatenated text
 */
export function toText(node) {
    if (node == null || node === false) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(toText).join("");
    if (node.props) return toText(node.props.children);
    return "";
}

const LANG_LABELS = {
    ts: "TypeScript",
    typescript: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    javascript: "JavaScript",
    jsx: "JSX",
    json: "JSON",
    bash: "Bash",
    sh: "Bash",
    shell: "Shell",
    zsh: "Shell",
    sql: "SQL",
    py: "Python",
    python: "Python",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    md: "Markdown",
    mdx: "MDX",
    markdown: "Markdown",
    go: "Go",
    rust: "Rust",
    rs: "Rust",
    java: "Java",
    kotlin: "Kotlin",
    swift: "Swift",
    c: "C",
    cpp: "C++",
    diff: "Diff",
    dockerfile: "Dockerfile",
    graphql: "GraphQL",
};

/**
 * human-readable label for a language tag, shown in the .langtag chip.
 * @param {string} lang language identifier
 * @returns {string} display label
 */
export function langLabel(lang) {
    if (!lang) return "Code";
    return LANG_LABELS[lang.toLowerCase()] || lang.toUpperCase();
}
