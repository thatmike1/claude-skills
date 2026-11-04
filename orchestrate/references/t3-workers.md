# T3 child tasks

Start with `orchestrator_capabilities`. It returns provider instances, current models,
option descriptors, inherited options and available features. Use `search` for models
omitted from the short list. A catalog entry establishes availability, not benchmark quality.

Dispatch through `delegate_task` with an explicit `target.providerInstanceId`, `target.model`
and supported `target.options`. Codex uses `reasoningEffort` and optionally `serviceTier`;
Claude uses `effort` and optionally `fastMode`. Read the live descriptors, including allowed
values. Check the returned provider, model and options. A prompt asking for an effort is
not an effort setting. Claude role-file frontmatter does not configure a T3 task.

Use a unique `clientRequestId` per dispatch round, stable across retries of that round.
Retain `taskId` in the ledger; inspect with `task_status` and cancel with `task_cancel`.
Use bounded status checks. For isolated edits, `isolation:"worktree"` starts from the
parent's local commit and runs project setup; uncommitted parent edits are not copied.
Include the role contract and owned files in the task, since a role name alone does not
load a Claude agent file. Child tasks stay visible under the parent thread.

A review or fix round is a new `delegate_task`: carry the original brief, prior findings,
responses and unresolved objections. The returned `childThreadId` is backing storage,
not a continuation target. Top-level launch tools create independent conversations and
are reserved for a request for a separate thread, not ordinary delegation.

If T3 tools are lazily exposed, make one direct capabilities attempt. If the ACP runtime
provides `T3_ACP_MCP_NODE`, its supported `acp-mcp-call` transport can reach the same tools.
Use the runtime's documented invocation. A shell-launched model process is not that transport.
Outside T3, [codex-workers.md](codex-workers.md) documents the standalone CLI workflow.

Verified against the live T3 tool schemas and capabilities on 4 November 2026.
