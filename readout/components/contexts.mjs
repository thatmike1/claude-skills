import { createContext, useContext } from "react";

/**
 * per-compile document state. holds the running section ordinal so each
 * <Section> gets a deterministic two-digit marker without prop threading.
 * mutated in document order during the single synchronous SSR pass.
 */
export const DocContext = createContext(null);

/**
 * ambient anchor scope: the current section slug plus per-type ordinal
 * counters. every commentable block reads this to build its data-anchor.
 * default scope is "root" for blocks rendered outside any <Section>.
 */
export const AnchorContext = createContext(null);

/**
 * flag set by <Callouts> so a nested <Callout> renders bare (the wrapper
 * already supplies the .callouts row). unset, a lone <Callout> wraps itself.
 */
export const CalloutsGroupContext = createContext(false);

/**
 * two-pass diff registry shared across the warm/real SSR passes. <Diff> reads
 * it to register its prerender promise on the first pass and to pull the
 * resolved HTML on the second. null outside a compile (e.g. plain SSR tests
 * that never mount RootProviders with a registry).
 */
export const DiffContext = createContext(null);

/**
 * fresh zeroed per-type counter set for a new anchor scope.
 * @returns {Record<string, number>} counter map
 */
export function freshCounters() {
    return {
        callout: 0,
        diagram: 0,
        code: 0,
        table: 0,
        keypoints: 0,
        diff: 0,
        checklist: 0,
        timeline: 0,
        stattiles: 0,
        filetree: 0,
    };
}

/**
 * allocate the next deterministic data-anchor id for a block of the given
 * type within the current section scope (e.g. "summary-callout-2"). returns
 * undefined only if no anchor scope is mounted (should not happen in compile).
 * @param {string} type one of callout|diagram|code|table|keypoints
 * @returns {string|undefined} anchor id
 */
export function useAnchor(type) {
    const scope = useContext(AnchorContext);
    if (!scope || !scope.counters) return undefined;
    scope.counters[type] += 1;
    return `${scope.slug}-${type}-${scope.counters[type]}`;
}
