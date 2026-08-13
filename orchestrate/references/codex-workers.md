# Codex workers: probe, consent, invoke, read back

OpenAI's Codex CLI is an optional accelerator — never a requirement. When present and consented, it adds a second family of worker seats.

## The probe (once per session, cache the result)

```bash
command -v codex                                   # 1. installed?
codex login status                                 # 2. authenticated? which billing mode?
test -s "${CODEX_HOME:-$HOME/.codex}/auth.json"    # 2b. fallback if the subcommand errors
```

- Step 2 is the documented status command; its output also tells you **how the account is billed** (ChatGPT subscription vs API key). If the subcommand itself fails to run (auth subcommands have been renamed across Codex releases before), the credential-file fallback proves only that credentials *exist* — it cannot tell you the billing mode. In that case the mode is **unknown**: say so, and require explicit user confirmation before any billable call. (Honor `$CODEX_HOME`; some setups store credentials in an OS keyring, where only the status command is reliable.)
- **Do not use the GNU `timeout` command** — it doesn't exist on stock macOS or Windows. Use your shell tool's own timeout parameter, set generously (60s+): a slow response is latency, not absence.

## Consent and billing (before any model call)

The probe above is metadata-only and free. An actual Codex invocation **spends the user's OpenAI account** — subscription quota, or real metered dollars on an API key. Before the first dispatch:

1. Tell the user Codex is available and which billing mode `login status` reported.
2. Confirm they want Codex in the rotation — unless they already asked for Codex this session, which is consent.
3. Record the consent (and mode) in the ledger.

Only after consent, run the functional check — one tiny call, cheapest tier you can name confidently or the account default: `codex exec "Reply with exactly: ok"`. If it fails while credentials exist, they're likely expired: tell the user to run `codex login`; never initiate an interactive auth flow yourself.

## Discovering the account's tiers

Documentation is not entitlement, and **model IDs differ by auth mode** — this repo's own first review dispatch bounced because an API-doc model ID (`gpt-5.6`) wasn't valid for a ChatGPT-account login (which wanted `gpt-5.6-sol`). Procedure:

1. Read `${CODEX_HOME:-$HOME/.codex}/config.toml` — the user's configured `model` and `model_reasoning_effort` are their expressed preference; identify what that model *is* before classifying it.
2. Ask the user, or check `codex` interactive `/model` output, for the tiers their account actually offers.
3. Before relying on any tier in a long run, verify it with one tiny echo call. A tier that fails entitlement goes in the ledger as unavailable.

Map verified tiers to FRONTIER / WORKHORSE / FAST by the provider's published positioning for them (routing.md), and record the mapping in the ledger so it's auditable.

## Invocation pattern

Non-interactive, one task per invocation, seat and effort pinned per the routing decision:

```bash
# Advisory / review work — read-only sandbox:
codex exec -m <verified-model> -c model_reasoning_effort=<level> \
  --sandbox read-only -C <repo-path> - < .orchestra/scratch/ticket-N.md

# Implementation work — writable workspace:
codex exec -m <verified-model> -c model_reasoning_effort=<level> \
  --sandbox workspace-write -C <repo-path> - < .orchestra/scratch/ticket-N.md
```

- Write the ticket to a file and pipe via stdin (`- <`) — avoids shell-quoting bugs.
- Sandbox follows the *task* (advisory vs implementation), not the seat.
- `--json` emits a JSONL event stream if you need structured events; otherwise the final message arrives on stdout.
- Long tasks run in the background: **record the job ID and output file path in the ledger at dispatch time**, capture the exit code on collection, and apply the LOST-worker protocol (delegation.md) if it goes silent. Never foreground-block the session on a long build.

## Reading back

Codex workers follow the same contract as Claude workers: **status as the first line of the final message** (`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED` — put this in every execution ticket's OUTPUT FORMAT), evidence not narrative, artifacts to `.orchestra/scratch/` with paths. A Codex read-only reviewer acting as the verifier is the one exception: it leads with the verifier verdict (`PASS` / `FAIL` / `PASS_WITH_NOTES`) per verification.md. Treat Codex self-reports with the same distrust as any worker's — independent evaluators have measured frontier tiers gaming checks at record rates. Cross-family verification (Claude verifies Codex work) is the default.

## Quota notes

- Codex plans meter usage in rolling windows, with cheaper tiers typically draining the shared pool more slowly and often enjoying higher message allowances — but verify against the user's plan rather than promising numbers.
- Rate limits are per-account: more parallel workers ≠ more throughput. Sequential-by-default applies here too.
- Rate-limit errors mid-run: don't burn retries — fall back to the Claude seat of the same class for the remainder and note it in the ledger.
