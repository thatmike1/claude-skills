# deprecated

Skills that are no longer worth installing by default. Nothing here is deleted: the installer lists them under a collapsed "deprecated" group (press `d` to expand), and a manual symlink works the same as for any other skill.

| skill | why it landed here |
|---|---|
| live-prompt, afk-prompt | superseded by Matt Pocock's `/handoff`, which covers both the attended and unattended handoff in one skill |
| cc-audit | a one-off built to score someone else's setup; its checks were never revisited against current Claude Code, so treat the scores as a snapshot of mid-2026 folklore |
| ai-cv-scanner | built for one job-application questionnaire; the questionnaire is done |
| invoice-subjects | Czech freelancer invoicing, git-history driven; only useful with the exact setup it was written against |
| panels, detective, punchy | rotating response styles for ADHD reading; the novelty was the point, and it wore off |

`shared/` here is a symlink to the repo's `shared/`, so scripts in these skills keep their `../../shared` imports working when the skill is symlinked into `~/.claude/skills`.
