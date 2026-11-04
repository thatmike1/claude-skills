# model map

Bundled copy of the canonical model map, synced by `./refresh.py` in this folder; do not edit it
here, the next sync overwrites it. Which model at which reasoning effort, judged on what it costs
to finish a task rather than on price per token. Data comes from Artificial Analysis, Design Arena
and Arena.ai.

## how to read it

A model appears once per reasoning effort, because effort changes cost more than the model choice
often does. The columns that matter:

- **$/task** is real money to complete one Intelligence Index task, reasoning tokens included.
  A model can be cheap per token and expensive per answer.
- **out tok/task** is output tokens burned per task, reasoning included. It drives the cost, the
  wait, and on a subscription it is the thing the quota is actually made of.
- **design / webdev** are human-preference Elo from Design Arena and Arena.ai. Neither is in the
  Intelligence Index, which measures reasoning and coding correctness and has nothing to say about
  whether the result looks like something a person would want to use.
- **~s/task** is out tok/task over tok/s. A floor on wall-clock that ignores time-to-first-token
  and multi-turn overhead, so treat it as a comparison scale rather than a prediction.

## what none of these boards measure

Three named blind spots. A model can be ahead on any of them and the table will not move.

**The agent harness.** The free model feed does not provide the separate Coding Agent
Index. A model's Intelligence Index, coding composite and performance inside a particular
agent harness are distinct results. Missing harness results remain unknown; a model-level
score establishes neither a floor nor a ceiling for an untested agent workflow.

**Code-authored 3D and CAD geometry.** Writing Blender Python that produces good geometry is not
reasoning correctness, is not a 2D design, and is not a web build, so the Intelligence Index,
Design Arena and Arena.ai WebDev are all blind to it. On one matched prompt - a low-poly taxi, run
through Fable 5.1 and Astra - Astra was clearly the better model: tyres with tread and sidewall
geometry against smooth discs, a fine mesh grille with a chrome surround against a few flat slats,
readable licence-plate text against a blank rectangle, mirrors on stalks, bumper overriders, and a
modelled interior visible through the glass. One prompt establishes that the axis exists and that
this map is blind to it. It does not measure a margin. A public benchmark for exactly this does
exist - 3DCodeBench (Google DeepMind, Google Research and USC, arXiv 2606.01057) with a live
human-preference 3DCodeArena - but as of 7 September 2026 its leaderboard has rated neither Astra
nor Opus 5 nor Fable 5.1, and its top entry, Fable 5, rests on 97 games with a 73-point confidence
interval. **Do not read a near-tied intelligence score as "interchangeable" for 3D work.**

**Anything a preference board votes on in one shot.** Design Arena votes on a single generated
design and Arena.ai's WebDev row is a multi-turn Codex-harness build. They put Astra seventh and
first respectively. That is not noise between them; they are measuring different jobs.

## current evidence, checked 4 November 2026

AA's live page reports v5.0.1; its free API labels the version `5`. Compare only
within this refresh. The v4.3 analysis is retained in
[the historical snapshot](research/v4.3-routing-snapshot.md), not used for routing.
The live registry has nine evaluations. In particular, Omniscience has 3,000 tasks,
FrontierCode 2.0 has 132, and CritPt uses its 40-task hard subset. Regeneration
fails if the registry cannot be recovered, rather than mixing new scores with an old formula.

Terra has all six effort rows, including non-reasoning. Intelligence, cost,
weighted token splits, speed and latency are available. Coding and agentic composite
indices are null for every Terra row. Individual coding evaluations are available:
for example Terra medium scores 32.3% on Terminal-Bench 4.0 and 34.5% on FrontierCode
2.0. Missing composites do not mean coding was never tested. Healthcare is available
only at max. Design Arena's Terra Elo is a family-level vote; Arena WebDev has no
Terra match. The WebDev refresh returned HTTP 403, so its cached date remains visible.
There is no local Terra CLI benchmark in `measured.json`, nor a verified browser trial.

Terra medium (38.2, $0.1688, 10,875 output tokens) is a stronger bulk-work candidate
than Haiku high (29.9, $0.1586, 88,064 tokens) on this index. Haiku remains the
Claude-side narrow-read option. This comparison is API economics, not a measurement
of subscription usage or task reliability. Codex credits weight input and cached
input too; output tokens alone do not determine the quota bill.

Mike's routing takes precedence: Opus 5.5 medium for code and design, high for harder
work; Sol high for defined tasks, research and review, medium for browser use;
Terra medium for clearly specified small changes and low only for bulk reads;
Haiku medium for Claude-side bulk, high for harder reads; Sonnet high for research
sweeps under Claude. Astra and Fable require Mike's choice. Luna is reserved for huge
trivial sieves. No benchmark here establishes a reason to change those rules.

Sources: [Terra release](https://artificialanalysis.ai/models/releases/gpt-6-1-terra),
[AA methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking),
the authenticated free API and the live evaluation-page registry captured in
`fixtures/aa-eval-registry-2026-11-04.js`. Raw results are summarized in
[the review](research/2026-11-04-review.md).

<!-- DATA -->

Artificial Analysis Intelligence Index v5, refreshed 2026-11-04. 97 available operating points, 63 of them in the current set defined by `focus.py`. Design and webdev columns are human-preference Elo from Design Arena and Arena.ai (board updated 2026-11-04); a `*` means the Elo is for the model family rather than that exact effort level, because those boards mostly vote without naming an effort setting. Regenerate with `./refresh.py`.

A `-` means unavailable, never zero. Zero is printed numerically. Time per task uses AA’s benchmark-weighted generation time, excluding latency and tool time. A `~` marks the fallback estimate, output tokens divided by the free feed’s median output tokens/s.

## the current set

| model | intel | coding | agentic | design | webdev | $/task | out tok/task | s/task |
|---|---|---|---|---|---|---|---|---|
| Claude Opus 5.5 (Max, Default Fallback) | 59.1 | - | - | 1325 * | 1814 | $10.036 | 173,313 | 1549 |
| Claude Opus 5.5 (Xhigh, Default Fallback) | 57.4 | - | - | 1325 * | - | $6.047 | 103,395 | 968 |
| GPT-6 Astra (Max) | 56.9 | - | - | 1336 | 1788 | $6.245 | 51,973 | 1093 |
| GPT-6 Astra (Xhigh) | 55.3 | - | - | 1333 * | - | $3.659 | 26,724 | 543 |
| GPT-6 Astra (High) | 54.8 | - | - | 1333 * | - | $3.239 | 23,133 | 462 |
| GPT-6.1 Sol (Max) | 54.6 | - | - | 1313 * | 1757 | $1.272 | 67,824 | 1205 |
| Claude Sonnet 5.5 (Max, Default Fallback) | 54.5 | - | - | 1319 * | - | $10.021 | 285,387 | 1835 |
| GPT-6.1 Sol (Xhigh) | 52.5 | - | - | 1313 * | - | $0.764 | 30,241 | 532 |
| Claude Opus 5.5 (High, Default Fallback) | 51.8 | - | - | 1325 * | - | $3.465 | 60,071 | 556 |
| GPT-6 Astra (Medium) | 51.6 | - | - | 1333 * | - | $2.732 | 18,052 | 354 |
| GPT-6.1 Terra (Max) | 51.3 | - | - | 1289 * | - | $0.961 | 59,883 | 761 |
| Gemini 4 Argon (High) | 50.4 | - | - | 1316 * | 1678 | $7.683 | 116,368 | 2041 |
| GPT-6.1 Sol (High) | 50.3 | - | - | 1313 * | - | $0.591 | 22,606 | 391 |
| Muse Wonder Full (Max) | 50.1 | - | - | - | - | - | 88,476 | - |
| Claude Fable 5.1 (Xhigh, Default Fallback) | 50.0 | - | - | 1308 * | - | $10.848 | 97,059 | 1158 |
| Claude Sonnet 5.5 (Xhigh, Default Fallback) | 49.9 | - | - | 1319 * | 1773 | $4.092 | 122,205 | 828 |
| Claude Fable 5.1 (Max, Default Fallback) | 49.2 | - | - | 1308 * | 1745 | $12.994 | 117,941 | 1345 |
| Claude Opus 5.5 (Medium, Default Fallback) | 48.2 | - | - | 1325 * | - | $2.451 | 43,817 | 403 |
| Claude Fable 5.1 (High, Default Fallback) | 47.2 | - | - | 1308 * | - | $7.540 | 66,031 | 768 |
| Kimi K3.1 Pro | 46.5 | - | - | 1326 * | - | $3.681 | 72,239 | 2251 |
| GPT-6.1 Sol (Medium) | 46.3 | - | - | 1313 * | - | $0.359 | 13,518 | 231 |
| GPT-6.1 Terra (Xhigh) | 45.3 | - | - | 1289 * | - | $0.401 | 26,200 | 348 |
| Muse Wonder (Max) | 43.6 | - | - | 1370 * | - | $6.952 | 96,063 | 709 |
| GPT-6 Astra (Low) | 43.3 | - | - | 1333 * | - | $1.424 | 9,126 | 186 |
| Claude Fable 5.1 (Medium, Default Fallback) | 43.2 | - | - | 1308 * | - | $5.564 | 48,545 | 580 |
| GPT-6.1 Terra (High) | 42.4 | - | - | 1289 * | - | $0.259 | 16,746 | 225 |
| Claude Sonnet 5.5 (High, Default Fallback) | 41.5 | - | - | 1319 * | 1716 | $1.636 | 58,421 | 418 |
| Claude Fable 5.1 (Low, Default Fallback) | 38.7 | - | - | 1308 * | - | $4.471 | 37,837 | 454 |
| GPT-6.1 Terra (Medium) | 38.2 | - | - | 1289 * | - | $0.169 | 10,875 | 151 |
| Claude Haiku 5.5 (Max) | 36.5 | - | - | 1261 * | - | $0.411 | 225,966 | 884 |
| Grok 4.7 (Xhigh) | 35.5 | - | - | 1248 * | 1638 | $7.771 | 104,531 | 1455 |
| Grok 4.7 (High) | 35.2 | - | - | 1248 * | - | $6.184 | 89,127 | 1258 |
| Claude Opus 5.5 (Low, Default Fallback) | 34.8 | - | - | 1325 * | - | $0.976 | 19,060 | 177 |
| GPT-6.1 Sol (Low) | 34.8 | - | - | 1313 * | - | $0.162 | 5,838 | 100 |
| Claude Haiku 5.5 (Xhigh) | 34.6 | - | - | 1261 * | - | $0.248 | 136,177 | 571 |
| Qwen3.8 Max (0902) | 33.7 | - | - | - | 1672 * | $10.024 | 170,794 | 3747 |
| GLM-5.3 (Max) | 31.7 | - | - | - | 1622 | $5.009 | 118,987 | 1743 |
| Grok 4.7 (Low) | 31.1 | - | - | 1248 * | - | $2.922 | 42,670 | 595 |
| Claude Sonnet 5.5 (Medium, Default Fallback) | 30.8 | - | - | 1319 * | - | $0.781 | 30,746 | 220 |
| Gemini 3.8 Flash (High) | 30.8 | - | - | 1300 * | 1583 | $7.766 | 98,940 | 870 |
| GPT-6.1 Terra (Non-reasoning) | 30.5 | - | - | 1289 * | - | $0.226 | 9,488 | 132 |
| Gemini 3.8 Flash (Medium) | 30.1 | - | - | 1300 * | - | $6.259 | 82,068 | - |
| Claude Haiku 5.5 (High) | 29.9 | - | - | 1261 * | - | $0.159 | 88,064 | 410 |
| GPT-6.1 Terra (Low) | 29.4 | - | - | 1289 * | - | $0.071 | 4,422 | 62 |
| MiniMax-M3.1-Flash | 29.1 | - | - | - | - | $0.491 | 138,176 | 1275 |
| GPT-6 Luna (Max) | 27.9 | - | - | 1268 * | 1582 | $0.152 | 75,296 | 733 |
| GLM-5.3-Flash | 27.8 | - | - | - | 1610 * | $0.583 | 134,205 | 2269 |
| Claude Sonnet 5.5 (Low, Default Fallback) | 25.6 | - | - | 1319 * | - | $0.511 | 20,856 | 150 |
| Claude Haiku 5.5 (Medium) | 24.6 | - | - | 1261 * | - | $0.092 | 53,335 | 237 |
| GPT-6 Luna (Xhigh) | 23.5 | - | - | 1268 * | - | $0.104 | 43,893 | 454 |
| DeepSeek V4 Pro 0813 (Max) | 23.1 | - | - | - | - | $1.769 | 98,733 | 1187 |
| GLM-5.3 (Low) | 23.1 | - | - | - | 1622 * | $1.575 | 51,986 | 848 |
| Gemini 3.8 Flash (Low) | 22.5 | - | - | 1300 * | - | - | - | - |
| GPT-6 Luna (High) | 21.4 | - | - | 1268 * | - | $0.073 | 32,839 | 339 |
| Qwen3.8 27B (Xhigh) | 20.1 | - | - | - | 1592 * | $3.530 | 109,802 | 2286 |
| MiniMax-M3 | 18.9 | - | - | 1256 * | 1482 * | $1.285 | 91,452 | 784 |
| Claude Haiku 5.5 (Low) | 18.6 | - | - | 1261 * | - | $0.044 | 28,161 | 129 |
| GPT-6 Luna (Medium) | 18.5 | - | - | 1268 * | - | $0.042 | 19,823 | - |
| Qwen3.8 27B (Medium) | 17.5 | - | - | - | 1592 * | $2.160 | 86,407 | 1644 |
| Qwen3.8 27B (Low) | 15.7 | - | - | - | 1592 * | $1.906 | 80,176 | 1556 |
| Qwen3.8 27B (Non-reasoning) | 10.0 | - | - | - | 1592 * | $3.773 | 44,867 | 1012 |
| GPT-6 Luna (Low) | 9.7 | - | - | 1268 * | - | $0.005 | 3,296 | 37 |
| GPT-6 Luna (Non-reasoning) | 9.4 | - | - | 1268 * | - | $0.071 | 10,059 | 108 |

## token efficiency

Sorted by output tokens spent per point of intelligence, cheapest first. On a subscription this describes output verbosity, not the full quota bill: input and cached input can carry different credit rates. Read the plan meter too.

`answer` is the response the caller receives and `reasoning` is the scratchpad, billed as output and then discarded. The share is how a vendor's effort dial is actually implemented, and it moves between generations of the same model without the dial names changing, so a jump in score at the same effort label is worth reading here before crediting it to the model.

| model | intel | out tok/task | answer | reasoning | reasoning % | intel per 10k out tok | $/task | access |
|---|---|---|---|---|---|---|---|---|
| GPT-6.1 Terra (Low) | 29.4 | 4,422 | 3,472 | 950 | 21% | 66.5 | $0.071 | ChatGPT sub |
| GPT-6.1 Sol (Low) | 34.8 | 5,838 | 4,253 | 1,585 | 27% | 59.6 | $0.162 | ChatGPT sub |
| GPT-6 Astra (Low) | 43.3 | 9,126 | 5,821 | 3,304 | 36% | 47.4 | $1.424 | ChatGPT sub |
| GPT-6.1 Terra (Medium) | 38.2 | 10,875 | 6,821 | 4,055 | 37% | 35.1 | $0.169 | ChatGPT sub |
| GPT-6.1 Sol (Medium) | 46.3 | 13,518 | 8,714 | 4,805 | 36% | 34.2 | $0.359 | ChatGPT sub |
| GPT-6.1 Terra (Non-reasoning) | 30.5 | 9,488 | 9,488 | 0 | 0% | 32.1 | $0.226 | ChatGPT sub |
| GPT-6 Luna (Low) | 9.7 | 3,296 | 2,594 | 702 | 21% | 29.4 | $0.005 | ChatGPT sub |
| GPT-6 Astra (Medium) | 51.6 | 18,052 | 9,471 | 8,581 | 48% | 28.6 | $2.732 | ChatGPT sub |
| GPT-6.1 Terra (High) | 42.4 | 16,746 | 9,129 | 7,618 | 45% | 25.3 | $0.259 | ChatGPT sub |
| GPT-6 Astra (High) | 54.8 | 23,133 | 11,042 | 12,092 | 52% | 23.7 | $3.239 | ChatGPT sub |
| GPT-6.1 Sol (High) | 50.3 | 22,606 | 12,471 | 10,135 | 45% | 22.3 | $0.591 | ChatGPT sub |
| GPT-6 Astra (Xhigh) | 55.3 | 26,724 | 12,031 | 14,693 | 55% | 20.7 | $3.659 | ChatGPT sub |
| Claude Opus 5.5 (Low, Default Fallback) | 34.8 | 19,060 | 12,196 | 6,864 | 36% | 18.3 | $0.976 | Claude sub |
| GPT-6.1 Sol (Xhigh) | 52.5 | 30,241 | 14,715 | 15,527 | 51% | 17.4 | $0.764 | ChatGPT sub |
| GPT-6.1 Terra (Xhigh) | 45.3 | 26,200 | 12,006 | 14,193 | 54% | 17.3 | $0.401 | ChatGPT sub |
| Claude Sonnet 5.5 (Low, Default Fallback) | 25.6 | 20,856 | 12,298 | 8,559 | 41% | 12.3 | $0.511 | Claude sub |
| Claude Opus 5.5 (Medium, Default Fallback) | 48.2 | 43,817 | 23,140 | 20,676 | 47% | 11.0 | $2.451 | Claude sub |
| GPT-6 Astra (Max) | 56.9 | 51,973 | 16,214 | 35,760 | 69% | 10.9 | $6.245 | ChatGPT sub |
| Claude Fable 5.1 (Low, Default Fallback) | 38.7 | 37,837 | 22,303 | 15,534 | 41% | 10.2 | $4.471 | Claude sub |
| Claude Sonnet 5.5 (Medium, Default Fallback) | 30.8 | 30,746 | 16,377 | 14,369 | 47% | 10.0 | $0.781 | Claude sub |
| GPT-6 Luna (Non-reasoning) | 9.4 | 10,059 | 10,059 | 0 | 0% | 9.3 | $0.071 | ChatGPT sub |
| GPT-6 Luna (Medium) | 18.5 | 19,823 | 8,781 | 11,043 | 56% | 9.3 | $0.042 | ChatGPT sub |
| Claude Fable 5.1 (Medium, Default Fallback) | 43.2 | 48,545 | 26,171 | 22,374 | 46% | 8.9 | $5.564 | Claude sub |
| Claude Opus 5.5 (High, Default Fallback) | 51.8 | 60,071 | 28,510 | 31,561 | 53% | 8.6 | $3.465 | Claude sub |
| GPT-6.1 Terra (Max) | 51.3 | 59,883 | 20,521 | 39,362 | 66% | 8.6 | $0.961 | ChatGPT sub |
| GPT-6.1 Sol (Max) | 54.6 | 67,824 | 18,611 | 49,213 | 73% | 8.1 | $1.272 | ChatGPT sub |
| Grok 4.7 (Low) | 31.1 | 42,670 | 20,996 | 21,674 | 51% | 7.3 | $2.922 | API only |
| Claude Fable 5.1 (High, Default Fallback) | 47.2 | 66,031 | 32,002 | 34,029 | 52% | 7.1 | $7.540 | Claude sub |
| Claude Sonnet 5.5 (High, Default Fallback) | 41.5 | 58,421 | 26,680 | 31,741 | 54% | 7.1 | $1.636 | Claude sub |
| Claude Haiku 5.5 (Low) | 18.6 | 28,161 | 12,881 | 15,280 | 54% | 6.6 | $0.044 | Claude sub |
| GPT-6 Luna (High) | 21.4 | 32,839 | 11,221 | 21,618 | 66% | 6.5 | $0.073 | ChatGPT sub |
| Kimi K3.1 Pro | 46.5 | 72,239 | 28,009 | 44,230 | 61% | 6.4 | $3.681 | Kimi plan |
| Muse Wonder Full (Max) | 50.1 | 88,476 | 33,796 | 54,679 | 62% | 5.7 | - | Muse Code plan |
| Claude Opus 5.5 (Xhigh, Default Fallback) | 57.4 | 103,395 | 39,632 | 63,763 | 62% | 5.6 | $6.047 | Claude sub |
| GPT-6 Luna (Xhigh) | 23.5 | 43,893 | 13,873 | 30,020 | 68% | 5.4 | $0.104 | ChatGPT sub |
| Claude Fable 5.1 (Xhigh, Default Fallback) | 50.0 | 97,059 | 41,116 | 55,942 | 58% | 5.2 | $10.848 | Claude sub |
| Claude Haiku 5.5 (Medium) | 24.6 | 53,335 | 21,244 | 32,091 | 60% | 4.6 | $0.092 | Claude sub |
| Muse Wonder (Max) | 43.6 | 96,063 | 37,479 | 58,584 | 61% | 4.5 | $6.952 | Meta API |
| GLM-5.3 (Low) | 23.1 | 51,986 | 16,324 | 35,661 | 69% | 4.4 | $1.575 | GLM plan |
| Gemini 4 Argon (High) | 50.4 | 116,368 | 48,067 | 68,301 | 59% | 4.3 | $7.683 | API only |
| Claude Fable 5.1 (Max, Default Fallback) | 49.2 | 117,941 | 46,554 | 71,387 | 61% | 4.2 | $12.994 | Claude sub |
| Claude Sonnet 5.5 (Xhigh, Default Fallback) | 49.9 | 122,205 | 43,206 | 78,999 | 65% | 4.1 | $4.092 | Claude sub |
| Grok 4.7 (High) | 35.2 | 89,127 | 30,944 | 58,183 | 65% | 3.9 | $6.184 | API only |
| GPT-6 Luna (Max) | 27.9 | 75,296 | 17,734 | 57,562 | 76% | 3.7 | $0.152 | ChatGPT sub |
| Gemini 3.8 Flash (Medium) | 30.1 | 82,068 | 34,840 | 47,228 | 58% | 3.7 | $6.259 | API only |
| Claude Opus 5.5 (Max, Default Fallback) | 59.1 | 173,313 | 52,853 | 120,460 | 70% | 3.4 | $10.036 | Claude sub |
| Grok 4.7 (Xhigh) | 35.5 | 104,531 | 35,090 | 69,441 | 66% | 3.4 | $7.771 | API only |
| Claude Haiku 5.5 (High) | 29.9 | 88,064 | 30,535 | 57,529 | 65% | 3.4 | $0.159 | Claude sub |
| Gemini 3.8 Flash (High) | 30.8 | 98,940 | 38,872 | 60,067 | 61% | 3.1 | $7.766 | API only |
| GLM-5.3 (Max) | 31.7 | 118,987 | 34,211 | 84,776 | 71% | 2.7 | $5.009 | GLM plan |
| Claude Haiku 5.5 (Xhigh) | 34.6 | 136,177 | 38,916 | 97,261 | 71% | 2.5 | $0.248 | Claude sub |
| DeepSeek V4 Pro 0813 (Max) | 23.1 | 98,733 | 38,024 | 60,709 | 61% | 2.3 | $1.769 | API only |
| Qwen3.8 27B (Non-reasoning) | 10.0 | 44,867 | 44,867 | 0 | 0% | 2.2 | $3.773 | Qwen plan |
| MiniMax-M3.1-Flash | 29.1 | 138,176 | 35,236 | 102,941 | 74% | 2.1 | $0.491 | API only |
| GLM-5.3-Flash | 27.8 | 134,205 | 31,620 | 102,585 | 76% | 2.1 | $0.583 | GLM plan |
| MiniMax-M3 | 18.9 | 91,452 | 45,381 | 46,071 | 50% | 2.1 | $1.285 | API only |
| Qwen3.8 27B (Medium) | 17.5 | 86,407 | 29,207 | 57,201 | 66% | 2.0 | $2.160 | Qwen plan |
| Qwen3.8 Max (0902) | 33.7 | 170,794 | 51,096 | 119,698 | 70% | 2.0 | $10.024 | Qwen plan |
| Qwen3.8 27B (Low) | 15.7 | 80,176 | 29,653 | 50,523 | 63% | 2.0 | $1.906 | Qwen plan |
| Claude Sonnet 5.5 (Max, Default Fallback) | 54.5 | 285,387 | 79,025 | 206,362 | 72% | 1.9 | $10.021 | Claude sub |
| Qwen3.8 27B (Xhigh) | 20.1 | 109,802 | 37,438 | 72,364 | 66% | 1.8 | $3.530 | Qwen plan |
| Claude Haiku 5.5 (Max) | 36.5 | 225,966 | 53,151 | 172,814 | 76% | 1.6 | $0.411 | Claude sub |

## what a subscription actually buys

`tasks/week` converts each plan's own quota unit into Index tasks using the measured token profile of the model that plan actually serves. An Index task is a heavy agentic job - roughly a million input tokens, mostly cached, against 20-45k of output - so figures in the tens to low hundreds per week are the expected shape. Alibaba meters model calls rather than tokens and cannot be derived this way.

Read the `ratio` column as a lie detector rather than a discount. It is what the plan charges per task against what the same model costs on its own API. Three to ten times cheaper is the normal range for buying capacity in bulk. Moonshot's 60x is not a bargain, it is a signal that the community token estimate behind it is too generous - Moonshot publishes no quota at all, so that row rests on reverse engineering. Z.ai is the only vendor here that documents its own meter.

The two western plans are new and asymmetric. OpenAI publishes its meter in full - Codex bills credits per token at a per-model rate that is exactly 25 credits per dollar of list API price - but not the size of the included allowance, which is derived here from one Pro 20x telemetry report and cross-checks against OpenAI's own message bands. Treat the resulting 19-47x ratios with the suspicion this column is for: either those plans are subsidised far past the normal range, or the derived allowance is too generous. Anthropic publishes no quota in any unit for Pro or Max, and bills overage at plain API rates rather than through an invertible credit, so the Claude rows carry no tasks/week rather than a guess.

Two assumptions worth knowing. Plans quoted per five-hour window are converted at fifteen windows a week, which is a working week rather than the theoretical maximum of about thirty-three. And Z.ai weights output at 24 credits a token against 1.7 for cached input, so its advertised 43-87M tokens a week on Lite only holds while output stays near one to two percent of all tokens; measured Index tasks land at two to seven percent, which is why the derived figure sits below the advertised one. See `research/subscriptions.md` for sourcing and `plans.py` for the arithmetic.

| plan | $/mo | meter | tasks/week | plan $/task | same model on API | ratio | confidence |
|---|---|---|---|---|---|---|---|
| ChatGPT Plus | $20 | credits-openai | 34 | $0.137 | $3.239 | 24x | meter official; allowance derived, one report contradicts it |
| ChatGPT Pro 5x | $100 | credits-openai | 170 | $0.137 | $3.239 | 24x | meter official; allowance derived, one report contradicts it |
| ChatGPT Pro 20x | $200 | credits-openai | 670 | $0.068 | $3.239 | 47x | meter official; allowance derived, one report contradicts it |
| ChatGPT Business | $25 | credits-openai | 34 | $0.171 | $3.239 | 19x | meter official; allowance assumed equal to Plus, same caveat |
| Claude Max 5x | $100 | undisclosed | - | - | $3.465 | - | no quota published in any unit; not derivable |
| Claude Max 20x | $200 | undisclosed | - | - | $3.465 | - | no quota published in any unit; not derivable |
| GLM Coding Lite | $18 | credits | 3 | $1.313 | $5.009 | 4x | quota official, price secondary |
| GLM Coding Pro | $80 | credits | 19 | $0.973 | $5.009 | 5x | quota official, price secondary |
| GLM Coding Max | $168 | credits | 44 | $0.876 | $5.009 | 6x | quota official, price secondary |
| Token Plan Plus | $20 | tokens | 23 | $0.203 | $1.285 | 6x | secondary only; minimax's own docs url 404s |
| Token Plan Max | $50 | tokens | 70 | $0.164 | $1.285 | 8x | secondary only |
| Kimi Moderato | $19 | tokens | - | - | - | - | quota is community reverse-engineering, not published |
| Kimi Allegretto | $39 | tokens | - | - | - | - | quota is community reverse-engineering |
| Qwen Coding Plan Pro | $50 | requests | - | - | - | - | fully documented by alibaba |

Superseded and out-of-scope models are not listed here. They are in `picker.html`, behind the tier filter.
