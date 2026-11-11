---
name: attention-queue
description: Mike's attention queue, his day as a queue of one-thing blocks, read and changed with the `aq` command. Use when asked what Mike is on right now or until when, to put work into his day or attach a report, link or note to a block, to reorder his blocks, or to read how a day went.
---

# attention queue

Mike plans his day as a queue of blocks: one thing per block, about an hour, in order. He works the current block on a page at http://127.0.0.1:1365 and starts the next one himself whenever he is ready. The `aq` command reads and writes the same store as that page, and the page shows any change within a second, so an agent and Mike move the same items.

**Order is the plan; times are estimates.** Every time `aq` prints is a guess counted from now and the remaining durations. A block that runs over, a break, or a reorder simply moves the guesses. Treat `untilAbout`, `aroundStart` and `dayEndsAround` as weather, never as a deadline, and write to Mike the same way: nothing in the queue is late or behind. This is the reason the tool exists; his earlier tool made him feel behind after one bathroom break.

## Read

```
aq now        # mode (block, break, idle, empty), the block he is on with spentMin, plannedMin, untilAbout, and the next one
aq list       # the whole day: upcoming with estimated times and positions, parked, finished
aq log        # every change with time and who made it; aq report gives planned against real minutes per block
```

Every command prints JSON. `aq help` lists all of them. Ids are short slugs from the titles, shown by `aq list`.

## Shape his day

Adding to the queue and kitting out a block is the agent's part:

```
aq add "Read the founder research" --min 45 --step "Open the summary first" --done "Reacted to each agent's findings" --at 3
aq add "GitGuardian" --min 10 --park           # on the side, out of the queue until he queues it
aq link freelance https://everything.thatmike1.dev/#/p/... --label "Report: freelance platforms"
aq link reports-demand /home/thatmike1/git/.../sol.md --label "Sol shortlist"   # local files open on his desktop from the page
aq note room-scan "the Polycam export is in ~/Downloads"
aq move freelance --to 2      # or --before <id> / --after <id>
```

A block's kit is its first concrete step (`--step`), one line of what done looks like (`--done`), links and notes. The step is the first physical action, small enough to start without thinking. Links are what he will open in that block: a report, a file, a T3 thread.

His own controls (`aq start`, `finish`, `break`, `back`, `push`, `more`, `less`, `drop`) work from the command line too, but they are his moves. Use them when he asks you to, and otherwise leave the clock to him.

Changes are logged under `$AQ_ACTOR`, falling back to `$BEADS_ACTOR`, so the page and the log show which agent did what.

## Days

`aq seed <plan.json>` replaces the queue with a new day and archives the old one under `~/.local/share/attention-queue/days/`; `aq log --day YYYY-MM-DD` and `aq report --day ...` read an archived day. The plan format and the rest of the setup (service, port, the planned-time sound) are in `~/git/ccChat-general/projects/attention-queue/README.md`.
