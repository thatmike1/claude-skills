# Rewrite install.mjs as a React terminal app using ink

## The vision

We have a CLI installer for a Claude Code skills repo. It currently works but looks like a 2003 bash script. We're rewriting it as a **React app that runs in the terminal** using [ink](https://github.com/vadimdemedes/ink).

Yes, React in the terminal. This is not a joke. This is destiny.

The goal: an installer that makes people go "wait, this is a CLI?" — animated ASCII header, smooth multi-select with checkboxes, grouped setup flows, colors, spinners, the whole thing.

## Tech stack

- **ink** (v5+) — React renderer for the terminal. JSX components, hooks, flexbox, the works.
- **ink-select-input** or **ink-multi-select** — for skill selection (checkboxes!)
- **cfonts** — big styled ASCII text for the header ("claude-skills" in chrome/neon/block style)
- **chalk** — colors throughout
- **chalk-animation** or custom ink animation — animated intro effect on the header (rainbow cycle, glitch, or pulse)
- **ink-spinner** — spinners during install steps
- **ink-text-input** — for setup prompts (git email, repo dir, etc.)

## Package setup

Initialize a proper package.json at the repo root:
```json
{
  "name": "claude-skills",
  "type": "module",
  "bin": { "claude-skills": "./install.mjs" }
}
```

Install deps:
```bash
npm install ink ink-select-input ink-text-input ink-spinner react cfonts chalk
```

The install.mjs should use ink's `render()` with JSX. Since we're using .mjs (ESM), we need the JSX transform — either use ink's built-in support or precompile. Check ink v5 docs for the recommended approach. If JSX in .mjs is painful, rename to install.jsx or install.tsx and add a thin .mjs wrapper that imports it.

**Important**: the skill scripts (morning parsers, gather-context, etc.) stay zero-dep .mjs. Only the installer gets the npm treatment. The skills themselves must work without node_modules since they get symlinked/copied to ~/.claude/skills/.

## Current installer behavior to preserve

Read the current `install.mjs` for the full logic. Here's what it does:

1. Shows a list of 5 skills with descriptions and (installed) markers
2. User picks which to install (numbers, comma-separated, or "all")
3. Asks symlink vs copy
4. For skills with setup (morning, capacities, invoice-subjects):
   - **morning**: asks git author email (auto-detects from git config), repo directory, work remote pattern, personal remote pattern. Writes config.json.
   - **capacities**: asks API bearer token (skippable), space ID. Writes references/auth.md and updates SKILL.md.
   - **invoice-subjects**: asks git author email, repo directory, work repo names (comma-separated), language, then project display names for each repo. Writes config.json.
5. Installs each skill via symlink or copy to ~/.claude/skills/
6. Handles removing existing installs (symlinks or directories)

All of this logic must be preserved. The functions are already there — just wire them into ink components instead of readline.

## Component architecture

Think of it as screens/steps:

### `<App>`
Top-level component. Manages which step we're on via useState.

### `<Header>`
Big ASCII "claude-skills" text via cfonts. Animated on mount — maybe a quick rainbow/glitch cycle that settles into a static gradient after 1-2 seconds. Render once at the top, stays visible throughout.

### `<SkillSelect>`
Multi-select with checkboxes. Each skill shows:
- Name (bold)
- Description (dimmed)
- (installed) tag if already present in ~/.claude/skills/

Shows all 5 skills. Space to toggle, enter to confirm. "a" to select all.

### `<MethodSelect>`
Simple select: Symlink (recommended) vs Copy. One-liner explanation for each.

### `<SkillSetup skill={name}>`
Conditional per skill. Shows grouped text inputs for the skill's config:
- Auto-fills defaults (git email detected, ~/git for repo dir, etc.)
- Each field shows the detected/default value and lets user edit or accept
- Shows a little "wrote config to X" confirmation after each skill's setup

### `<InstallProgress>`
Shows each skill being installed with a spinner → checkmark. Like:
```
  ◼ morning    — symlinked ✓
  ◼ goblin     — symlinked ✓
  ◻ capacities — installing...
```

### `<Done>`
Final summary. How many skills installed, where, reminder to restart Claude Code.

## Animation details

- **Header**: use cfonts to generate the ASCII art as a string, then render it in ink with color. For animation, cycle through chalk color transforms on mount with useEffect + setInterval, then stop after ~1.5s.
- **Transitions between steps**: a subtle fade or slide isn't really possible in terminals, but you can do a brief spinner between steps, or just instant transitions (which actually feel snappy and good).
- **Install spinners**: use ink-spinner for each skill being installed. Replace with ✓ when done.

## File structure after rewrite

```
install.mjs              — thin entry: imports and calls render(<App />)
src/
  app.jsx                — main App component with step management
  components/
    header.jsx           — cfonts ASCII header with animation
    skill-select.jsx     — multi-select checkboxes
    method-select.jsx    — symlink vs copy
    skill-setup.jsx      — per-skill config prompts
    install-progress.jsx — spinners + completion markers
    done.jsx             — final summary
  lib/
    skills.js            — skill definitions (name, description, hasSetup)
    installer.js         — actual install logic (symlink/copy, remove existing)
    setup-morning.js     — morning config writer
    setup-capacities.js  — capacities config writer
    setup-invoice.js     — invoice-subjects config writer
    detect.js            — git author detection, installed skill detection
```

Keep the business logic in `lib/` separate from the UI in `components/`. The lib files are basically the current install.mjs functions extracted.

## Constraints

- Must work on Node 18+
- Must work on Linux and macOS terminals
- The #!/usr/bin/env node shebang on install.mjs must work
- Don't break existing skill scripts — they stay zero-dep .mjs
- Add node_modules/ to .gitignore
- The installer should gracefully handle Ctrl+C (ink has built-in support for this)
- Keep total install time under 2 seconds for the npm deps (they're small)

## Verification

After rewriting:
1. `node install.mjs` shows the animated header and skill selection
2. Selecting skills and pressing enter moves to method selection
3. Setup flows work for morning, capacities, and invoice-subjects
4. Skills actually get installed to ~/.claude/skills/
5. Re-running shows (installed) markers on already-installed skills
6. Ctrl+C exits cleanly at any point
7. The whole thing looks sick
