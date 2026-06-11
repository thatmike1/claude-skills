/**
 * minimal YAML frontmatter parser — extracts top-level string keys only.
 * handles plain values, folded scalars (`key: >`), and literal scalars (`key: |`),
 * which is everything the SKILL.md files in this repo use. deliberately not a
 * full YAML parser; unknown shapes are skipped rather than throwing.
 */

/** parses the first `---` fenced frontmatter block of a markdown string into a flat object */
export function parseFrontmatter(md) {
    const lines = md.split("\n");
    if (lines[0]?.trim() !== "---") return {};

    const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (end === -1) return {};

    const block = lines.slice(1, end);
    const result = {};

    for (let i = 0; i < block.length; i++) {
        const match = block[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/);
        if (!match) continue;

        const [, key, rawValue] = match;
        const value = rawValue.trim();

        if (value === ">" || value === "|" || value === ">-" || value === "|-") {
            const { text, consumed } = readBlockScalar(block, i + 1, value.startsWith(">"));
            result[key] = text;
            i += consumed;
        } else {
            result[key] = stripQuotes(value);
        }
    }

    return result;
}

/** reads indented continuation lines of a block scalar; folds with spaces or keeps newlines */
function readBlockScalar(block, start, folded) {
    const collected = [];
    let consumed = 0;

    for (let i = start; i < block.length; i++) {
        const line = block[i];
        if (line.trim() !== "" && !/^\s/.test(line)) break;
        collected.push(line.trim());
        consumed++;
    }

    // trim trailing blank lines
    while (collected.length && collected[collected.length - 1] === "") collected.pop();

    const text = folded
        ? collected
              .map((line) => (line === "" ? "\n" : line))
              .join(" ")
              .replace(/ ?\n ?/g, "\n")
        : collected.join("\n");

    return { text: text.trim(), consumed };
}

/** removes matching surrounding quotes from a plain scalar */
function stripQuotes(value) {
    if (
        value.length >= 2 &&
        ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
}
