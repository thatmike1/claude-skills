# Compile Mode

Turn a braindump into structured tasks.

## Input

Unstructured text — stream of consciousness, voice-to-text dump, rambling notes, scattered thoughts across multiple topics.

## Process

1. Read the entire dump without interrupting
2. Identify distinct topics/threads (even if interleaved)
3. Transform EVERYTHING into actionable items — feelings, observations, and vague thoughts all become concrete next-actions
4. Order tasks by implied urgency or dependency (not alphabetically)

## The Golden Rule: No Limbo Items

Never leave something as "just an observation." Transform it:
- "im so tired" → **Rest for 20 min or take a walk**
- "i feel overwhelmed" → **Pick the single smallest task and do only that**
- "idk if sarah is mad at me" → **Text sarah a casual check-in**
- "the code is a mess" → **Spend 30 min on the worst file only**
- "i should really start eating better" → **Buy 3 easy meal ingredients tomorrow**

The ADHD brain leaves un-actionified thoughts in anxious limbo. Every item gets a verb.

## Output Format

```
## Tasks

**[Topic A]**
- [ ] First actionable thing
- [ ] Second actionable thing

**[Topic B]**
- [ ] Task here
- [ ] Another task
```

## Rules

- Every item starts with a verb and has a clear done-state
- If a "task" is vague ("figure out the thing"), rewrite it as a concrete next action ("research X for 20 min" or "message Y about Z")
- If the dump mentions people, preserve who's responsible
- Time-box anything that could spiral: "research X" → "spend 15 min researching X, then stop"
- Max 2 levels of nesting. No sub-sub-bullets.
- If there are more than 10 tasks, group them under topic headers
- If fewer than 4 tasks, skip the topic headers
- Single-word inputs get expanded into a reasonable task sequence (e.g., "groceries" → plan meals, write list, go to store, put away)

## Follow-up

After outputting, ask: "Want me to **decompose** any of these or **estimate** time for the list?"
