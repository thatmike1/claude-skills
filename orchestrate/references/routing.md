# Routing model and effort

Project instructions and the user's named model take precedence over this reference.
The [bundled map](model-map.md) is evidence about benchmark performance, not authorization
to spend a quota, launch an unattended run or override a model choice.

## Resolve the seat

| Work | Seat and effort |
|---|---|
| Code and design, including scoped implementation | Opus 5.5 medium; high for harder work |
| Defined tasks, research, browser use, review of Claude code | GPT-6.1 Sol high; medium for browser and computer use |
| Bulk under a Codex lead | GPT-6.1 Terra: low for reads, medium for clearly specified small changes; lead reviews changes |
| Bulk under a Claude lead | Haiku 5.5 medium; high or xhigh for harder reads; keep tickets short |
| Research and reading sweeps under a Claude lead | Sonnet 5.5 high |
| Hard open or high-stakes decisions | Agree a council with Mike before starting |

Astra and Fable are used when Mike chooses them. Fable workers use medium.
Luna is reserved for huge trivial sieves. Max and ultra require a concrete reason.
The specific Terra bulk-read exception above does not make low the general default.
A small edit following an existing interface pattern is implementation, not a new design.

## FAST assessment, 4 November 2026

AA's page reports v5.0.1, while the free API calls it version `5`. The 28 October
Haiku assessment used v4.3 and must not be compared numerically with this refresh.

Terra medium scores 38.2 at $0.1688 per task on 10,875 output tokens. Haiku high
scores 29.9 at $0.1586 on 88,064 tokens. Terra low scores 29.4 at $0.0713 on
4,422 tokens. This supports Terra for the Codex-side FAST bulk seat. Haiku stays
the Claude-side narrow scout; research synthesis goes to Sonnet high. No new
FAST-mechanical agent file is needed: use an explicit target and the worker contract.

The old claim that Haiku high is 14 times cheaper than Sonnet high is stale.
Sonnet high is 41.5 at $1.636 per task on this refresh. Those are API costs;
output tokens alone do not price subscription usage, which may weight cached input too.

Terra's coding and agentic composite indices are unavailable, not zero. Its individual
Terminal-Bench and FrontierCode results are present, so "coding unmeasured" would be
wrong. There is no local Terra CLI timing run or verified browser trial. Its AA score
and token economy do not justify replacing Sol for browser work or Opus for code/design.
Haiku's three 9 October digests remain a dated field report, not a new reliability test.

## Dispatch and escalation

In T3 use [t3-workers.md](t3-workers.md): catalog IDs and explicit model options on
`delegate_task`. Outside T3 the bundled Claude role files are fallback defaults;
set the model and effort for the actual task rather than inheriting a frontier lead.
`orchestra-scout`'s Haiku/high pin remains suitable for harder narrow reads.

Give a worker a bounded question, original acceptance and owned files. An unsearched
area is unknown. If the worker reports missing context, clarify the ticket; if it
fails the task's quality bar, route to the appropriate seat above, preserving findings.
Do not escalate a policy refusal to another model. Review changes against the original
acceptance and run the project's checks. Cross-family review is useful: Sol reviews
Claude code. Availability, returned settings, self-reported identity and observed quality
are separate facts; log which one was actually checked.

Refresh the bundled map with `refresh.py`; `--fetch` first refreshes the canonical copy.
If data or the live evaluation formula is unavailable, report that gap before routing.
