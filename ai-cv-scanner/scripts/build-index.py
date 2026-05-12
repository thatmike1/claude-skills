#!/usr/bin/env python3
"""
builds a lightweight index of all claude code conversations.
reads sessions-index.json files (summaries + first prompts) without touching the massive JSONL conversation files.
falls back to reading first user message from JSONL if no index exists.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

PROJECTS_DIR = Path.home() / ".claude" / "projects"

def extract_first_user_message(jsonl_path: Path) -> str:
    """fallback: read first non-meta user message from a JSONL conversation file."""
    try:
        with open(jsonl_path) as f:
            for line in f:
                obj = json.loads(line)
                if obj.get("type") == "user" and not obj.get("isMeta"):
                    msg = obj.get("message", {})
                    content = msg.get("content", "") if isinstance(msg, dict) else msg
                    if isinstance(content, str):
                        return content[:300]
                    if isinstance(content, list):
                        for item in content:
                            if isinstance(item, dict) and item.get("type") == "text":
                                return item["text"][:300]
    except Exception:
        pass
    return ""

def get_timestamp_from_jsonl(jsonl_path: Path) -> str:
    """extract earliest timestamp from a JSONL file."""
    try:
        with open(jsonl_path) as f:
            for line in f:
                obj = json.loads(line)
                ts = obj.get("timestamp")
                if ts:
                    if isinstance(ts, str):
                        return ts[:10]
                    if isinstance(ts, (int, float)):
                        return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
    except Exception:
        pass
    try:
        mtime = jsonl_path.stat().st_mtime
        return datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
    except Exception:
        return "unknown"

def project_name_from_dir(dirname: str) -> str:
    """convert encoded dir name back to readable project path."""
    home_user = Path.home().name
    return dirname.replace(f"-home-{home_user}-git-", "").replace(f"-home-{home_user}-", "~/")

def build_index():
    if not PROJECTS_DIR.exists():
        print("ERROR: ~/.claude/projects/ not found", file=sys.stderr)
        sys.exit(1)

    all_sessions = []

    for project_dir in sorted(PROJECTS_DIR.iterdir()):
        if not project_dir.is_dir():
            continue

        project_name = project_name_from_dir(project_dir.name)
        index_file = project_dir / "sessions-index.json"

        if index_file.exists() and index_file.stat().st_size > 10:
            try:
                with open(index_file) as f:
                    data = json.load(f)

                entries = data.get("entries", []) if isinstance(data, dict) else data
                if not isinstance(entries, list):
                    continue

                for entry in entries:
                    session_id = entry.get("sessionId", "")
                    mtime = entry.get("fileMtime")
                    date = datetime.fromtimestamp(mtime / 1000).strftime("%Y-%m-%d") if mtime else "unknown"

                    all_sessions.append({
                        "project": project_name,
                        "date": date,
                        "summary": entry.get("summary", ""),
                        "firstPrompt": (entry.get("firstPrompt", "") or "")[:300],
                        "sessionId": session_id,
                    })
            except Exception as e:
                print(f"WARN: failed to read {index_file}: {e}", file=sys.stderr)
        else:
            # fallback: scan JSONL files directly
            for jsonl_file in sorted(project_dir.glob("*.jsonl")):
                if jsonl_file.name.startswith("agent-"):
                    continue
                if jsonl_file.stat().st_size < 100:
                    continue

                first_msg = extract_first_user_message(jsonl_file)
                date = get_timestamp_from_jsonl(jsonl_file)

                all_sessions.append({
                    "project": project_name,
                    "date": date,
                    "summary": "",
                    "firstPrompt": first_msg,
                    "sessionId": jsonl_file.stem,
                })

    # sort by date descending
    all_sessions.sort(key=lambda x: x["date"], reverse=True)

    # output
    print(json.dumps(all_sessions, indent=2, ensure_ascii=False))

    # stats to stderr
    projects = set(s["project"] for s in all_sessions)
    print(f"\n--- {len(all_sessions)} sessions across {len(projects)} projects ---", file=sys.stderr)
    for p in sorted(projects):
        count = sum(1 for s in all_sessions if s["project"] == p)
        print(f"  {count:4d}  {p}", file=sys.stderr)

if __name__ == "__main__":
    build_index()
