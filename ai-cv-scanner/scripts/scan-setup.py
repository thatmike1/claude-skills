#!/usr/bin/env python3
"""
scans ~/.claude/ directory for evidence of advanced AI usage.
outputs structured findings about skills, commands, MCP servers, hooks, and config.
"""

import json
import os
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude"

def scan_skills():
    """list installed skills with descriptions."""
    skills_dir = CLAUDE_DIR / "skills"
    results = []
    if not skills_dir.exists():
        return results

    for skill_dir in sorted(skills_dir.iterdir()):
        if not skill_dir.is_dir() and not skill_dir.is_symlink():
            continue
        name = skill_dir.name
        skill_md = skill_dir / "SKILL.md" if skill_dir.is_dir() else None
        if skill_dir.is_symlink():
            target = os.readlink(skill_dir)
            results.append({"name": name, "type": "symlink", "target": target})
        elif skill_md and skill_md.exists():
            desc = ""
            with open(skill_md) as f:
                for line in f:
                    if line.startswith("description:"):
                        desc = line.split(":", 1)[1].strip()
                        break
            results.append({"name": name, "type": "custom", "description": desc})
    return results

def scan_commands():
    """list custom slash commands."""
    commands_dir = CLAUDE_DIR / "commands"
    results = []
    if not commands_dir.exists():
        return results

    for cmd_file in sorted(commands_dir.glob("*.md")):
        with open(cmd_file) as f:
            content = f.read()[:200]
        results.append({"name": cmd_file.stem, "preview": content})
    return results

def scan_mcp_servers():
    """find MCP server configurations."""
    results = []
    for settings_file in [
        CLAUDE_DIR / "settings.json",
        CLAUDE_DIR / "settings.local.json",
    ]:
        if not settings_file.exists():
            continue
        try:
            with open(settings_file) as f:
                data = json.load(f)
            mcps = data.get("mcpServers", {})
            for name, config in mcps.items():
                cmd = config.get("command", "")
                args = config.get("args", [])
                results.append({
                    "name": name,
                    "command": cmd,
                    "args": args[:3] if isinstance(args, list) else [],
                    "source": settings_file.name,
                })
        except Exception:
            pass

    # also check project-level settings
    for project_dir in (CLAUDE_DIR / "projects").iterdir():
        settings = project_dir / "settings.json"
        if settings.exists():
            try:
                with open(settings) as f:
                    data = json.load(f)
                mcps = data.get("mcpServers", {})
                for name, config in mcps.items():
                    results.append({
                        "name": name,
                        "command": config.get("command", ""),
                        "source": f"projects/{project_dir.name}",
                    })
            except Exception:
                pass
    return results

def scan_hooks():
    """find configured hooks."""
    results = []
    for settings_file in [
        CLAUDE_DIR / "settings.json",
        CLAUDE_DIR / "settings.local.json",
    ]:
        if not settings_file.exists():
            continue
        try:
            with open(settings_file) as f:
                data = json.load(f)
            hooks = data.get("hooks", {})
            for event, hook_list in hooks.items():
                if isinstance(hook_list, list):
                    for hook in hook_list:
                        results.append({
                            "event": event,
                            "command": hook.get("command", ""),
                            "source": settings_file.name,
                        })
        except Exception:
            pass
    return results

def scan_claude_md_files():
    """find CLAUDE.md files and their sizes."""
    results = []
    # global
    global_md = CLAUDE_DIR / "CLAUDE.md"
    if global_md.exists():
        results.append({
            "path": str(global_md),
            "size": global_md.stat().st_size,
            "type": "global",
        })

    # project-level
    for project_dir in (CLAUDE_DIR / "projects").iterdir():
        if not project_dir.is_dir():
            continue
        # check for memory files too
        memory_dir = project_dir / "memory"
        if memory_dir.exists():
            memory_files = list(memory_dir.glob("*.md"))
            if memory_files:
                results.append({
                    "path": str(memory_dir),
                    "type": "memory",
                    "file_count": len(memory_files),
                    "project": project_dir.name,
                })

    # repo-level CLAUDE.md files
    git_dir = Path.home() / "git"
    if git_dir.exists():
        for repo_dir in git_dir.iterdir():
            claude_md = repo_dir / "CLAUDE.md"
            if claude_md.exists():
                results.append({
                    "path": str(claude_md),
                    "size": claude_md.stat().st_size,
                    "type": "project",
                    "project": repo_dir.name,
                })
    return results

def scan_history_stats():
    """basic stats from history.jsonl."""
    history = CLAUDE_DIR / "history.jsonl"
    if not history.exists():
        return {}

    total = 0
    projects = set()
    earliest = None
    latest = None

    with open(history) as f:
        for line in f:
            try:
                obj = json.loads(line)
                total += 1
                projects.add(obj.get("project", "unknown"))
                ts = obj.get("timestamp")
                if ts:
                    if earliest is None or ts < earliest:
                        earliest = ts
                    if latest is None or ts > latest:
                        latest = ts
            except Exception:
                pass

    return {
        "total_prompts": total,
        "unique_projects": len(projects),
        "earliest_timestamp": earliest,
        "latest_timestamp": latest,
    }

if __name__ == "__main__":
    report = {
        "skills": scan_skills(),
        "commands": scan_commands(),
        "mcp_servers": scan_mcp_servers(),
        "hooks": scan_hooks(),
        "claude_md_files": scan_claude_md_files(),
        "history_stats": scan_history_stats(),
    }

    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))
