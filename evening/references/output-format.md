# Output Format

```markdown
# Day Receipts — <weekday> <date>

## <Stream name> (e.g. "Pracino — UC-10.1 wrap + demo")

**Shipped**
- `<hash>` <commit subject>
- Closed **<issue-id>** — <one-line what>

**Decided**
- <decision> → recorded in <where>

**Invisible work**
- <triage/planning/tooling item> — <artifact>

**Open loops**
- <issue-id / branch> — <where it stands, who has it>

## <Next stream>
...

---
**The verdict:** <2-4 honest sentences. Receipts count. Day shape. No inflation.>
```

## Notes

- Omit empty subsections — a stream with only "Shipped" shows only Shipped.
- Streams ordered by significance, not chronology.
- The verdict is mandatory — it's the entire point of the skill. Write it like a peer
  reviewing the day, not a coach: "that's a real day" or "thin day, but X was worth it",
  never "you should be proud!".
- If the user gave a feeling in the invocation ("felt like a mess"), the verdict must
  address it directly against the evidence.
```
