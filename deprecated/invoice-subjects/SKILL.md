---
name: invoice-subjects
description: Generate monthly invoice subjects and newsletter blurb from git history. Scans work repos for commits, produces combined invoice line items and a casual highlight blurb. Use when user mentions invoicing, fakturace, newsletter, or monthly summary.
---

# Monthly Invoice & Newsletter Generator

## Arguments

User passes: month (e.g. "march", "april") and optionally extra context (which projects are active, notes).

## Config

This skill reads `config.json` in this directory for user-specific settings. Copy `config.json.example` and fill it in, or run the installer.

## Step 1: Scan repos

Only scan **work repos** — skip personal/side projects to save tokens.

Read the repo list from `config.json` (`workRepos` array). For the given month, run `git log` on each work repo. Use `--oneline --no-merges` filtered by the git author from config. List repos with commit counts, then show commits grouped by repo.

If the user mentions additional repos, include those too.

## Step 2: Invoice subjects

Generate **3-4 subjects total** covering all projects combined.

### Rules

- Use the language specified in `config.json` (default: Czech)
- Each subject = a short phrase describing a coherent theme of delivered work
- **No project names** — subjects are abstract work descriptions
- **Frame as positive deliverables** — sounds like finished features/capabilities
- **Avoid negative framing** — words that imply fixing mistakes rather than delivering value. Check the `forbiddenWords` list in config if provided.
- **Good framing examples**: implementation, development, integration, optimization, deployment (or equivalents in the configured language)
- Don't repeat subjects from previous months (see [EXAMPLES.md](EXAMPLES.md))
- Present as a numbered list, ready to copy-paste

### How to pick subjects

1. Look across ALL repos for common themes (API work, UI work, CMS integration, new features)
2. Group related commits into 3-4 coherent buckets
3. Name each bucket as a delivered capability, not a task description

## Step 3: Newsletter blurb

Generate a casual first-person summary for a colleague or manager.

### Rules

- **2-4 sentences total** — pick the most interesting highlights across projects
- **Project names ARE used** here — use the `projectNames` mapping from config for short/friendly names
- No filler openers
- Casual, first-person — like talking to a colleague
- Lead with the most substantial/impressive work
- Skip projects with minor work (1-4 small commits)

## Step 4: Present for review

Show both outputs clearly separated. Ask the user if anything needs adjusting — tone, specificity, which items to keep/drop. Be ready to iterate.

When the user confirms the final versions, offer to append them to EXAMPLES.md so future runs can avoid repetition.

## Important

- The user iterates heavily on wording. Expect multiple rounds of feedback.
- When the user suggests a change, apply it and show the full updated text (not just the changed line).
