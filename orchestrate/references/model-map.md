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

**The agent harness.** Every Intelligence Index number here is the bare API model with no
scaffold. Artificial Analysis runs a second index, the Coding Agent Index, which scores a model
inside its real harness, and the two disagree sharply about Astra: 54.7 on v4.2 of this index, against 67 in Codex,
which AA reports as roughly level with Claude Opus 5 and Fable 5 in Claude Code, with Fable 5.1 in
Claude Code leading at 70. The Coding Agent Index is not in the free API feed, so this map cannot
carry it. **Read a bare-API agentic score as a floor for a model you will actually run in an
agent, not as its ceiling.**

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

## the index moved to v4.3, so old numbers do not compare

Artificial Analysis moved the Intelligence Index to v4.3 between 7 and 23 September 2026.
Terminal-Bench 4.0 (66 tasks) replaced Terminal-Bench 2.1, and AutomationBench (657 tasks)
replaced tau-Banking; every weight stayed where v4.2 put it. The harder terminal set moved the
table again: Fable 5.1 at max fell from 56.8 to 53.4, Opus 5 at max from 54.1 to 50.8, Astra at
max from 54.7 to 52.7, Kimi K3 from 50.2 to 43.6 and GLM-5.2 from 42.5 to 33.7. Output tokens per
task rose by a fifth to a third (Opus 5 at max from 56,489 to 72,511). The separate coding and
agentic indices did not move. **Never compare a number here with one written before 23 September
2026**, and v4.2 numbers themselves did not compare with v4.1.

The parser read v4.3 cleanly: the live spec was recovered from the page, the stderr line reported
the change, and the recovered formula reproduces Artificial Analysis's own published cost per task
to within 1% on all 151 priced models. The lesson from the v4.2 rework still stands. The baked-in
fallback spec is the dangerous path, because it produces plausible last-generation numbers without
failing; it now holds the v4.3 spec, and the stderr warning in `parse_eval_spec` is the tripwire.

## two economies, and they rank models differently

Paying per token, the number to minimise is **$/task**. Buying a subscription, the money is flat
and already spent, so the scarce resource is quota, and every one of these plans meters quota in
tokens. That makes **out tok/task** the deciding number, and it produces a different order.

The clearest way to see it is output tokens per point of intelligence. GPT-6 Astra at low spends
97 and GPT-6 Sol at low 99, the best in the current set. Astra at medium spends 193, Astra at high
232, Opus 5.5 at low 240. Opus 5.5 at medium spends 503, Opus 5 at medium 647, Opus 5.5 at high
664, Fable 5.1 at high 743, Kimi K3 1,111, GLM-5.3 1,588, Opus 5.5 at max 2,069, and Sonnet 5 at
max 3,083, the worst.

## what the current data says

**Opus 5.5 is the top of the index, and it beats Opus 5 at every effort level.** 57.6 at max and
56.0 at xhigh, against 53.4 for Fable 5.1 at max, the previous leader. Rung for rung against
Opus 5 it gains 2.9 at low, 6.4 at medium, 5.5 at high, 6.3 at xhigh and 6.8 at max. Opus 5.5 at
medium (51.2, $1.336, 25,745 tokens) already beats Opus 5 at max (50.8, $5.858, 72,511 tokens).
Opus 5.5 at high (53.6, $1.823) matches Fable 5.1 at max (53.4, $7.630) for a quarter of the money
and under half the tokens. Anthropic's launch claim that it performs at Fable 5.1's level on most
work holds on this index.

**It is cheaper per task than Opus 5 everywhere except max.** List price fell to $4 and $20 per
million tokens from $5 and $25, and cache reads to $0.20 from $0.50. From low to high it also
spends fewer tokens than Opus 5 (31% fewer at low, 11% at medium, 23% at high), so a task costs
39-50% less. Xhigh spends 8% more tokens and still costs 29% less.

**Max is the one rung to avoid.** 119,166 output tokens a task, 70% of them reasoning, the most of
any current row and 64% more than Opus 5 at max. It buys 1.6 points over xhigh for 73% more money
and 81% more tokens. Simon Willison hit the 128K output cap twice at max on a single prompt, still
reasoning. On a subscription this is the fastest quota drain in the table.

**Its ladder has a different shape from Opus 5's.** 42.3, 51.2, 53.6, 56.0, 57.6 from low to
max, at $0.55, $1.34, $1.82, $3.46 and $5.98. Low to medium is the big step (+8.9 points); medium
to high buys 2.4 for 36% more; high to xhigh another 2.4 for 90% more. Medium is the value rung
and high the knee; low is a cliff, under Astra at low on more than twice the tokens. Claude Code
now defaults Opus 5.5 to medium, where Opus 5 defaulted to high.

**What is not measured yet.** Artificial Analysis has not published coding or agentic indices for
Opus 5.5, neither preference board has rated it, and the max row has no speed reading. Opus 5
held the best agentic score outside Fable 5.1 (56.5), so whether 5.5 keeps that lead is open.
Anthropic's own Terminal-Bench 4.0 figure at xhigh is 66.4% against 52.3% for Opus 5 and 55.8% for
Fable 5.1, which is a vendor number, not this map's.

**Astra is still the token-efficiency model, but it no longer wins on money.** At the low end it
is untouched: 45.8 on 4,433 tokens against Opus 5.5 low's 42.3 on 10,151. Higher up, Opus 5.5 at
high beats Astra at max on score (53.6 against 52.7) and money ($1.823 against $3.257), losing only
on tokens (35,584 against 27,206). Opus 5.5 at xhigh costs about what Astra at max does and scores
3.3 more, on 2.4 times the tokens. On a token-metered plan Astra keeps its argument; paying per
token, Opus 5.5 now takes it.

**The two preference boards still disagree about Astra.** Arena.ai's WebDev board puts
`gpt-6-astra-max` first at 1793 Elo, 38 above Fable 5.1 at max and 102 above Opus 5 at max. Design
Arena's website board puts it at 1315, under Kimi K3 (1351), both GPT-5.6 Sol rows, Fable 5.1
(1320) and Opus 5 (1319). Arena's row is a Codex-harness run over a multi-turn build; Design Arena
votes on a single generated design.

**GPT-6 Sol is a new model that lands on GPT-5.6 Sol's index score at half the price.** 47.5 at
max against 47.0, and within 0.6 at every rung, but the per-benchmark runs are separate and the
shape differs. Terminal-Bench 4.0 is up (43.9% against 39.9% at max, 30.3% against 24.7% at
xhigh) and AA-Omniscience is up (27.1 against 22.0); GDPval is down about 100 Elo (1487 against
1588) and HLE and CritPt are a point lower. List price halved to $2 and $10, and from low to xhigh
it spends fewer tokens too, so a task costs $1.056 at max against $1.988 and $0.375 at high
against $0.808. Its coding and agentic indices are not published yet, so the coding case for Sol
still rests on GPT-5.6 Sol's 78.3 at xhigh.

**GPT-6 Luna is the same story one tier down.** 37.3 at max, identical to GPT-5.6 Luna, for
$0.068 against $0.178, though it spends 23% more output tokens getting there (50,537 against
41,235). Coding and agentic are unpublished here too.

**Fable 5.1 lost the intelligence lead and still costs the most.** It still tops the coding (81.6)
and agentic (57.9) indices of everything measured on them, which Opus 5.5 is not yet. Its max row
is the most expensive in the set at $7.630 a task.

**Sonnet 5.5 (28 Sep 2026) is the first Sonnet worth routing to, at two rungs only.** Same $2/$10
price as Sonnet 5. At high it scores 46.7 for $1.080 on 34,467 tokens, 4.5 points under Opus 5.5
at medium (51.2, $1.336) for 19% less; at low it is the cheapest Claude cell (35.8, $0.414). Both
sit on the cost frontier. Medium is not: Opus 5.5 at low beats it on score and cost. Above high
it collapses: xhigh (51.9, $2.743) loses to Opus 5.5 at high, and max ties Opus 5.5 at xhigh
(56.0) on 192,838 tokens for $7.603, the hungriest row in the set. Anthropic's own launch numbers
put it ahead of Opus 5.5 on Terminal-Bench 4.0 (70.6% against 66.4%); AA has not published coding
or agentic indices for either yet, so the terminal-work case rests on vendor numbers until then. Measured here on 29 Sep with
`claude-bench` (900-word essay, no tools): Sonnet 5.5 generates at 114 and 129 tok/s against Opus
5.5's 73, but spent 1,700-1,900 thinking tokens against Opus's 145, so both finished in about 30
seconds. Theo Browne's API readings (about 94 against 70) and his Blender run (Sonnet 43 minutes,
Opus 36) point the same way: faster per token, not faster per task. Its cache reads cost the same
$0.20 per million as Opus, so long agentic sessions erase the price gap; its value is as a
read-and-report subagent, where it tied Opus on Theo's codebase-analysis bench for half the cost.
Low is weak on both Claude models and max multiplies tokens, so neither belongs in a routing rule.

**Sonnet 5 is dominated by both Opus models at every point.** 38.2 for $5.091 and 117,787 output
tokens at max, against Opus 5.5 at low reaching 42.3 for $0.551 on 10,151.

**The open-weight models are no longer cheap per task against Opus.** GLM-5.3 is the big jump in
that group, 44.8 at max against GLM-5.2's 33.7, with an agentic 53.1 above Opus 5 at high. But at
$2.006 and 71,128 tokens a task it now costs more than Opus 5.5 at high for 8.8 fewer points, and
Z.ai's plan meters output at 24 credits a token. Qwen3.8 Max (0902) spends 107,730 tokens and
$5.409 to score 45.4.

**Kimi K3's case is still design, and it is narrowing.** 1351 on Design Arena's website board,
first among current models but now under Muse Spark 1.3 (1365), which is out of scope here. It
scores 43.6 on the index. Moonshot still publishes no quota, so every tasks-per-week figure for it
rests on community reverse-engineering.

<!-- DATA -->

Artificial Analysis Intelligence Index v4.3, refreshed 2026-09-29. 177 measured operating points, 65 of them in the current set defined by `focus.py`. Design and webdev columns are human-preference Elo from Design Arena and Arena.ai (board updated 2026-09-29); a `*` means the Elo is for the model family rather than that exact effort level, because those boards mostly vote without naming an effort setting. Regenerate with `./refresh.py`.

## the current set

| model | intel | coding | agentic | design | webdev | $/task | out tok/task | ~s/task |
|---|---|---|---|---|---|---|---|---|
| Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback) | 57.6 | - | - | 1361 * | 1827 | $5.982 | 119,166 | 1283 |
| Claude Sonnet 5.5 (Adaptive Reasoning, Max Effort, Default Fallback) | 56.0 | - | - | - | - | $7.603 | 192,838 | 1391 |
| Claude Opus 5.5 (Adaptive Reasoning, Xhigh Effort, Default Fallback) | 56.0 | - | - | 1361 * | - | $3.459 | 65,667 | 826 |
| Claude Opus 5.5 (Adaptive Reasoning, High Effort, Default Fallback) | 53.6 | - | - | 1361 * | - | $1.823 | 35,584 | 473 |
| Claude Fable 5.1 (Adaptive Reasoning, Max Effort, Default Fallback) | 53.4 | 81.6 | 57.9 | 1319 * | 1751 | $7.630 | 78,111 | 1140 |
| Claude Fable 5.1 (Adaptive Reasoning, Xhigh Effort, Default Fallback) | 53.2 | 80.7 | 57.2 | 1319 * | - | $5.978 | 60,538 | 1080 |
| GPT-6 Astra (max) | 52.7 | 76.9 | 51.0 | 1311 * | 1792 | $3.257 | 27,206 | 460 |
| GPT-6 Astra (xhigh) | 52.4 | 75.9 | 50.2 | 1311 * | - | $2.309 | 16,901 | 330 |
| Claude Sonnet 5.5 (Adaptive Reasoning, Xhigh Effort, Default Fallback) | 51.9 | - | - | - | - | $2.743 | 73,724 | 650 |
| Claude Fable 5.1 (Adaptive Reasoning, High Effort, Default Fallback) | 51.2 | 79.1 | 53.1 | 1319 * | - | $3.913 | 38,054 | 715 |
| Claude Opus 5.5 (Adaptive Reasoning, Medium Effort, Default Fallback) | 51.2 | - | - | 1361 * | - | $1.336 | 25,745 | 343 |
| GPT-6 Astra (high) | 50.9 | 77.1 | 48.2 | 1311 * | - | $1.725 | 11,813 | 235 |
| Claude Opus 5 (Adaptive Reasoning, Max Effort) | 50.8 | 78.0 | 56.5 | 1317 * | 1693 | $5.858 | 72,511 | 1238 |
| Claude Opus 5 (Adaptive Reasoning, Xhigh Effort) | 49.7 | 77.0 | 55.6 | 1317 * | - | $4.878 | 60,655 | 1145 |
| GPT-6 Astra (medium) | 49.6 | 76.7 | 46.0 | 1311 * | - | $1.541 | 9,590 | 194 |
| Claude Fable 5.1 (Adaptive Reasoning, Medium Effort, Default Fallback) | 48.9 | 77.1 | 50.2 | 1319 * | - | $2.983 | 27,888 | 542 |
| Claude Opus 5 (Adaptive Reasoning, High Effort) | 48.1 | 76.5 | 52.3 | 1317 * | 1662 | $3.613 | 46,239 | 835 |
| GPT-6 Sol (max) | 47.5 | - | - | 1278 * | 1681 | $1.049 | 31,054 | 391 |
| Claude Fable 5.1 (Adaptive Reasoning, Low Effort, Default Fallback) | 46.8 | 75.2 | 47.1 | 1319 * | - | $2.371 | 21,562 | 425 |
| Claude Sonnet 5.5 (Adaptive Reasoning, High Effort, Default Fallback) | 46.7 | - | - | - | - | $1.080 | 34,467 | 370 |
| Grok 4.7 (xhigh) | 46.4 | - | - | 1224 * | 1629 | $3.738 | 80,561 | 1084 |
| Grok 4.7 (high) | 46.3 | - | - | 1224 * | - | $2.726 | 65,901 | 859 |
| GPT-6 Astra (low) | 45.8 | 75.7 | 38.8 | 1311 * | - | $0.818 | 4,433 | 88 |
| Qwen3.8 Max (0902) | 45.4 | 76.2 | 56.0 | - | 1672 * | $5.409 | 107,730 | 2822 |
| GLM-5.3 (max) | 44.8 | 74.8 | 53.1 | - | 1619 | $2.006 | 71,128 | 819 |
| Claude Opus 5 (Adaptive Reasoning, Medium Effort) | 44.8 | 74.3 | 46.2 | 1317 * | - | $2.189 | 28,977 | 532 |
| GPT-6 Sol (xhigh) | 44.1 | - | - | 1278 * | - | $0.524 | 15,894 | 208 |
| Kimi K3 (max) | 43.6 | 76.2 | 50.0 | 1345 * | 1660 | $2.000 | 48,455 | - |
| GPT-6 Sol (high) | 42.8 | - | - | 1278 * | - | $0.375 | 10,319 | 141 |
| Claude Opus 5.5 (Adaptive Reasoning, Low Effort, Default Fallback) | 42.3 | - | - | 1361 * | - | $0.551 | 10,151 | 137 |
| GPT-5.6 Terra (max) | 42.1 | 76.7 | 43.2 | 1277 * | - | $1.399 | 38,897 | 395 |
| Gemini 3.8 Flash (high) | 40.9 | 76.3 | 40.2 | 1308 * | 1580 | $1.243 | 71,003 | 297 |
| Claude Sonnet 5.5 (Adaptive Reasoning, Medium Effort, Default Fallback) | 40.7 | - | - | - | - | $0.586 | 19,488 | 187 |
| Qwen3.8 Max | 40.2 | 71.8 | 49.1 | 1283 * | 1672 * | $2.670 | 62,782 | 1690 |
| Qwen3.8 2.4T A95B | 39.9 | 71.9 | 50.1 | - | - | $2.156 | 68,602 | 1790 |
| Gemini 3.8 Flash (medium) | 39.8 | 74.1 | 39.7 | 1308 * | - | $0.931 | 52,599 | - |
| GPT-6 Sol (medium) | 39.8 | - | - | 1278 * | - | $0.247 | 6,442 | - |
| Qwen3.8-Flash-Next | 39.8 | 73.1 | 53.6 | - | 1636 * | $0.372 | 107,885 | 1858 |
| Claude Opus 5 (Adaptive Reasoning, Low Effort) | 39.4 | 66.9 | 36.0 | 1317 * | - | $1.098 | 14,668 | 284 |
| GPT-5.6 Terra (xhigh) | 38.0 | 70.6 | 41.4 | 1277 * | - | $0.632 | 20,367 | 230 |
| GPT-6 Luna (max) | 37.3 | - | - | 1280 * | 1593 | $0.068 | 50,213 | 343 |
| DeepSeek V4 Pro 0813 (Reasoning, Max Effort) | 36.0 | 68.8 | 41.3 | 1242 * | 1582 * | $0.674 | 55,154 | 663 |
| Claude Sonnet 5.5 (Adaptive Reasoning, Low Effort, Default Fallback) | 35.8 | - | - | - | - | $0.414 | 13,894 | 163 |
| DeepSeek V4 Flash Vision (Reasoning, Max Effort) | 34.8 | 65.0 | 47.5 | - | - | $0.314 | 69,174 | 305 |
| GLM-5.3 (low) | 34.3 | - | - | - | 1619 * | $0.852 | 30,041 | 403 |
| DeepSeek V4 Flash 0731 (Reasoning, Max Effort) | 34.3 | 69.1 | 41.0 | 1246 * | - | $0.220 | 62,054 | 274 |
| GPT-5.6 Terra (high) | 34.2 | 67.1 | 36.7 | 1277 * | - | $0.338 | 11,294 | 123 |
| GPT-6 Sol (low) | 33.9 | - | - | 1278 * | - | $0.133 | 3,374 | 44 |
| GPT-6 Luna (xhigh) | 33.9 | - | - | 1280 * | - | $0.042 | 27,483 | 186 |
| Qwen3.8 27B (xhigh) | 33.7 | 68.1 | 45.8 | - | 1591 * | $1.007 | 66,797 | 1447 |
| GPT-6 Luna (high) | 32.1 | - | - | 1280 * | - | $0.029 | 19,769 | 143 |
| DeepSeek V4 Pro 0424 (Reasoning, Max Effort) | 30.4 | 59.4 | 26.3 | - | - | $0.121 | 48,896 | 560 |
| GPT-5.6 Terra (medium) | 30.1 | 64.7 | 30.4 | 1277 * | - | $0.183 | 5,478 | 65 |
| GPT-6 Luna (medium) | 29.5 | - | - | 1280 * | - | $0.018 | 11,498 | - |
| MiniMax-M3 | 29.2 | 58.6 | 29.5 | 1265 * | 1483 * | $0.508 | 48,192 | 418 |
| GPT-6 Sol (Non-reasoning) | 28.1 | - | - | 1278 * | - | $0.333 | 4,976 | 66 |
| Qwen3.8 27B (medium) | 27.6 | 56.1 | 44.4 | - | 1591 * | $1.133 | 51,943 | 1065 |
| GPT-5.6 Terra (low) | 27.5 | 58.1 | 25.9 | 1277 * | - | $0.144 | 3,871 | 43 |
| Qwen3.8 27B (low) | 26.2 | 58.2 | 38.9 | - | 1591 * | $1.048 | 45,426 | 919 |
| DeepSeek V4 Flash 0420 (Reasoning, Max Effort) | 24.2 | 56.2 | 22.2 | - | - | $0.107 | 55,148 | - |
| GPT-6 Luna (low) | 20.9 | - | - | 1280 * | - | $0.004 | 2,081 | 15 |
| GPT-5.6 Terra (Non-reasoning) | 20.8 | 52.3 | 23.5 | 1277 * | - | $0.140 | 3,129 | 36 |
| Qwen3.8 27B (Non-reasoning) | 20.2 | 44.6 | 22.4 | - | 1591 * | $2.488 | 29,975 | 579 |
| GPT-6 Luna (Non-reasoning) | 18.3 | - | - | 1280 * | - | $0.011 | 3,769 | 26 |
| Claude 4.5 Haiku (Reasoning) | 16.9 | 43.9 | 8.0 | 1130 * | - | $0.277 | 18,485 | 213 |

## token efficiency

Sorted by output tokens spent per point of intelligence, cheapest first. On a subscription this is the column that decides how far the plan goes, because quota is metered in tokens and the sticker price is already sunk.

`answer` is the response the caller receives and `reasoning` is the scratchpad, billed as output and then discarded. The share is how a vendor's effort dial is actually implemented, and it moves between generations of the same model without the dial names changing, so a jump in score at the same effort label is worth reading here before crediting it to the model.

| model | intel | out tok/task | answer | reasoning | reasoning % | intel per 10k out tok | $/task | access |
|---|---|---|---|---|---|---|---|---|
| GPT-6 Astra (low) | 45.8 | 4,433 | 3,495 | 938 | 21% | 103.3 | $0.818 | ChatGPT sub |
| GPT-6 Sol (low) | 33.9 | 3,374 | 2,676 | 698 | 21% | 100.5 | $0.133 | ChatGPT sub |
| GPT-6 Luna (low) | 20.9 | 2,081 | 1,564 | 517 | 25% | 100.4 | $0.004 | ChatGPT sub |
| GPT-5.6 Terra (low) | 27.5 | 3,871 | 2,848 | 1,024 | 26% | 71.0 | $0.144 | ChatGPT sub |
| GPT-5.6 Terra (Non-reasoning) | 20.8 | 3,129 | 3,129 | 0 | 0% | 66.5 | $0.140 | ChatGPT sub |
| GPT-6 Sol (medium) | 39.8 | 6,442 | 4,103 | 2,340 | 36% | 61.8 | $0.247 | ChatGPT sub |
| GPT-6 Sol (Non-reasoning) | 28.1 | 4,976 | 4,976 | 0 | 0% | 56.5 | $0.333 | ChatGPT sub |
| GPT-5.6 Terra (medium) | 30.1 | 5,478 | 3,601 | 1,877 | 34% | 54.9 | $0.183 | ChatGPT sub |
| GPT-6 Astra (medium) | 49.6 | 9,590 | 6,168 | 3,422 | 36% | 51.7 | $1.541 | ChatGPT sub |
| GPT-6 Luna (Non-reasoning) | 18.3 | 3,769 | 3,769 | 0 | 0% | 48.6 | $0.011 | ChatGPT sub |
| GPT-6 Astra (high) | 50.9 | 11,813 | 7,101 | 4,712 | 40% | 43.1 | $1.725 | ChatGPT sub |
| Claude Opus 5.5 (Adaptive Reasoning, Low Effort, Default Fallback) | 42.3 | 10,151 | 6,775 | 3,376 | 33% | 41.7 | $0.551 | Claude sub |
| GPT-6 Sol (high) | 42.8 | 10,319 | 5,305 | 5,014 | 49% | 41.5 | $0.375 | ChatGPT sub |
| GPT-6 Astra (xhigh) | 52.4 | 16,901 | 8,319 | 8,582 | 51% | 31.0 | $2.309 | ChatGPT sub |
| GPT-5.6 Terra (high) | 34.2 | 11,294 | 5,852 | 5,441 | 48% | 30.3 | $0.338 | ChatGPT sub |
| GPT-6 Sol (xhigh) | 44.1 | 15,894 | 6,650 | 9,245 | 58% | 27.7 | $0.524 | ChatGPT sub |
| Claude Opus 5 (Adaptive Reasoning, Low Effort) | 39.4 | 14,668 | 8,124 | 6,544 | 45% | 26.9 | $1.098 | Claude sub |
| Claude Sonnet 5.5 (Adaptive Reasoning, Low Effort, Default Fallback) | 35.8 | 13,894 | 9,283 | 4,612 | 33% | 25.8 | $0.414 | Claude sub |
| GPT-6 Luna (medium) | 29.5 | 11,498 | 5,156 | 6,342 | 55% | 25.7 | $0.018 | ChatGPT sub |
| Claude Fable 5.1 (Adaptive Reasoning, Low Effort, Default Fallback) | 46.8 | 21,562 | 13,273 | 8,289 | 38% | 21.7 | $2.371 | Claude sub |
| Claude Sonnet 5.5 (Adaptive Reasoning, Medium Effort, Default Fallback) | 40.7 | 19,488 | 11,284 | 8,204 | 42% | 20.9 | $0.586 | Claude sub |
| Claude Opus 5.5 (Adaptive Reasoning, Medium Effort, Default Fallback) | 51.2 | 25,745 | 14,050 | 11,696 | 45% | 19.9 | $1.336 | Claude sub |
| GPT-6 Astra (max) | 52.7 | 27,206 | 10,514 | 16,691 | 61% | 19.4 | $3.257 | ChatGPT sub |
| GPT-5.6 Terra (xhigh) | 38.0 | 20,367 | 8,856 | 11,512 | 57% | 18.7 | $0.632 | ChatGPT sub |
| Claude Fable 5.1 (Adaptive Reasoning, Medium Effort, Default Fallback) | 48.9 | 27,888 | 15,806 | 12,082 | 43% | 17.5 | $2.983 | Claude sub |
| GPT-6 Luna (high) | 32.1 | 19,769 | 7,005 | 12,764 | 65% | 16.2 | $0.029 | ChatGPT sub |
| Claude Opus 5 (Adaptive Reasoning, Medium Effort) | 44.8 | 28,977 | 14,108 | 14,869 | 51% | 15.5 | $2.189 | Claude sub |
| GPT-6 Sol (max) | 47.5 | 31,054 | 10,161 | 20,893 | 67% | 15.3 | $1.049 | ChatGPT sub |
| Claude Opus 5.5 (Adaptive Reasoning, High Effort, Default Fallback) | 53.6 | 35,584 | 17,347 | 18,237 | 51% | 15.1 | $1.823 | Claude sub |
| Claude Sonnet 5.5 (Adaptive Reasoning, High Effort, Default Fallback) | 46.7 | 34,467 | 16,312 | 18,155 | 53% | 13.5 | $1.080 | Claude sub |
| Claude Fable 5.1 (Adaptive Reasoning, High Effort, Default Fallback) | 51.2 | 38,054 | 19,432 | 18,623 | 49% | 13.5 | $3.913 | Claude sub |
| GPT-6 Luna (xhigh) | 33.9 | 27,483 | 8,733 | 18,750 | 68% | 12.3 | $0.042 | ChatGPT sub |
| GLM-5.3 (low) | 34.3 | 30,041 | 9,122 | 20,919 | 70% | 11.4 | $0.852 | GLM plan |
| GPT-5.6 Terra (max) | 42.1 | 38,897 | 12,854 | 26,044 | 67% | 10.8 | $1.399 | ChatGPT sub |
| Claude Opus 5 (Adaptive Reasoning, High Effort) | 48.1 | 46,239 | 20,831 | 25,408 | 55% | 10.4 | $3.613 | Claude sub |
| Claude 4.5 Haiku (Reasoning) | 16.9 | 18,485 | 10,820 | 7,665 | 41% | 9.1 | $0.277 | Claude sub |
| Kimi K3 (max) | 43.6 | 48,455 | 16,002 | 32,453 | 67% | 9.0 | $2.000 | Kimi plan |
| Claude Fable 5.1 (Adaptive Reasoning, Xhigh Effort, Default Fallback) | 53.2 | 60,538 | 26,470 | 34,067 | 56% | 8.8 | $5.978 | Claude sub |
| Claude Opus 5.5 (Adaptive Reasoning, Xhigh Effort, Default Fallback) | 56.0 | 65,667 | 25,353 | 40,315 | 61% | 8.5 | $3.459 | Claude sub |
| Claude Opus 5 (Adaptive Reasoning, Xhigh Effort) | 49.7 | 60,655 | 25,660 | 34,995 | 58% | 8.2 | $4.878 | Claude sub |
| Gemini 3.8 Flash (medium) | 39.8 | 52,599 | 25,643 | 26,956 | 51% | 7.6 | $0.931 | API only |
| GPT-6 Luna (max) | 37.3 | 50,213 | 11,184 | 39,029 | 78% | 7.4 | $0.068 | ChatGPT sub |
| Claude Sonnet 5.5 (Adaptive Reasoning, Xhigh Effort, Default Fallback) | 51.9 | 73,724 | 26,060 | 47,664 | 65% | 7.0 | $2.743 | Claude sub |
| Grok 4.7 (high) | 46.3 | 65,901 | 19,268 | 46,633 | 71% | 7.0 | $2.726 | API only |
| Claude Opus 5 (Adaptive Reasoning, Max Effort) | 50.8 | 72,511 | 29,719 | 42,793 | 59% | 7.0 | $5.858 | Claude sub |
| Claude Fable 5.1 (Adaptive Reasoning, Max Effort, Default Fallback) | 53.4 | 78,111 | 30,871 | 47,240 | 60% | 6.8 | $7.630 | Claude sub |
| Qwen3.8 27B (Non-reasoning) | 20.2 | 29,975 | 29,975 | 0 | 0% | 6.7 | $2.488 | Qwen plan |
| DeepSeek V4 Pro 0813 (Reasoning, Max Effort) | 36.0 | 55,154 | 16,991 | 38,164 | 69% | 6.5 | $0.674 | API only |
| Qwen3.8 Max | 40.2 | 62,782 | 19,186 | 43,596 | 69% | 6.4 | $2.670 | Qwen plan |
| GLM-5.3 (max) | 44.8 | 71,128 | 22,398 | 48,730 | 69% | 6.3 | $2.006 | GLM plan |
| DeepSeek V4 Pro 0424 (Reasoning, Max Effort) | 30.4 | 48,896 | 16,165 | 32,732 | 67% | 6.2 | $0.121 | API only |
| MiniMax-M3 | 29.2 | 48,192 | 26,374 | 21,818 | 45% | 6.1 | $0.508 | API only |
| Qwen3.8 2.4T A95B | 39.9 | 68,602 | 21,884 | 46,718 | 68% | 5.8 | $2.156 | Qwen plan |
| Qwen3.8 27B (low) | 26.2 | 45,426 | 19,567 | 25,859 | 57% | 5.8 | $1.048 | Qwen plan |
| Gemini 3.8 Flash (high) | 40.9 | 71,003 | 28,275 | 42,727 | 60% | 5.8 | $1.243 | API only |
| Grok 4.7 (xhigh) | 46.4 | 80,561 | 22,018 | 58,544 | 73% | 5.8 | $3.738 | API only |
| DeepSeek V4 Flash 0731 (Reasoning, Max Effort) | 34.3 | 62,054 | 16,575 | 45,479 | 73% | 5.5 | $0.220 | API only |
| Qwen3.8 27B (medium) | 27.6 | 51,943 | 19,732 | 32,211 | 62% | 5.3 | $1.133 | Qwen plan |
| Qwen3.8 27B (xhigh) | 33.7 | 66,797 | 19,087 | 47,711 | 71% | 5.0 | $1.007 | Qwen plan |
| DeepSeek V4 Flash Vision (Reasoning, Max Effort) | 34.8 | 69,174 | 23,270 | 45,904 | 66% | 5.0 | $0.314 | API only |
| Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback) | 57.6 | 119,166 | 35,237 | 83,929 | 70% | 4.8 | $5.982 | Claude sub |
| DeepSeek V4 Flash 0420 (Reasoning, Max Effort) | 24.2 | 55,148 | 14,593 | 40,555 | 74% | 4.4 | $0.107 | API only |
| Qwen3.8 Max (0902) | 45.4 | 107,730 | 36,900 | 70,830 | 66% | 4.2 | $5.409 | Qwen plan |
| Qwen3.8-Flash-Next | 39.8 | 107,885 | 36,077 | 71,807 | 67% | 3.7 | $0.372 | Qwen plan |
| Claude Sonnet 5.5 (Adaptive Reasoning, Max Effort, Default Fallback) | 56.0 | 192,838 | 50,452 | 142,386 | 74% | 2.9 | $7.603 | Claude sub |

## what a subscription actually buys

`tasks/week` converts each plan's own quota unit into Index tasks using the measured token profile of the model that plan actually serves. An Index task is a heavy agentic job - roughly a million input tokens, mostly cached, against 20-45k of output - so figures in the tens to low hundreds per week are the expected shape. Alibaba meters model calls rather than tokens and cannot be derived this way.

Read the `ratio` column as a lie detector rather than a discount. It is what the plan charges per task against what the same model costs on its own API. Three to ten times cheaper is the normal range for buying capacity in bulk. Moonshot's 60x is not a bargain, it is a signal that the community token estimate behind it is too generous - Moonshot publishes no quota at all, so that row rests on reverse engineering. Z.ai is the only vendor here that documents its own meter.

The two western plans are new and asymmetric. OpenAI publishes its meter in full - Codex bills credits per token at a per-model rate that is exactly 25 credits per dollar of list API price - but not the size of the included allowance, which is derived here from one Pro 20x telemetry report and cross-checks against OpenAI's own message bands. Treat the resulting 19-47x ratios with the suspicion this column is for: either those plans are subsidised far past the normal range, or the derived allowance is too generous. Anthropic publishes no quota in any unit for Pro or Max, and bills overage at plain API rates rather than through an invertible credit, so the Claude rows carry no tasks/week rather than a guess.

Two assumptions worth knowing. Plans quoted per five-hour window are converted at fifteen windows a week, which is a working week rather than the theoretical maximum of about thirty-three. And Z.ai weights output at 24 credits a token against 1.7 for cached input, so its advertised 43-87M tokens a week on Lite only holds while output stays near one to two percent of all tokens; measured Index tasks land at two to seven percent, which is why the derived figure sits below the advertised one. See `research/subscriptions.md` for sourcing and `plans.py` for the arithmetic.

| plan | $/mo | meter | tasks/week | plan $/task | same model on API | ratio | confidence |
|---|---|---|---|---|---|---|---|
| ChatGPT Plus | $20 | credits-openai | 63 | $0.073 | $1.725 | 24x | meter official; allowance derived, one report contradicts it |
| ChatGPT Pro 5x | $100 | credits-openai | 320 | $0.073 | $1.725 | 24x | meter official; allowance derived, one report contradicts it |
| ChatGPT Pro 20x | $200 | credits-openai | 1,300 | $0.037 | $1.725 | 47x | meter official; allowance derived, one report contradicts it |
| ChatGPT Business | $25 | credits-openai | 63 | $0.091 | $1.725 | 19x | meter official; allowance assumed equal to Plus, same caveat |
| Claude Max 5x | $100 | undisclosed | - | - | $1.823 | - | no quota published in any unit; not derivable |
| Claude Max 20x | $200 | undisclosed | - | - | $1.823 | - | no quota published in any unit; not derivable |
| GLM Coding Lite | $18 | credits | 8 | $0.519 | $2.006 | 4x | quota official, price secondary |
| GLM Coding Pro | $80 | credits | 48 | $0.385 | $2.006 | 5x | quota official, price secondary |
| GLM Coding Max | $168 | credits | 110 | $0.346 | $2.006 | 6x | quota official, price secondary |
| Token Plan Plus | $20 | tokens | 60 | $0.076 | $0.508 | 7x | secondary only; minimax's own docs url 404s |
| Token Plan Max | $50 | tokens | 190 | $0.062 | $0.508 | 8x | secondary only |
| Kimi Moderato | $19 | tokens | 100 | $0.042 | $2.000 | 48x | quota is community reverse-engineering, not published |
| Kimi Allegretto | $39 | tokens | 210 | $0.043 | $2.000 | 46x | quota is community reverse-engineering |
| Qwen Coding Plan Pro | $50 | requests | - | - | - | - | fully documented by alibaba |

Superseded and out-of-scope models are not listed here. They are in `picker.html`, behind the tier filter.
