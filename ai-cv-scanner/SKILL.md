---
name: ai-cv-scanner
description: Mine Claude Code conversation history to answer questions about your AI experience. Scans session indexes, spawns parallel subagents to deep-dive relevant conversations, and drafts evidence-based answers. Use when user mentions CV, AI experience, questionnaire, scan my conversations, or needs to document their AI usage.
---

# AI CV Scanner

Scans your full Claude Code conversation history to extract concrete evidence of AI usage, then drafts answers to user-provided questions.

## Input

The user provides questions to answer — either:
- Pasted directly in the prompt
- Referenced from a file (e.g. "answer questions in questionnaire.md")
- A general ask like "summarize my AI experience for a CV"

If no specific questions are given, produce a general AI experience summary covering: tools used, proficiency level, concrete project examples, API/integration experience, and biggest wins.

## Phase 1: Gather data (scripts — run in parallel)

Run both scripts from this skill's `scripts/` directory:

```bash
python3 <skill-dir>/scripts/build-index.py > /tmp/cc-session-index.json
python3 <skill-dir>/scripts/scan-setup.py > /tmp/cc-setup-scan.json
```

- `build-index.py` — extracts summaries + first prompts from all session indexes (lightweight, no JSONL reading)
- `scan-setup.py` — scans `~/.claude/` for skills, commands, MCP servers, hooks, CLAUDE.md files

Read both output files. This is your map of the user's entire AI history.

> **Note:** Future versions should use the shared CC session parsers from the `morning` skill instead of having subagents read raw JSONL. For now, the subagent approach works but burns more context tokens.

## Phase 2: Spawn subagents (parallel, use model: sonnet)

Launch **3 sonnet subagents in parallel**. Each gets:
1. The full session index from `/tmp/cc-session-index.json`
2. The setup scan from `/tmp/cc-setup-scan.json`
3. Their specific mission below

**IMPORTANT**: Tell each subagent to:
- First scan the index for relevant sessions using keyword matching
- Then open only the most promising JSONL files (max 10-15 per agent) to extract specific evidence
- JSONL files are at `~/.claude/projects/{project-dir}/{sessionId}.jsonl`
- In JSONL files, look for `type: "user"` and `type: "assistant"` messages
- User message text is in `message.content` (string or list of `{type: "text", text: "..."}`)
- Skip `agent-*.jsonl` files (those are subagent transcripts, less useful)
- Return structured findings, not raw dumps

### Agent 1: "Project Impact Scanner"

Search for sessions where the user built substantial things with AI — entire features, multi-file refactors, complex integrations, ambitious tasks.

For each find, extract: project name, what was built, how AI helped, estimated scope/impact. Look for moments the user expressed surprise at speed/quality, sessions with very high message counts, parallel subagent workflows.

### Agent 2: "Advanced Usage Scanner"

Search for sessions involving: custom skills, MCP setup, hooks, CLAUDE.md authoring, prompt engineering, workflow automation, subagent orchestration, design systems.

Cross-reference with the setup scan — for each tool/technique found in config, find a conversation that shows it being USED or CREATED.

Categorize findings by capability level: basic chat, code generation, custom prompts, skills, context rules, MCP, workflow automation. Note gaps honestly.

### Agent 3: "API & Integration Scanner"

Search for sessions mentioning: API, LLM, chatbot, anthropic, openai, sdk, system prompt, RAG, embedding, function calling, tool use, webhook, automation.

Also check repos for LLM API code: `grep -r "anthropic\|openai\|llm\|chatbot" ~/git/*/src/ --include="*.ts" --include="*.py" -l`

For each find: what was integrated, how (SDK, API, RAG), what the use case was.

## Phase 3: Synthesize

After all 3 agents return, combine their findings to draft answers to the user's questions. If the user provided a structured questionnaire, match findings to each question.

### Output format

Present each answer as a draft with cited evidence (which project, which session). Flag sections where evidence is thin. After presenting drafts, ask the user which sections need adjustment, more evidence, or a different tone.

### Language

Match the user's input language. If the questions are in Czech, answer in Czech. If English, answer in English.
