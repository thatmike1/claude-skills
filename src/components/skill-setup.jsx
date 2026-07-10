import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { SETUP_FIELDS } from "../lib/setup-fields.js";

/**
 * generic one-field-at-a-time setup form, driven by the field definitions in
 * setup-fields.js — empty submit accepts the (shown) default, matching the old
 * readline UX. dynamic fields (invoice per-repo names) are appended once the
 * base fields are answered.
 */
export function SkillSetup({ skillName, repoDir, dryRun = false, onComplete }) {
    const spec = SETUP_FIELDS[skillName];
    const [queue, setQueue] = useState(() => spec.fields.map(resolveDefault));
    const [index, setIndex] = useState(0);
    const [values, setValues] = useState({});
    const [input, setInput] = useState("");
    const [dynamicExpanded, setDynamicExpanded] = useState(!spec.dynamicFields);
    const wroteRef = useRef(false);

    const finished = dynamicExpanded && index >= queue.length;

    useEffect(() => {
        if (index >= queue.length && !dynamicExpanded) {
            setQueue((q) => [...q, ...spec.dynamicFields(values).map(resolveDefault)]);
            setDynamicExpanded(true);
        }
    }, [index, queue.length, dynamicExpanded, spec, values]);

    useEffect(() => {
        if (finished && !wroteRef.current) {
            wroteRef.current = true;
            onComplete(spec.write(values, repoDir, dryRun));
        }
    }, [finished, spec, values, repoDir, dryRun, onComplete]);

    // also covers the frame between the last base field and dynamic-field expansion
    if (finished || index >= queue.length) return null;

    const field = queue[index];

    const submit = (raw) => {
        const trimmed = raw.trim();
        const value = trimmed || field.resolvedDefault;
        setValues((v) => ({ ...v, [field.key]: field.transform ? field.transform(value) : value }));
        setInput("");
        setIndex((i) => i + 1);
    };

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="magenta">
                    ⚙ {spec.title}
                </Text>
            </Box>

            {queue.slice(0, index).map((done) => (
                <Box key={done.key} marginLeft={2}>
                    <Text color="green">✓ </Text>
                    <Text dimColor>
                        {done.label}: {displayValue(done, values[done.key])}
                    </Text>
                </Box>
            ))}

            <Box marginLeft={2}>
                <Text color="cyan">? </Text>
                <Text>{field.label} </Text>
                <TextInput
                    value={input}
                    onChange={setInput}
                    onSubmit={submit}
                    placeholder={String(field.resolvedDefault || "")}
                    mask={field.secret ? "*" : undefined}
                />
            </Box>
            <Box marginLeft={4}>
                <Text dimColor>enter accepts {field.resolvedDefault ? "the default" : "empty"}</Text>
            </Box>
        </Box>
    );
}

/** resolves lazy (function) defaults once, when the form mounts */
function resolveDefault(field) {
    return {
        ...field,
        resolvedDefault: typeof field.default === "function" ? field.default() : field.default,
    };
}

/** renders an answered value for the static list — masks secrets, joins arrays */
function displayValue(field, value) {
    if (field.secret) return value ? "••••••" : "(skipped)";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "(none)";
    return String(value || "(empty)");
}
