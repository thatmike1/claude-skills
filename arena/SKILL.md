---
name: arena
description: "Give several T3 child candidates the same prompt, rank them against a rubric written before they run, pick a base and graft the best of the rest into it. Run with /arena when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Ported from pstack's arena ([cursor/plugins](https://github.com/cursor/plugins), MIT, Lauren Tan) for T3, where every candidate is a child task Mike can open and steer.

The arena's shape is **one contract, many candidates, a rubric they never see**. Reach for a sibling when the shape differs:

- different pieces of work split across workers: `/orchestrate`
- a command that scores each try in seconds: `/swarm`
- the open question is which approach, before anything can be built: `/council`

## 1. Frame

Make a run directory, `/tmp/arena-<slug>/`, and write three files there before anything spawns.

1. `rubric.md`: the artifact in one line, then 3 to 6 criteria, each gradeable from the artifact alone (a check you can run, or a property you can point at in the diff). When the right answer is computable (expected outputs, a list the change must produce), compute it now into `ground-truth.*`. Candidates never see the rubric; it is the picker's tool, and showing it turns the run into teaching to the test.
2. `prompt.md`: the **contract**, sent verbatim to every candidate. It names the repo and files, the done condition and how to verify it, and ends with the return shape: where the work lives (`pwd` for a worktree, or the output path), the full diff or artifact, the verification command with its output verbatim, and three to five sentences on the alternatives it considered and rejected. Those rejected alternatives are graft material later.
3. The seats: three candidates by default. Get live model ids from `orchestrator_capabilities` and set model and effort per candidate. Use the same model three times when the work is mostly generation; mix models or families when it turns on judgment or several design directions are in play.

A candidate that edits a repo gets `isolation: "worktree"`, its own checkout from the current local commit, so commit or stash first. A standalone artifact goes to `/tmp/arena-<slug>/candidate-<n>/`, named in that candidate's copy of the prompt.

## 2. Fan out

Spawn every candidate in one message: one `delegate_task` each, `mode: "async"`, `role: "implementation"`, the contract as `task`, `title: "arena <slug> c<n>"`, `clientRequestId: "<slug>-c<n>"`. Write the returned task ids into a ledger or checkpoint, then end the turn: T3 wakes the thread as each child finishes. Read results with `task_status`, and judge nothing until every candidate is back. A candidate that fails or returns nothing drops out; carry on with the rest and record the dropout.

## 3. Cross-judge

Once all candidates are back, spawn one read-only judge from a different model family than the candidates, so the judge does not share their blind spots. Under a Claude lead with Claude candidates that is `gpt-6.1-sol` at high effort on the `codex` provider. Its task: the rubric, the ground truth, each candidate by label with its worktree or output path, score every criterion for every candidate with evidence, recommend a base, change nothing. Read the candidates yourself while it runs.

When no other family is reachable, the judge is a fresh-context model of the same family, or there is none and the pick is yours alone. The synthesis note says which.

## 4. Pick a base

Read every candidate end to end (`git -C <worktree> diff` for repo work) and run the rubric's checks against each yourself; a candidate's own verification output is a claim. Score criterion by criterion, never on overall feel. If you and the judge agree on the base, that confirms it. If not, one of you is biased or the rubric was ambiguous: reread both rationales, decide, and record why.

The base is the candidate the next maintainer can extend most easily without breaking invariants. On a tie, take the smaller diff or the cleaner boundary.

## 5. Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things each and never most of it. Rewrite each graft into the base by hand so the result reads as one design rather than a paste.

When the candidates converge on one shape, that is strong agreement: ship it with no graft. When they diverge wildly, the contract was under-specified: rewrite `prompt.md` and run again rather than averaging them.

## 6. Verify and land

Apply the synthesized change in the real tree, rerun every rubric check and the project's own tests there, and commit. When verification finds something the arena missed, either the frame was wrong (rewrite and rerun) or a candidate had it and the graft missed it (back to step 5).

The commit body, PR or bead comment carries the **synthesis note**: the base and why, the judge's verdict or why there was none, each graft with its source candidate, each rejected candidate and why, any convergence or dropout, and the verification result.

[`references/worked-example.md`](references/worked-example.md) is one full run on a real change, every file and score included.
