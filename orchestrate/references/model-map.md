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

The clearest way to see it is output tokens per point of intelligence. GPT-6.1 Terra at low spends
74, the best in the current set, then GPT-6.1 Sol at low 94 and GPT-6 Astra at low 97. Terra at
medium spends 141, Astra at medium 193, Astra at high 232, Opus 5.5 at low 240. Opus 5.5 at medium
spends 503, Opus 5 at medium 647, Opus 5.5 at high 664, Fable 5.1 at high 743, Kimi K3.1 Pro 1,002,
GLM-5.3 1,588, Opus 5.5 at max 2,069, and Sonnet 5 at
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

**GPT-6.1 Sol replaces GPT-6 Sol in the current set.** The 7 October refresh puts it at
42.1, 47.8, 50.2, 51.0 and 51.8 from low to max, for $0.131, $0.214, $0.319, $0.393 and
$0.724 per task. High is 0.6 index points above Astra at medium for about a fifth of the cost;
xhigh is level with Astra at high for less than a quarter. Astra still reaches a higher ceiling:
52.7 at max against Sol's 51.8. Sol's coding and agentic indices are absent from the free feed,
so those comparisons remain unmeasured here. The old GPT-6 Sol rows stay in the superseded set.

[OpenAI's model docs](https://developers.openai.com/api/docs/models/gpt-6.1-sol) support low,
medium, high, xhigh and max. Its list input/output prices remain $2/$10 per million tokens;
cached input falls to $0.10. The [Codex rate card](https://learn.chatgpt.com/docs/pricing#token-rates)
is 50/2.5/250 credits per million input/cached/output tokens. Credit-weighted input and output,
rather than output tokens alone, determine subscription consumption.

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

**Muse verdict (2026-10-14, index v4.3).** Meta released Muse Wonder and Muse Wonder Full on 12
Oct 2026, the two-model Muse Wonder series after Muse Spark 1.3. Wonder is on the Meta Model API
at $4 in and $20 out per million with $0.20 cache reads (Meta's pricing page), the same as Opus
5.5. Wonder Full has no token price and is reachable only through the Muse Code Power ($50) and
Maximum ($200) plans; the $5 and $15 plans get Wonder only, and no plan publishes a per-model quota.
Theo Browne's video and the sources behind this paragraph are in `research/2026-10-14-muse/`. AA lists
one rung for each, labelled Max, and has no coding or agentic index for either yet. Wonder scores
52.4 for $4.516 a task on 54,232 output tokens and 410 s of generation time, 131 tok/s. Wonder Full
scores 55.8 on 53,754 tokens, third on the index behind Opus 5.5 at max (57.6) and xhigh (56.0),
but with no cost or time to put beside it. Against GPT-6.1 Sol, the smaller Muse buys 0.6 points over
Sol max (51.8, $0.724) and 1.4 over Sol xhigh (51.0, $0.393) for 6 to 11 times the money, so the
price decides it and Sol keeps the cheap-per-point slot. Against GPT-6 Astra it ties Astra xhigh
(52.4, $2.309) at twice the cost and sits 0.3 under Astra max (52.7, $3.257) on twice the tokens
(54,232 against 27,206). Wonder Full is 3.1 points above Astra max on the index with the same token
spend as Wonder, but with no price the cost question cannot be answered, and only Muse Code
subscribers can reach it. Both Muse models are token-heavy, 53-54k output tokens a task with 53% or
54% of it reasoning. Design Arena lists a "muse-wonder-1.0" at 1359 on its website board, above
every other model in scope, the superseded Spark 1.3 (1358) included; it is joined to Wonder as a family-level vote and Wonder Full has
no entry on either board. Wonder is a 4.3-point jump over Muse Spark 1.3 at max (48.1, $1.605).

**The open-weight models are no longer cheap per task against Opus.** GLM-5.3 is the big jump in
that group, 44.8 at max against GLM-5.2's 33.7, with an agentic 53.1 above Opus 5 at high. But at
$2.006 and 71,128 tokens a task it now costs more than Opus 5.5 at high for 8.8 fewer points, and
Z.ai's plan meters output at 24 credits a token. Qwen3.8 Max (0902) spends 107,730 tokens and
$5.409 to score 45.4.

**GPT-6.1 Terra (26 Oct 2026) is a cheap fast rung, not a smarter one.** $1 in and $5 out per million,
$0.05 cached, $1.25 cache writes, half GPT-6.1 Sol's price; Codex meters it at 25, 1.25 and 125
credits per million, the same 25 credits a dollar as every other row. OpenAI pitches it for visual
reasoning, computer use and natural writing, none of which the Intelligence Index measures, and it
supports `none` effort where Sol does not. On the index it runs 36.2 at low to 48.1 at max. Against
Sol it loses wherever both are run hard: Sol at medium (47.8, $0.214, 8,070 tokens) nearly matches
Terra at max (48.1, $0.404, 35,096) for half the money and a quarter of the tokens, and Sol at
medium also beats Terra at xhigh (45.4, $0.194). The bottom of its ladder is where it earns a place.
Terra at low scores 36.2 on 2,681 output tokens and 29 s of generation for $0.055, against GPT-6
Luna at xhigh (34.6, $0.042, 27,487 tokens, 219 s) and Claude Haiku 5.5 at medium (34.5, $0.047,
32,813 tokens): a tenth of the tokens, about seven times sooner, for a third more money than
Luna. Terra at medium (41.3, $0.095, 63 s) is a point under Sol at low (42.1, $0.131, 79 s) for
three quarters of the money. GPT-5.6 Terra is superseded: 6.1 at medium beats 5.6 at max (42.1,
$1.399). Coding and agentic indices are not in the free feed yet, and the computer-use claim needs
a trial of its own.

**Kimi K3.1 Pro (23 Oct 2026) is the first Kimi model on Opus 5.5's curve.** One rung,
no effort ladder, at $2 in and $10 out with 90% cache discount. It scores 55.1 for $2.115 a task on
55,195 output tokens, an 11.5-point jump over Kimi K3 at max (43.6, $2.000), and lands between
Opus 5.5 at high (53.6, $1.823, 35,584 tokens) and xhigh (56.0, $3.459, 65,667 tokens), about a
quarter cheaper than a straight line between those two rungs would put it. Generation time is the
catch: AA measures 43 tok/s, so a task takes 1,098 s against 279 s for Opus at high and 496 s at
xhigh, two to four times longer. Design Arena's website board has it at 1326, level with Opus 5.5
(1325) and under Kimi K3 (1335), GPT-6 Astra at max (1339) and Muse Wonder (1367), so the design
lead K3 once had did not come back. Coding and agentic indices are unpublished. Moonshot still
publishes no plan quota, so tasks-per-week for it rest on community reverse-engineering, and the
Kimi plan rows below still proxy on K3 until Moonshot says which plans serve K3.1.

<!-- DATA -->

Artificial Analysis Intelligence Index v4.3, refreshed 2026-10-27. 226 measured operating points, 76 of them in the current set defined by `focus.py`. Design and webdev columns are human-preference Elo from Design Arena and Arena.ai (board updated 2026-10-27); a `*` means the Elo is for the model family rather than that exact effort level, because those boards mostly vote without naming an effort setting. Regenerate with `./refresh.py`.

Time per task uses AA’s benchmark-weighted generation time, excluding latency and tool time. A `~` marks the fallback estimate, output tokens divided by the free feed’s median output tokens/s.

## the current set

| model | intel | coding | agentic | design | webdev | $/task | out tok/task | s/task |
|---|---|---|---|---|---|---|---|---|
| Claude Opus 5.5 (Max, Default Fallback) | 57.6 | - | - | 1325 * | 1814 | $5.982 | 119,166 | 775 |
| Claude Sonnet 5.5 (Max, Default Fallback) | 56.0 | - | - | 1322 * | - | $5.461 | 197,430 | 901 |
| Claude Opus 5.5 (Xhigh, Default Fallback) | 56.0 | - | - | 1325 * | - | $3.459 | 65,667 | 496 |
| Muse Wonder Full (Max) | 55.8 | - | - | - | - | - | 53,754 | - |
| Kimi K3.1 Pro | 55.1 | - | - | 1326 * | - | $2.115 | 55,195 | 1098 |
| Claude Opus 5.5 (High, Default Fallback) | 53.6 | - | - | 1325 * | - | $1.823 | 35,584 | 279 |
| Claude Fable 5.1 (Max, Default Fallback) | 53.4 | 81.6 | 57.9 | 1311 * | 1745 | $7.630 | 78,111 | 725 |
| Claude Fable 5.1 (Xhigh, Default Fallback) | 53.2 | 80.7 | 57.2 | 1311 * | - | $5.978 | 60,538 | 598 |
| GPT-6 Astra (Max) | 52.7 | 76.9 | 51.0 | 1339 | 1788 | $3.257 | 27,206 | 399 |
| Gemini 4 Argon (High) | 52.6 | - | - | 1317 * | 1678 | $1.620 | 61,558 | 723 |
| GPT-6 Astra (Xhigh) | 52.4 | 75.9 | 50.2 | 1327 * | - | $2.309 | 16,901 | 246 |
| Muse Wonder (Max) | 52.4 | - | - | 1367 * | - | $3.267 | 54,477 | 265 |
| Claude Sonnet 5.5 (Xhigh, Default Fallback) | 51.9 | - | - | 1322 * | 1773 | $2.012 | 74,810 | 427 |
| GPT-6.1 Sol (Max) | 51.8 | - | - | 1315 * | 1757 | $0.724 | 38,128 | 527 |
| Claude Fable 5.1 (High, Default Fallback) | 51.2 | 79.1 | 53.1 | 1311 * | - | $3.913 | 38,054 | 407 |
| Claude Opus 5.5 (Medium, Default Fallback) | 51.2 | - | - | 1325 * | - | $1.336 | 25,745 | 199 |
| GPT-6.1 Sol (Xhigh) | 51.0 | - | - | 1315 * | - | $0.393 | 17,619 | 261 |
| GPT-6 Astra (High) | 50.9 | 77.1 | 48.2 | 1327 * | - | $1.725 | 11,813 | 185 |
| Claude Opus 5 (Max) | 50.8 | 78.0 | 56.5 | 1309 * | 1692 | $5.858 | 72,511 | 852 |
| GPT-6.1 Sol (High) | 50.2 | - | - | 1315 * | - | $0.319 | 13,192 | 229 |
| Claude Opus 5 (Xhigh) | 49.7 | 77.0 | 55.6 | 1309 * | - | $4.878 | 60,655 | 711 |
| GPT-6 Astra (Medium) | 49.6 | 76.7 | 46.0 | 1327 * | - | $1.541 | 9,590 | 172 |
| Claude Fable 5.1 (Medium, Default Fallback) | 48.9 | 77.1 | 50.2 | 1311 * | - | $2.983 | 27,888 | 297 |
| Claude Opus 5 (High) | 48.1 | 76.5 | 52.3 | 1309 * | 1658 | $3.613 | 46,239 | 537 |
| GPT-6.1 Terra (Max) | 48.1 | - | - | 1282 * | - | $0.404 | 35,096 | 384 |
| GPT-6.1 Sol (Medium) | 47.8 | - | - | 1315 * | - | $0.214 | 8,070 | 151 |
| Claude Fable 5.1 (Low, Default Fallback) | 46.8 | 75.2 | 47.1 | 1311 * | - | $2.371 | 21,562 | 238 |
| Claude Sonnet 5.5 (High, Default Fallback) | 46.8 | - | - | 1322 * | 1716 | $0.884 | 37,327 | 215 |
| Grok 4.7 (Xhigh) | 46.4 | - | - | 1253 * | 1638 | $3.237 | 80,561 | 869 |
| Grok 4.7 (High) | 46.3 | - | - | 1253 * | - | $2.364 | 65,901 | 725 |
| GPT-6 Astra (Low) | 45.8 | 75.7 | 38.8 | 1327 * | - | $0.818 | 4,433 | 88 |
| Qwen3.8 Max (0902) | 45.4 | 76.2 | 56.0 | - | 1672 * | $5.409 | 107,730 | 2031 |
| GPT-6.1 Terra (Xhigh) | 45.4 | - | - | 1282 * | - | $0.194 | 14,551 | 159 |
| GLM-5.3 (Max) | 44.8 | 74.8 | 53.1 | - | 1622 | $2.006 | 71,128 | 634 |
| Claude Opus 5 (Medium) | 44.8 | 74.3 | 46.2 | 1309 * | - | $2.189 | 28,977 | 342 |
| GPT-6.1 Terra (High) | 43.9 | - | - | 1282 * | - | $0.134 | 9,027 | 96 |
| Claude Haiku 5.5 (Max) | 43.4 | - | - | 1261 * | - | $0.213 | 162,164 | 426 |
| MiniMax-M3.1-Flash | 42.7 | - | - | - | - | $0.220 | 78,612 | 577 |
| Claude Opus 5.5 (Low, Default Fallback) | 42.3 | - | - | 1325 * | - | $0.551 | 10,151 | 79 |
| Grok 4.7 (Low) | 42.2 | - | - | 1253 * | - | $1.029 | 28,012 | 353 |
| GPT-6.1 Sol (Low) | 42.1 | - | - | 1315 * | - | $0.131 | 3,977 | 79 |
| GLM-5.3-Flash | 41.8 | 71.5 | 50.9 | - | 1610 * | $0.284 | 68,673 | 724 |
| GPT-6.1 Terra (Medium) | 41.3 | - | - | 1282 * | - | $0.095 | 5,835 | 63 |
| Claude Haiku 5.5 (Xhigh) | 41.2 | - | - | 1261 * | - | $0.124 | 89,394 | 289 |
| Gemini 3.8 Flash (High) | 40.9 | 76.3 | 40.2 | 1299 * | 1583 | $3.485 | 71,003 | 520 |
| Claude Sonnet 5.5 (Medium, Default Fallback) | 40.8 | - | - | 1322 * | - | $0.483 | 20,938 | 121 |
| Qwen3.8 Max | 40.2 | 71.8 | 49.1 | 1274 * | 1672 * | $2.670 | 62,782 | 1176 |
| Qwen3.8 2.4T A95B | 39.9 | 71.9 | 50.1 | - | - | $2.155 | 68,515 | 1281 |
| Gemini 3.8 Flash (Medium) | 39.8 | 74.1 | 39.7 | 1299 * | - | $2.593 | 52,599 | - |
| Qwen3.8-Flash-Next | 39.8 | 73.1 | 53.6 | - | 1632 * | $0.372 | 107,885 | 1505 |
| Claude Opus 5 (Low) | 39.4 | 66.9 | 36.0 | 1309 * | - | $1.098 | 14,668 | 170 |
| GPT-6 Luna (Max) | 38.1 | - | - | 1266 * | 1582 | $0.068 | 50,012 | 397 |
| Claude Haiku 5.5 (High) | 37.8 | - | - | 1261 * | - | $0.079 | 55,388 | 190 |
| GPT-6.1 Terra (Low) | 36.2 | - | - | 1282 * | - | $0.055 | 2,681 | 29 |
| DeepSeek V4 Pro 0813 (Max) | 36.0 | 68.8 | 41.3 | - | - | $0.674 | 55,154 | 406 |
| Claude Sonnet 5.5 (Low, Default Fallback) | 35.9 | - | - | 1322 * | - | $0.345 | 14,253 | 83 |
| DeepSeek V4 Flash Vision (Max) | 34.8 | 65.0 | 47.5 | - | - | $1.038 | 69,174 | 287 |
| GPT-6 Luna (Xhigh) | 34.6 | - | - | 1266 * | - | $0.042 | 27,487 | 219 |
| Claude Haiku 5.5 (Medium) | 34.5 | - | - | 1261 * | - | $0.047 | 32,813 | 119 |
| GLM-5.3 (Low) | 34.3 | - | - | - | 1622 * | $0.852 | 30,041 | 333 |
| DeepSeek V4 Flash 0731 (Max) | 34.3 | 69.1 | 41.0 | 1236 * | - | $0.150 | 62,054 | 409 |
| Qwen3.8 27B (Xhigh) | 33.7 | 68.1 | 45.8 | - | 1592 * | $1.146 | 66,783 | 1199 |
| GPT-6.1 Terra (Non-reasoning) | 33.5 | - | - | 1282 * | - | $0.107 | 4,737 | 52 |
| GPT-6 Luna (High) | 32.9 | - | - | 1266 * | - | $0.029 | 19,703 | 163 |
| DeepSeek V4 Pro 0424 (Max) | 30.4 | 59.4 | 26.3 | - | - | $0.121 | 48,896 | 339 |
| GPT-6 Luna (Medium) | 29.9 | - | - | 1266 * | - | $0.018 | 11,456 | - |
| Claude Haiku 5.5 (Low) | 29.5 | - | - | 1261 * | - | $0.025 | 17,286 | 61 |
| MiniMax-M3 | 29.2 | 58.6 | 29.5 | 1256 * | 1482 * | $0.508 | 48,192 | 355 |
| Qwen3.8 27B (Medium) | 27.6 | 56.1 | 44.4 | - | 1592 * | $1.271 | 51,943 | 987 |
| Qwen3.8 27B (Low) | 26.2 | 58.2 | 38.9 | - | 1592 * | $1.170 | 45,426 | 860 |
| DeepSeek V4 Flash 0420 (High) | 24.4 | 52.0 | 26.3 | - | - | $0.128 | 42,404 | - |
| DeepSeek V4 Flash 0420 (Max) | 24.2 | 56.2 | 22.2 | - | - | $0.098 | 55,148 | 684 |
| GPT-6 Luna (Low) | 21.5 | - | - | 1266 * | - | $0.004 | 2,087 | 18 |
| DeepSeek V4 Pro 0813 (Non-reasoning) | 20.4 | - | - | - | - | $0.355 | 29,149 | 278 |
| Qwen3.8 27B (Non-reasoning) | 20.2 | 44.6 | 22.4 | - | 1592 * | $2.488 | 29,975 | 568 |
| GPT-6 Luna (Non-reasoning) | 18.5 | - | - | 1266 * | - | $0.011 | 3,761 | 31 |

## token efficiency

Sorted by output tokens spent per point of intelligence, cheapest first. On a subscription this is the column that decides how far the plan goes, because quota is metered in tokens and the sticker price is already sunk.

`answer` is the response the caller receives and `reasoning` is the scratchpad, billed as output and then discarded. The share is how a vendor's effort dial is actually implemented, and it moves between generations of the same model without the dial names changing, so a jump in score at the same effort label is worth reading here before crediting it to the model.

| model | intel | out tok/task | answer | reasoning | reasoning % | intel per 10k out tok | $/task | access |
|---|---|---|---|---|---|---|---|---|
| GPT-6.1 Terra (Low) | 36.2 | 2,681 | 2,209 | 472 | 18% | 135.0 | $0.055 | ChatGPT sub |
| GPT-6.1 Sol (Low) | 42.1 | 3,977 | 2,819 | 1,158 | 29% | 105.9 | $0.131 | ChatGPT sub |
| GPT-6 Astra (Low) | 45.8 | 4,433 | 3,495 | 938 | 21% | 103.3 | $0.818 | ChatGPT sub |
| GPT-6 Luna (Low) | 21.5 | 2,087 | 1,573 | 514 | 25% | 103.0 | $0.004 | ChatGPT sub |
| GPT-6.1 Terra (Medium) | 41.3 | 5,835 | 3,895 | 1,940 | 33% | 70.8 | $0.095 | ChatGPT sub |
| GPT-6.1 Terra (Non-reasoning) | 33.5 | 4,737 | 4,737 | 0 | 0% | 70.7 | $0.107 | ChatGPT sub |
| GPT-6.1 Sol (Medium) | 47.8 | 8,070 | 5,175 | 2,895 | 36% | 59.2 | $0.214 | ChatGPT sub |
| GPT-6 Astra (Medium) | 49.6 | 9,590 | 6,168 | 3,422 | 36% | 51.7 | $1.541 | ChatGPT sub |
| GPT-6 Luna (Non-reasoning) | 18.5 | 3,761 | 3,761 | 0 | 0% | 49.2 | $0.011 | ChatGPT sub |
| GPT-6.1 Terra (High) | 43.9 | 9,027 | 5,099 | 3,928 | 44% | 48.6 | $0.134 | ChatGPT sub |
| GPT-6 Astra (High) | 50.9 | 11,813 | 7,101 | 4,712 | 40% | 43.1 | $1.725 | ChatGPT sub |
| Claude Opus 5.5 (Low, Default Fallback) | 42.3 | 10,151 | 6,775 | 3,376 | 33% | 41.7 | $0.551 | Claude sub |
| GPT-6.1 Sol (High) | 50.2 | 13,192 | 7,469 | 5,723 | 43% | 38.1 | $0.319 | ChatGPT sub |
| GPT-6.1 Terra (Xhigh) | 45.4 | 14,551 | 6,534 | 8,017 | 55% | 31.2 | $0.194 | ChatGPT sub |
| GPT-6 Astra (Xhigh) | 52.4 | 16,901 | 8,319 | 8,582 | 51% | 31.0 | $2.309 | ChatGPT sub |
| GPT-6.1 Sol (Xhigh) | 51.0 | 17,619 | 8,539 | 9,080 | 52% | 28.9 | $0.393 | ChatGPT sub |
| Claude Opus 5 (Low) | 39.4 | 14,668 | 8,124 | 6,544 | 45% | 26.9 | $1.098 | Claude sub |
| GPT-6 Luna (Medium) | 29.9 | 11,456 | 5,127 | 6,329 | 55% | 26.1 | $0.018 | ChatGPT sub |
| Claude Sonnet 5.5 (Low, Default Fallback) | 35.9 | 14,253 | 9,665 | 4,588 | 32% | 25.2 | $0.345 | Claude sub |
| Claude Fable 5.1 (Low, Default Fallback) | 46.8 | 21,562 | 13,273 | 8,289 | 38% | 21.7 | $2.371 | Claude sub |
| Claude Opus 5.5 (Medium, Default Fallback) | 51.2 | 25,745 | 14,050 | 11,696 | 45% | 19.9 | $1.336 | Claude sub |
| Claude Sonnet 5.5 (Medium, Default Fallback) | 40.8 | 20,938 | 12,747 | 8,190 | 39% | 19.5 | $0.483 | Claude sub |
| GPT-6 Astra (Max) | 52.7 | 27,206 | 10,514 | 16,691 | 61% | 19.4 | $3.257 | ChatGPT sub |
| Claude Fable 5.1 (Medium, Default Fallback) | 48.9 | 27,888 | 15,806 | 12,082 | 43% | 17.5 | $2.983 | Claude sub |
| Claude Haiku 5.5 (Low) | 29.5 | 17,286 | 8,054 | 9,231 | 53% | 17.1 | $0.025 | Claude sub |
| GPT-6 Luna (High) | 32.9 | 19,703 | 6,959 | 12,744 | 65% | 16.7 | $0.029 | ChatGPT sub |
| Claude Opus 5 (Medium) | 44.8 | 28,977 | 14,108 | 14,869 | 51% | 15.5 | $2.189 | Claude sub |
| Grok 4.7 (Low) | 42.2 | 28,012 | 13,586 | 14,426 | 52% | 15.1 | $1.029 | API only |
| Claude Opus 5.5 (High, Default Fallback) | 53.6 | 35,584 | 17,347 | 18,237 | 51% | 15.1 | $1.823 | Claude sub |
| GPT-6.1 Terra (Max) | 48.1 | 35,096 | 10,204 | 24,892 | 71% | 13.7 | $0.404 | ChatGPT sub |
| GPT-6.1 Sol (Max) | 51.8 | 38,128 | 12,938 | 25,190 | 66% | 13.6 | $0.724 | ChatGPT sub |
| Claude Fable 5.1 (High, Default Fallback) | 51.2 | 38,054 | 19,432 | 18,623 | 49% | 13.5 | $3.913 | Claude sub |
| GPT-6 Luna (Xhigh) | 34.6 | 27,487 | 8,730 | 18,757 | 68% | 12.6 | $0.042 | ChatGPT sub |
| Claude Sonnet 5.5 (High, Default Fallback) | 46.8 | 37,327 | 18,602 | 18,726 | 50% | 12.5 | $0.884 | Claude sub |
| GLM-5.3 (Low) | 34.3 | 30,041 | 9,122 | 20,919 | 70% | 11.4 | $0.852 | GLM plan |
| Claude Haiku 5.5 (Medium) | 34.5 | 32,813 | 13,122 | 19,690 | 60% | 10.5 | $0.047 | Claude sub |
| Claude Opus 5 (High) | 48.1 | 46,239 | 20,831 | 25,408 | 55% | 10.4 | $3.613 | Claude sub |
| Muse Wonder Full (Max) | 55.8 | 53,754 | 24,591 | 29,163 | 54% | 10.4 | - | Muse Code plan |
| Kimi K3.1 Pro | 55.1 | 55,195 | 20,312 | 34,883 | 63% | 10.0 | $2.115 | Kimi plan |
| Muse Wonder (Max) | 52.4 | 54,477 | 25,677 | 28,800 | 53% | 9.6 | $3.267 | Meta API |
| Claude Fable 5.1 (Xhigh, Default Fallback) | 53.2 | 60,538 | 26,470 | 34,067 | 56% | 8.8 | $5.978 | Claude sub |
| Gemini 4 Argon (High) | 52.6 | 61,558 | 26,011 | 35,546 | 58% | 8.5 | $1.620 | API only |
| Claude Opus 5.5 (Xhigh, Default Fallback) | 56.0 | 65,667 | 25,353 | 40,315 | 61% | 8.5 | $3.459 | Claude sub |
| Claude Opus 5 (Xhigh) | 49.7 | 60,655 | 25,660 | 34,995 | 58% | 8.2 | $4.878 | Claude sub |
| GPT-6 Luna (Max) | 38.1 | 50,012 | 11,122 | 38,890 | 78% | 7.6 | $0.068 | ChatGPT sub |
| Gemini 3.8 Flash (Medium) | 39.8 | 52,599 | 25,643 | 26,956 | 51% | 7.6 | $2.593 | API only |
| Grok 4.7 (High) | 46.3 | 65,901 | 19,268 | 46,633 | 71% | 7.0 | $2.364 | API only |
| Claude Opus 5 (Max) | 50.8 | 72,511 | 29,719 | 42,793 | 59% | 7.0 | $5.858 | Claude sub |
| DeepSeek V4 Pro 0813 (Non-reasoning) | 20.4 | 29,149 | 29,149 | 0 | 0% | 7.0 | $0.355 | API only |
| Claude Sonnet 5.5 (Xhigh, Default Fallback) | 51.9 | 74,810 | 26,856 | 47,953 | 64% | 6.9 | $2.012 | Claude sub |
| Claude Fable 5.1 (Max, Default Fallback) | 53.4 | 78,111 | 30,871 | 47,240 | 60% | 6.8 | $7.630 | Claude sub |
| Claude Haiku 5.5 (High) | 37.8 | 55,388 | 18,413 | 36,975 | 67% | 6.8 | $0.079 | Claude sub |
| Qwen3.8 27B (Non-reasoning) | 20.2 | 29,975 | 29,975 | 0 | 0% | 6.7 | $2.488 | Qwen plan |
| DeepSeek V4 Pro 0813 (Max) | 36.0 | 55,154 | 16,991 | 38,164 | 69% | 6.5 | $0.674 | API only |
| Qwen3.8 Max | 40.2 | 62,782 | 19,186 | 43,596 | 69% | 6.4 | $2.670 | Qwen plan |
| GLM-5.3 (Max) | 44.8 | 71,128 | 22,398 | 48,730 | 69% | 6.3 | $2.006 | GLM plan |
| DeepSeek V4 Pro 0424 (Max) | 30.4 | 48,896 | 16,165 | 32,732 | 67% | 6.2 | $0.121 | API only |
| GLM-5.3-Flash | 41.8 | 68,673 | 22,024 | 46,649 | 68% | 6.1 | $0.284 | GLM plan |
| MiniMax-M3 | 29.2 | 48,192 | 26,374 | 21,818 | 45% | 6.1 | $0.508 | API only |
| Qwen3.8 2.4T A95B | 39.9 | 68,515 | 21,878 | 46,637 | 68% | 5.8 | $2.155 | Qwen plan |
| Qwen3.8 27B (Low) | 26.2 | 45,426 | 19,567 | 25,859 | 57% | 5.8 | $1.170 | Qwen plan |
| Gemini 3.8 Flash (High) | 40.9 | 71,003 | 28,275 | 42,727 | 60% | 5.8 | $3.485 | API only |
| Grok 4.7 (Xhigh) | 46.4 | 80,561 | 22,018 | 58,544 | 73% | 5.8 | $3.237 | API only |
| DeepSeek V4 Flash 0420 (High) | 24.4 | 42,404 | 16,026 | 26,379 | 62% | 5.8 | $0.128 | API only |
| DeepSeek V4 Flash 0731 (Max) | 34.3 | 62,054 | 16,575 | 45,479 | 73% | 5.5 | $0.150 | API only |
| MiniMax-M3.1-Flash | 42.7 | 78,612 | 23,945 | 54,668 | 70% | 5.4 | $0.220 | API only |
| Qwen3.8 27B (Medium) | 27.6 | 51,943 | 19,732 | 32,211 | 62% | 5.3 | $1.271 | Qwen plan |
| Qwen3.8 27B (Xhigh) | 33.7 | 66,783 | 19,092 | 47,692 | 71% | 5.0 | $1.146 | Qwen plan |
| DeepSeek V4 Flash Vision (Max) | 34.8 | 69,174 | 23,270 | 45,904 | 66% | 5.0 | $1.038 | API only |
| Claude Opus 5.5 (Max, Default Fallback) | 57.6 | 119,166 | 35,237 | 83,929 | 70% | 4.8 | $5.982 | Claude sub |
| Claude Haiku 5.5 (Xhigh) | 41.2 | 89,394 | 23,686 | 65,708 | 74% | 4.6 | $0.124 | Claude sub |
| DeepSeek V4 Flash 0420 (Max) | 24.2 | 55,148 | 14,593 | 40,555 | 74% | 4.4 | $0.098 | API only |
| Qwen3.8 Max (0902) | 45.4 | 107,730 | 36,900 | 70,830 | 66% | 4.2 | $5.409 | Qwen plan |
| Qwen3.8-Flash-Next | 39.8 | 107,885 | 36,077 | 71,807 | 67% | 3.7 | $0.372 | Qwen plan |
| Claude Sonnet 5.5 (Max, Default Fallback) | 56.0 | 197,430 | 50,797 | 146,633 | 74% | 2.8 | $5.461 | Claude sub |
| Claude Haiku 5.5 (Max) | 43.4 | 162,164 | 33,118 | 129,047 | 80% | 2.7 | $0.213 | Claude sub |

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
