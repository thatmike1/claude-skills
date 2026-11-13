---
name: attention-queue
description: Mike's attention queue, his day as a queue of one-thing blocks, read and changed with the `aq` command. Use when asked what Mike is on right now or until when, to work on what is next in his queue, to put work into his day or attach a report, link or note to a block, to reorder his blocks, or to read how a day went. Also whenever a thread does work that a block in today's queue stands for, so the block moves with it.
---

# attention queue

Mike plans his day as a queue of blocks: one thing per block, about an hour, in order. He works the current block on a page at http://127.0.0.1:1365. The `aq` command reads and writes the same store as that page, and the page shows any change within a second, so an agent and Mike move the same items.

**Order is the plan; times are estimates.** Every time `aq` prints is a guess counted from now and the remaining durations. A block that runs over, a break, or a reorder simply moves the guesses. Treat `untilAbout`, `aroundStart` and `dayEndsAround` as weather, never as a deadline, and write to Mike the same way: nothing in the queue is late or behind. This is the reason the tool exists; his earlier tool made him feel behind after one bathroom break.

**The queue has to match what really happened.** He opens the page to find out what to do next, so a block whose work is finished but still shows as next leaves him stuck. On 12 Nov 2026 agents launched and read back the founder research in their threads, noted "tick it whenever" on the blocks, and never moved them; the next day the page still showed the launch as next. Whoever does a block's work moves the block:

- When a thread takes up a block's work ("let's do what's next", or work that matches a block's title), run `aq start <id>` as the work begins. If he is on a different block, leave that one alone and tell him which block this work belongs to.
- When the block's done line is met, run `aq finish <id>`, with `--spent N` when you know the real minutes. A block that never ran is closed off the clock and shows as such; never leave a note asking him to tick it.
- Work that lands for a block later in the queue (an agent finished early) gets a note, and `aq finish` too if its done line is met.
- Before ending a turn that touched queue work, run `aq now` and check it shows what is true.

`aq break`, `back`, `push`, `more`, `less` and `drop` stay his moves: use them when he asks.

## Read

```
aq now        # mode (block, break, idle, empty), the block he is on with spentMin, plannedMin, untilAbout, and the next one
aq list       # the whole day: upcoming with estimated times and positions, parked, finished
aq log        # every change with time and who made it; aq report gives planned against real minutes per block
```

Every command prints JSON. `aq help` lists all of them. Ids are short slugs from the titles, shown by `aq list`.

A `stale` field means the queue is still on an earlier day. Run `aq carry`: it archives that day and starts today with every block not done or dropped, in order, kits intact, clocks clean. Then tell him what came along.

## Shape his day

Adding to the queue and kitting out a block is the agent's part:

```
aq add "Read the founder research" --min 45 --step "Open the summary first" --done "Reacted to each agent's findings" --at 3
aq add "GitGuardian" --min 10 --park           # on the side, out of the queue until he queues it
aq link freelance https://everything.thatmike1.dev/#/p/... --label "Report: freelance platforms"
aq link reports-demand /home/thatmike1/git/.../sol.md --label "Sol shortlist"
aq note room-scan "the Polycam export is in ~/Downloads"
aq move freelance --to 2      # or --before <id> / --after <id>
```

A block's kit is its first concrete step (`--step`), one line of what done looks like (`--done`), links and notes. The step is the first physical action, small enough to start without thinking. Links are what he will open in that block, and the page opens each kind its own way:

- web links open in a browser tab;
- markdown files (absolute path or `file://`) open in the page's own reader panel, so link the report itself rather than a folder;
- other local files go to the desktop's default app;
- a T3 thread is `t3-thread://v2/<environmentId>/<threadId>`, the form settle-sweep prints. T3 has no deep link yet, so the page shows the thread's real title to find in the sidebar.

Changes are logged under `$AQ_ACTOR`, falling back to `$BEADS_ACTOR`, so the page and the log show which agent did what.

## Days

`aq carry` rolls an unfinished day into today. `aq seed <plan.json>` replaces the queue with a new plan and archives the old one under `~/.local/share/attention-queue/days/`; `aq log --day YYYY-MM-DD` and `aq report --day ...` read an archived day. The plan format and the rest of the setup (service, port, the planned-time sound) are in `~/git/ccChat-general/projects/attention-queue/README.md`.
