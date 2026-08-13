# model map

Which model at which reasoning effort, judged on cost per finished task rather than on price per
token. Data comes from Artificial Analysis, refreshed by `./refresh.py` in this folder. Everything
from the generated-data marker down is machine-written — edit above it, the script preserves it.

## how to read it

A model appears once per reasoning effort, because effort changes cost more than the model choice
often does. The columns that matter:

- **$/task** — actual money to complete one Intelligence Index task, including reasoning tokens.
  This is the number to compare, not the per-million price. A model can be cheap per token and
  expensive per answer.
- **out tok/task** — output tokens burned per task, reasoning included. Drives both the cost and
  the wait.
- **~s/task** — out tok/task ÷ tok/s. A floor on wall-clock, ignoring time-to-first-token and
  multi-turn overhead, so treat it as a comparison scale rather than a prediction.

## what the current data says

**Sonnet 5 is dominated by Opus 5 at every point.** Sonnet 5 at max effort scores 55.3 for $1.72
and 72k output tokens per task — the most token-hungry row in the table. Opus 5 at *high* scores
61.5 for $1.23 and 21k tokens. Sonnet's non-reasoning row (42.6, $0.42) loses to Opus 5 at low
effort (52.5, $0.43) on score, cost and tokens simultaneously. Sonnet is also not meaningfully
faster: 71 tok/s against Opus's 52, wiped out several times over by emitting 3–6× more tokens.
There is no cell in this data where Sonnet 5 is the right Anthropic choice.

**Opus effort levels are the real dial.** 52.5 → 58.6 → 61.5 → 62.5 → 63.1 across low → medium →
high → xhigh → max, while cost goes $0.43 → $0.72 → $1.23 → $1.80 → $2.34. High is the knee:
xhigh buys one point for +47% cost, max buys 1.6 points for +90%.

**GPT scales far harder with effort than Claude does.** Luna spans 26.8 → 52.3 across its six
settings, a 25-point range; Opus 5 spans 11 points across five. So the effort setting carries most
of the decision on the OpenAI side, and naming a GPT model without an effort level says almost
nothing.

**Sol is the token-efficiency standout at the frontier.** Sol at xhigh reaches 59.0 on 11k tokens
per task; Opus 5 at xhigh reaches 62.5 on 31k. Three points of intelligence for ~3× the tokens and
2.2× the cost.

**Luna, specifically.** Luna at high scores 47.0 for $0.022 and ~58s; Opus 5 at low scores 52.5
for $0.425 and ~130s. So Luna high is roughly 19× cheaper and 2× faster, 5.5 index points behind.
Luna at xhigh (50.1) closes most of that gap and uses 13.3k tokens against Opus low's 6.6k — twice
the tokens, but at 1/20th the price and 3× the emission rate. Luna at *medium* is much weaker than
it feels (38.9) — the useful Luna band is high/xhigh, not medium.

## caveats

- The index is a general benchmark suite, not agentic coding in Claude Code. The `agentic` column
  is the closest proxy and it does not rank the same as `intel`.
- Anthropic rows are labelled "Adaptive Reasoning", which is not identical to a fixed effort budget
  in the CLI.
- The free API tier gives cost per task; token counts are scraped from the eval page's embedded
  JSON, so a site redesign breaks `refresh.py` rather than silently producing wrong numbers.
- [OckBench](https://ockbench.github.io/) is a second opinion built around the same concern —
  it scores `accuracy − 10 × ln(tokens/10000 + 1)`, penalising overthinking directly.

<!-- DATA -->
Artificial Analysis Intelligence Index v4.1. 135 model/effort rows have token data; the table below keeps the families I care about (63 rows). Regenerate with `./refresh.py`.

`~s/task` = out tok/task ÷ tok/s. It is a floor on wall-clock per index task: it counts only output-token time, ignoring time-to-first-token and multi-turn overhead. Use it to compare models, not to predict real latency.

## all kept rows, by intelligence

| model (reasoning effort) | intel | coding | agentic | $/task | out tok/task | tok/s | ~s/task | $/1M in/out |
|---|---|---|---|---|---|---|---|---|
| Claude Opus 5 (Adaptive Reasoning, Max Effort) | 63.1 | 78.0 | 59.2 | $2.337 | 40,249 | 52 | 773 | $5.00/$25.00 |
| Claude Opus 5 (Adaptive Reasoning, Xhigh Effort) | 62.5 | 77.0 | 58.4 | $1.801 | 31,185 | 52 | 597 | $5.00/$25.00 |
| Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback) | 62.1 | 76.5 | 56.6 | $3.140 | 35,565 | 63 | 563 | $10.00/$50.00 |
| Claude Opus 5 (Adaptive Reasoning, High Effort) | 61.5 | 76.5 | 56.1 | $1.227 | 21,353 | 52 | 411 | $5.00/$25.00 |
| Grok 4.6 (high) | 60.9 | 76.8 | 58.7 | $0.837 | 21,735 | 66 | 330 | $2.00/$6.00 |
| GPT-5.6 Sol (max) | 60.9 | 77.4 | 57.8 | $1.231 | 16,879 | 62 | 274 | $5.00/$30.00 |
| Kimi K3 (max) | 59.7 | 76.2 | 54.3 | $0.837 | 25,474 | 41 | 626 | $3.00/$15.00 |
| GPT-5.6 Sol (xhigh) | 59.0 | 78.3 | 53.6 | $0.807 | 11,098 | 61 | 183 | $5.00/$30.00 |
| Claude Opus 5 (Adaptive Reasoning, Medium Effort) | 58.6 | 74.3 | 50.4 | $0.724 | 12,459 | 52 | 242 | $5.00/$25.00 |
| Qwen3.8 Max | 58.1 | 71.8 | 58.4 | $1.132 | 38,287 | 47 | 816 | $2.00/$6.00 |
| GPT-5.6 Sol (high) | 57.3 | 77.2 | 50.6 | $0.548 | 7,545 | 56 | 134 | $5.00/$30.00 |
| Claude Opus 4.8 (Adaptive Reasoning, Max Effort) | 57.3 | 74.3 | 49.4 | $2.032 | 44,687 | 56 | 802 | $5.00/$25.00 |
| GPT-5.6 Terra (max) | 56.6 | 76.7 | 50.2 | $0.508 | 20,838 | 116 | 180 | $2.00/$12.00 |
| GPT-5.5 (xhigh) | 56.3 | 74.9 | 47.4 | $1.175 | 16,893 | 68 | 250 | $5.00/$30.00 |
| Grok 4.5 (high) | 55.8 | 72.4 | 48.9 | $0.360 | 14,795 | 57 | 260 | $2.00/$6.00 |
| GPT-5.6 Sol (medium) | 55.6 | 76.3 | 47.9 | $0.372 | 4,758 | 59 | 80 | $5.00/$30.00 |
| Claude Sonnet 5 (Adaptive Reasoning, Max Effort) | 55.3 | 71.5 | 49.7 | $1.717 | 72,342 | 71 | 1015 | $2.00/$10.00 |
| Claude Opus 4.7 (Adaptive Reasoning, Max Effort) | 55.0 | 73.6 | 46.3 | $2.229 | 33,557 | 45 | 745 | $5.00/$25.00 |
| GPT-5.5 (high) | 54.7 | 71.6 | 45.9 | $0.803 | 10,717 | 70 | 153 | $5.00/$30.00 |
| GPT-5.4 (xhigh) | 53.1 | 71.1 | 44.2 | $1.104 | 34,420 | 122 | 283 | $2.50/$15.00 |
| DeepSeek V4 Pro 0813 (Reasoning, Max Effort) | 53.0 | 68.8 | 49.6 | $0.056 | 38,916 | 83 | 468 | $0.43/$0.87 |
| GPT-5.6 Terra (xhigh) | 52.8 | 70.6 | 46.5 | $0.305 | 12,107 | 108 | 112 | $2.00/$12.00 |
| GLM-5.2 (max) | 52.6 | 68.8 | 45.7 | $0.321 | 45,685 | 118 | 387 | $1.40/$4.40 |
| Claude Opus 5 (Adaptive Reasoning, Low Effort) | 52.5 | 66.9 | 42.1 | $0.425 | 6,573 | 51 | 130 | $5.00/$25.00 |
| GPT-5.6 Luna (max) | 52.3 | 71.4 | 46.9 | $0.047 | 20,046 | 150 | 133 | $0.20/$1.20 |
| Gemini 3.5 Flash (high) | 52.0 | 70.1 | 39.7 | $0.693 | 31,224 | 172 | 182 | $1.50/$9.00 |
| DeepSeek V4 Flash 0731 (Reasoning, Max Effort) | 51.8 | 69.1 | 48.4 | $0.027 | 46,352 | 122 | 379 | $0.14/$0.28 |
| Gemini 3.6 Flash (high) | 51.6 | 69.2 | 40.5 | $0.557 | 25,719 | 234 | 110 | $1.50/$7.50 |
| GPT-5.5 (medium) | 51.4 | 71.5 | 39.2 | $0.500 | 5,576 | 66 | 84 | $5.00/$30.00 |
| GPT-5.6 Sol (low) | 50.7 | 69.7 | 41.6 | $0.231 | 2,834 | 52 | 55 | $5.00/$30.00 |
| GPT-5.6 Terra (high) | 50.1 | 67.1 | 43.5 | $0.218 | 8,486 | 100 | 84 | $2.00/$12.00 |
| GPT-5.6 Luna (xhigh) | 50.1 | 68.6 | 44.4 | $0.032 | 13,336 | 150 | 89 | $0.20/$1.20 |
| Claude Sonnet 4.6 (Adaptive Reasoning, Max Effort) | 48.4 | 63.0 | 42.1 | $1.218 | 51,643 | 53 | 975 | $3.00/$15.00 |
| Kimi K3 (low) | 48.3 | 72.0 | 39.6 | $0.242 | 4,197 | 37 | 113 | $3.00/$15.00 |
| Gemini 3.1 Pro Preview | 47.7 | 68.8 | 23.0 | $0.335 | 13,690 | 114 | 120 | $2.00/$12.00 |
| GPT-5.6 Luna (high) | 47.0 | 63.3 | 41.0 | $0.022 | 8,727 | 150 | 58 | $0.20/$1.20 |
| GPT-5.6 Terra (medium) | 46.8 | 64.7 | 39.1 | $0.119 | 4,143 | 97 | 43 | $2.00/$12.00 |
| DeepSeek V4 Pro (Reasoning, Max Effort) | 45.3 | 59.4 | 37.8 | $0.047 | 37,315 | 67 | 553 | $0.43/$0.87 |
| GPT-5.5 (low) | 44.5 | 60.9 | 31.7 | $0.259 | 2,327 | 65 | 36 | $5.00/$30.00 |
| DeepSeek V4 Pro (Reasoning, High Effort) | 43.7 | 58.7 | 35.3 | $0.043 | 27,681 | 67 | 411 | $0.43/$0.87 |
| Claude Sonnet 5 (Non-reasoning, High Effort) | 42.6 | 66.4 | 34.2 | $0.417 | 10,701 | 60 | 177 | $2.00/$10.00 |
| DeepSeek V4 Flash (Reasoning, Max Effort) | 42.1 | 56.2 | 33.7 | $0.067 | 45,312 | - | - | $0.13/$0.28 |
| GPT-5.6 Sol (Non-reasoning) | 41.9 | 65.1 | 36.0 | $0.237 | 2,304 | 59 | 39 | $5.00/$30.00 |
| GPT-5.6 Terra (low) | 41.3 | 58.1 | 31.5 | $0.094 | 2,504 | 91 | 27 | $2.00/$12.00 |
| GLM-5.1 (Reasoning) | 41.0 | 55.8 | 30.6 | $0.275 | 27,070 | 65 | 416 | $1.38/$4.40 |
| GPT-5.4 mini (xhigh) | 40.9 | 56.1 | 31.5 | $0.495 | 79,938 | 168 | 476 | $0.75/$4.50 |
| GPT-5.4 nano (xhigh) | 39.7 | 56.1 | 29.7 | $0.149 | 74,806 | 167 | 448 | $0.20/$1.25 |
| DeepSeek V4 Flash (Reasoning, High Effort) | 39.0 | 52.0 | 30.3 | $0.051 | 24,439 | - | - | $0.14/$0.28 |
| GPT-5.6 Luna (medium) | 38.9 | 50.7 | 31.8 | $0.011 | 3,940 | 141 | 28 | $0.20/$1.20 |
| Grok 4.3 (high) | 37.9 | 42.2 | 24.2 | $0.145 | 14,658 | 130 | 112 | $1.25/$2.50 |
| GPT-5.1 (high) | 37.5 | 49.4 | 21.6 | $0.304 | 23,592 | 87 | 273 | $1.25/$10.00 |
| Gemini 3.5 Flash-Lite | 37.4 | 49.3 | 27.2 | $0.097 | 13,790 | 357 | 39 | $0.30/$2.50 |
| Claude 4.5 Sonnet (Reasoning) | 37.4 | 52.1 | 26.4 | $0.464 | 16,505 | 43 | 386 | $3.00/$15.00 |
| GPT-5.5 (Non-reasoning) | 35.8 | 56.5 | 26.1 | $0.208 | 1,737 | 60 | 29 | $5.00/$30.00 |
| GPT-5 (high) | 35.3 | 37.8 | 26.5 | $0.257 | 17,302 | 79 | 219 | $1.25/$10.00 |
| GPT-5.6 Terra (Non-reasoning) | 34.6 | 52.3 | 30.1 | $0.103 | 2,354 | 96 | 25 | $2.00/$12.00 |
| GPT-5.6 Luna (low) | 33.9 | 44.2 | 25.7 | $0.009 | 2,478 | 139 | 18 | $0.20/$1.20 |
| Claude 4.5 Haiku (Reasoning) | 29.9 | 43.9 | 16.5 | $0.217 | 23,760 | 95 | 251 | $1.00/$5.00 |
| GPT-5.5 Instant (June 2026) | 29.2 | 39.4 | 11.1 | $0.536 | 2,516 | 128 | 20 | $5.00/$30.00 |
| GPT-5.6 Luna (Non-reasoning) | 26.8 | 39.3 | 22.2 | $0.012 | 2,238 | 143 | 16 | $0.20/$1.20 |
| GPT-5 mini (high) | 25.8 | 15.6 | 19.6 | $0.036 | 13,197 | 85 | 156 | $0.25/$2.00 |
| Gemini 3.1 Flash-Lite | 25.6 | 34.7 | 6.5 | $0.043 | 20,055 | 318 | 63 | $0.25/$1.50 |
| Grok 4.3 (Non-reasoning) | 25.0 | 35.2 | 23.0 | $0.295 | 9,609 | 92 | 104 | $1.25/$2.50 |

## cheapest per task at each intelligence tier

| model (reasoning effort) | intel | coding | agentic | $/task | out tok/task | tok/s | ~s/task | $/1M in/out |
|---|---|---|---|---|---|---|---|---|
| Grok 4.6 (high) | 60.9 | 76.8 | 58.7 | $0.837 | 21,735 | 66 | 330 | $2.00/$6.00 |
| Grok 4.5 (high) | 55.8 | 72.4 | 48.9 | $0.360 | 14,795 | 57 | 260 | $2.00/$6.00 |
| DeepSeek V4 Flash 0731 (Reasoning, Max Effort) | 51.8 | 69.1 | 48.4 | $0.027 | 46,352 | 122 | 379 | $0.14/$0.28 |
| GPT-5.6 Luna (high) | 47.0 | 63.3 | 41.0 | $0.022 | 8,727 | 150 | 58 | $0.20/$1.20 |
| MiMo-V2.5-Pro | 42.9 | 60.2 | 29.5 | $0.034 | 20,979 | 46 | 451 | $0.43/$0.87 |
| MiMo-V2.5 | 38.0 | 56.8 | 24.4 | $0.010 | 17,578 | 82 | 216 | $0.14/$0.28 |
| GPT-5.6 Luna (low) | 33.9 | 44.2 | 25.7 | $0.009 | 2,478 | 139 | 18 | $0.20/$1.20 |
