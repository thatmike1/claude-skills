#!/usr/bin/env python3
"""Keyless Exa search/fetch via the hosted MCP endpoint.

No account, no API key. Free tier is ~150 calls/day, 3 QPS per IP.

    ./exa.py search "query" [n]     # web search, default 5 results
    ./exa.py fetch <url>            # full page as clean markdown
"""

import json
import sys
import urllib.request

ENDPOINT = "https://mcp.exa.ai/mcp"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    # Exa 403s the default Python-urllib agent; any other value is accepted.
    "User-Agent": "find-out/1.0",
}


def _post(payload, session=None):
    """POST one JSON-RPC message; return (parsed_result, session_id)."""
    headers = dict(HEADERS)
    if session:
        headers["Mcp-Session-Id"] = session
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        session_id = response.headers.get("Mcp-Session-Id") or session
        body = response.read().decode("utf-8", "replace")

    # Responses come back as SSE frames: strip `event:`/`data:` prefixes.
    for line in body.splitlines():
        if line.startswith("data: "):
            return json.loads(line[6:]), session_id
    return (json.loads(body) if body.strip() else None), session_id


def call(tool, arguments):
    """Run the initialize → initialized → tools/call handshake."""
    _, session = _post(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "find-out", "version": "1"},
            },
        }
    )
    _post({"jsonrpc": "2.0", "method": "notifications/initialized"}, session)
    result, _ = _post(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": tool, "arguments": arguments},
        },
        session,
    )

    if result is None:
        raise SystemExit("exa: empty response")
    if "error" in result:
        raise SystemExit(f"exa: {result['error'].get('message', result['error'])}")
    return "\n".join(
        block.get("text", "")
        for block in result["result"].get("content", [])
        if block.get("type") == "text"
    )


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    mode, arg = sys.argv[1], sys.argv[2]

    if mode == "search":
        count = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        print(call("web_search_exa", {"query": arg, "numResults": count}))
    elif mode == "fetch":
        print(call("web_fetch_exa", {"urls": [arg]}))
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
