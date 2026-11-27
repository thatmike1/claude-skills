---
name: attention-queue
description: Mike's attention queue, his day as a queue of one-thing blocks plus a dump shelf of raw thoughts, read and changed with the `aq` command. Use when asked what Mike is on right now or until when, to check or plan from his dump ("check the brain dump", "plan the day", "give it structure"), to work on what is next in his queue, to put work into his day or attach a report, link or note to a block, to reorder his blocks, or to read how a day went. Also whenever a thread does work that a block in today's queue stands for, so the block moves with it.
---

# attention queue

Mike plans his day as a queue of blocks: one thing per block, about an hour, in order. He works the current block on a page at http://127.0.0.1:1365. The `aq` command reads and writes the same store as that page, and the page shows any change within a second, so an agent and Mike move the same items.

**Order is the plan; times are estimates.** Every time `aq` prints is a guess counted from now and the remaining durations. A block that runs over, a break, or a reorder simply moves the guesses. Treat `untilAbout`, `aroundStart` and `dayEndsAround` as weather, never as a deadline, and write to Mike the same way: nothing in the queue is late or behind. This is the reason the tool exists; his earlier tool made him feel behind after one bathroom break.

**The queue has to match what really happened.** He opens the page to find out what to do next, so a block whose work is finished but still shows as next leaves him stuck. On 12 Nov 2026 agents launched and read back the founder research in their threads, noted "tick it whenever" on the blocks, and never moved them; the next day the page still showed the launch as next. Whoever does a block's work moves the block:

- When a thread takes up a block's work ("let's do what's next", or work that matches a block's title), run `aq start <id>` as the work begins. If he is on a different block, leave that one alone and tell him which block this work belongs to.
- When the block's done line is met, run `aq finish <id>`, with `--spent N` when you know the real minutes. A block that never ran is closed off the clock and shows as such; never leave a note asking him to tick it.
- Work that lands for a block later in the queue (an agent finished early) gets a note, and `aq finish` too if its done line is met.
- Before ending a turn that touched queue work, run `aq now` and check it shows what is true.

**Tie every block to its bead.** `aq bead <id> <bead id>` (or `--bead` on `aq add`). The page then shows the bead's state and the headline of its newest comment, and once every tied bead is closed, a block that is still waiting finishes itself. Your bead comments keep the block current that way, even in a thread that never ran `aq`. A block with no bead behind it (a chore, a call) stays untied.

`aq break`, `back`, `push`, `more`, `less` and `drop` stay his moves: use them when he asks.

## The dump and the planning pass

Since 17 Nov 2026 he types thoughts onto a **dump shelf** on the page: a title, maybe a description later, no length and no place. Dumped blocks sit outside the queue and its estimates (`aq list` → `dumped`). When he says "check the dump", "plan the day" or "give it structure", the pass is yours:

- Read every dumped block, and the beads, notes and threads it points at, until you know what he meant. Where two readings fit, ask in one line before planning it.
- Every dumped item leaves the pass tied to a bead: search the backlog for the one it belongs to (`beadside search <words>`), and when none fits, create one under its home epic. Then `aq bead <id> <bead id>`, so the page shows where it stands and the block finishes itself when the bead closes.
- For each one that belongs in today: `aq plan <id> --min N --at N --title "..." --description "..." --step "..." --done "..."`. Your title and description replace what the page shows; **his own words are kept apart and never change** (`hisWords` in `aq list`, a "Your words" toggle on the page). Rewrite for clarity, keep his intent, and do not invent scope he did not ask for.
- Minutes are a rough guess for his own hands-on time, 30 when unsure. Agent runs inside a block finish far faster than a model predicts, so do not pad for them; his estimates get corrected by `aq report`, not by buffers.
- What is not for today: `aq park <id>` (his, when there is room), `aq wait <id> <who>` when someone else has to move first, or leave it dumped. Anything bigger than a day, or not a day's task at all, goes to a bead and off the queue (`aq drop`, with a note naming the bead).
- Then tell him the order you chose and why in a few lines, and what you parked or left.

Never show or mention how long an item has sat in the dump: he expects an age on it to make him avoid it.

The page also shows today's day plan from the Everything app (`Days/<date>`) with a "Dump it" per line; lines he sends over carry `fromPlan`. `aq dump "title" [--description d]` puts something on the shelf for him. `aq undump <id>` sends a block back.

**Beside him: the second lane.** Work that goes on without his attention sits in a lane at the foot of the block card, off his clock, so he can start the next block. Two kinds:

- `aq beside <id> "Opus thread"` when a block's work now runs on its own: you launched a thread or a render for it and he moves on. Without an id it takes the block he is on. Link the thread on the block (`aq link`), and `aq finish <id>` when the run is done and reviewed; `aq beside <id> --clear` makes it his own parked block again. A block whose agent finished but still needs his review goes back to him with `aq unpark <id> --at 1`.
- `aq wait <id> <who>` parks a block as blocked on that person; the lane marks one "moved" when its tied bead gets a newer comment than the wait. `aq wait <id> --clear` makes it his again; queuing it clears the wait.

`aq now` lists the blocks running beside him as `beside` (waiting ones only in `aq list`, so `aq now` reads as it always did); `aq list` shows `runsBeside` or `waitingOn` on parked blocks. Finishing, dropping or queuing a block takes it out of the lane. Like waiting blocks, a lane block finishes itself once all its tied beads close.

## Read

```
aq now        # mode (block, break, idle, empty), the block he is on with spentMin, plannedMin, untilAbout, and the next one
aq list       # the whole day: upcoming with estimated times and positions, dumped, parked (waitingOn, runsBeside), finished
aq log        # every change with time and who made it; aq report gives planned against real minutes per block
```

Every command prints JSON. `aq help` lists all of them. Ids are short slugs from the titles, shown by `aq list`. The same actions answer over MCP at http://127.0.0.1:1365/mcp (tools `queue_now`, `queue_dump`, `queue_start` and so on; `/setup` has the lines); in a shell, `aq` is the way in.

A `stale` field means the queue is still on an earlier day. Run `aq carry`: it archives that day and starts today with every block not done or dropped, in order, kits intact, clocks clean. Then tell him what came along.

## Shape his day

Adding to the queue and kitting out a block is the agent's part:

```
aq add "Read the founder research" --min 45 --step "Open the summary first" --done "Reacted to each agent's findings" --bead ccChat-general-g56f --at 3
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

His raw plan for a day is what he dictates to ChatGPT, saved in the Everything app as `Days/<date>`. The queue is the shaped version: when he asks to plan or load a day, read that page and turn it into blocks with kits and beads. There is no sync between the two.

`aq carry` rolls an unfinished day into today. Kept days stay readable on the page (`← day` beside the date) and through `aq log --day` / `aq report --day`. `aq seed <plan.json>` replaces the queue with a new plan and archives the old one; the store is one SQLite file, `~/.local/share/attention-queue/queue.db`, snapshotted nightly to the encrypted Drive backup; `aq log --day YYYY-MM-DD` and `aq report --day ...` read an archived day. The plan format and the rest of the setup (service, port, the planned-time sound) are in `~/git/ccChat-general/projects/attention-queue/README.md`.
