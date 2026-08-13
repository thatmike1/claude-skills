#!/usr/bin/env python3
"""regenerate model-map.md from artificial analysis data.

two sources, because the free api withholds token counts:
  1. free api (/api/v2/language/models/free) -> names, ids, index scores, prices, speed
  2. the intelligence-index evaluation page html -> output tokens per task + cost per task,
     embedded as next.js json and keyed by the same model ids

usage: ./refresh.py            # rewrites model-map.md next to this file
       AA_API_KEY=... ./refresh.py
key is read from $AA_API_KEY or ~/.config/artificialanalysis-key
"""

import json
import os
import pathlib
import re
import urllib.request

HERE = pathlib.Path(__file__).parent
API = "https://artificialanalysis.ai/api/v2/language/models/free"
EVAL_PAGE = "https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"

# families worth keeping in the doc; substring match against model name
KEEP = ("Claude ", "GPT-5", "Gemini 3", "Grok 4", "Kimi K3", "DeepSeek V4", "GLM-5", "Qwen3.8")


def get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode()


def api_key():
    k = os.environ.get("AA_API_KEY")
    if k:
        return k.strip()
    p = pathlib.Path.home() / ".config" / "artificialanalysis-key"
    if p.exists():
        return p.read_text().strip()
    raise SystemExit("no api key: set $AA_API_KEY or ~/.config/artificialanalysis-key")


def fetch_models(key):
    """all pages of the free tier listing"""
    models, page = [], 1
    while True:
        d = json.loads(get(f"{API}?page={page}&page_size=200", {"x-api-key": key}))
        models += d["data"]
        if not d["pagination"]["has_more"]:
            return models, d["intelligence_index_version"]
        page += 1


def fetch_token_counts():
    """model_id -> (output tokens per task, cost per task) scraped from the eval page"""
    html = get(EVAL_PAGE, {"User-Agent": UA}).replace('\\"', '"')
    pat = re.compile(
        r'"intelligenceIndexOutputTokensPerTask":\{[^}]*"output":([0-9.]+)\}'
        r',"intelligenceIndexCostPerTask":\{"cost":\{"total":([0-9.]+)'
    )
    out = {}
    for m in pat.finditer(html):
        ids = re.findall(r'"model_id":"([0-9a-f-]{36})"', html[: m.start()])
        if ids:
            out[ids[-1]] = (float(m.group(1)), float(m.group(2)))
    return out


def rows(models, tokens):
    for m in models:
        t = tokens.get(m["id"])
        if not t:
            continue
        ev, perf = m["evaluations"], m["performance"]
        tps = perf["median_output_tokens_per_second"]
        yield {
            "name": m["name"],
            "creator": m["model_creator"]["name"],
            "ii": ev["artificial_analysis_intelligence_index"],
            "coding": ev["artificial_analysis_coding_index"],
            "agentic": ev["artificial_analysis_agentic_index"],
            "cost": t[1],
            "tokens": t[0],
            "tps": tps,
            # rough wall-clock floor for one index task: all output tokens at median speed,
            # ignoring turn overhead and time to first token
            "secs": (t[0] / tps) if tps else None,
            "in_price": m["pricing"]["price_1m_input_tokens"],
            "out_price": m["pricing"]["price_1m_output_tokens"],
        }


def fmt(r):
    def n(v, d=1):
        return "-" if v is None else f"{v:.{d}f}"

    return (
        f"| {r['name']} | {n(r['ii'])} | {n(r['coding'])} | {n(r['agentic'])} | "
        f"${r['cost']:.3f} | {r['tokens']:,.0f} | {n(r['tps'], 0)} | {n(r['secs'], 0)} | "
        f"${n(r['in_price'], 2)}/${n(r['out_price'], 2)} |"
    )


HEADER = (
    "| model (reasoning effort) | intel | coding | agentic | $/task | out tok/task | tok/s | ~s/task | $/1M in/out |\n"
    "|---|---|---|---|---|---|---|---|---|"
)


def main():
    models, version = fetch_models(api_key())
    tokens = fetch_token_counts()
    data = sorted(rows(models, tokens), key=lambda r: -(r["ii"] or 0))
    kept = [r for r in data if any(k in r["name"] for k in KEEP)]

    doc = HERE / "model-map.md"
    body = doc.read_text().split("<!-- DATA -->")[0] if doc.exists() else ""
    if not body:
        body = "# model map\n\n"

    parts = [
        body.rstrip(),
        "\n\n<!-- DATA -->\n",
        f"Artificial Analysis Intelligence Index v{version}. "
        f"{len(data)} model/effort rows have token data; the table below keeps the families I care about "
        f"({len(kept)} rows). Regenerate with `./refresh.py`.\n",
        "\n`~s/task` = out tok/task ÷ tok/s. It is a floor on wall-clock per index task: "
        "it counts only output-token time, ignoring time-to-first-token and multi-turn overhead. "
        "Use it to compare models, not to predict real latency.\n",
        "\n## all kept rows, by intelligence\n\n",
        HEADER,
        "\n",
        "\n".join(fmt(r) for r in kept),
        "\n\n## cheapest per task at each intelligence tier\n\n",
        HEADER,
        "\n",
    ]

    # for each 5-point intelligence band, the cheapest row in it (all models, not just kept)
    best = {}
    for r in data:
        if r["ii"] is None:
            continue
        band = int(r["ii"] // 5) * 5
        if band not in best or r["cost"] < best[band]["cost"]:
            best[band] = r
    parts.append("\n".join(fmt(best[b]) for b in sorted(best, reverse=True) if b >= 30))
    parts.append("\n")

    doc.write_text("".join(parts))
    print(f"wrote {doc} ({len(kept)} kept / {len(data)} total rows, index v{version})")


if __name__ == "__main__":
    main()
