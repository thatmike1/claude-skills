---
name: capacities
description: Interact with Capacities.io PKM system. Save notes to daily notes, save weblinks, search/lookup content, and read space structure. Use when user mentions capacities, daily note, second brain, PKM, or wants to save/push information to their knowledge base.
---

# Capacities

Push content to and query from Capacities.io via their API.

## Auth

See [references/auth.md](references/auth.md) for the bearer token.

## Space

- **Space ID:** `YOUR_SPACE_ID`
- **Space Name:** Your space name

## Available Actions

### 1. Save to Daily Note

Appends markdown text to today's daily note. Best for: quick captures, task lists, braindump outputs, session summaries.

```bash
curl -s -X POST "https://api.capacities.io/save-to-daily-note" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "spaceId": "YOUR_SPACE_ID",
    "mdText": "## My Note\n\nContent here in **markdown**",
    "origin": "mcp",
    "noTimeStamp": false
  }'
```

- `mdText`: markdown content (max 200,000 chars)
- `origin`: use `"mcp"` for Claude-originated saves
- `noTimeStamp`: set `true` to skip the timestamp prefix
- Rate limit: 5 requests per 60 seconds

### 2. Save Weblink

Saves a URL as a weblink object in the space.

```bash
curl -s -X POST "https://api.capacities.io/save-weblink" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "spaceId": "YOUR_SPACE_ID",
    "url": "https://example.com",
    "titleOverwrite": "Custom title",
    "descriptionOverwrite": "What this link is about",
    "tags": ["tag1", "tag2"],
    "mdText": "Notes about this link in **markdown**"
  }'
```

- Tags must match existing tag names or they get created
- Rate limit: 10 requests per 60 seconds

### 3. Lookup / Search

Search for content by title.

```bash
curl -s -X POST "https://api.capacities.io/lookup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "search query",
    "spaceId": "YOUR_SPACE_ID"
  }'
```

Returns: `{results: [{id, structureId, title}]}`
Rate limit: 120 requests per 60 seconds

### 4. Get Space Info

Read object types and their properties (already cached in [references/structures.md](references/structures.md)).

## Object Types

Run the "Get Space Info" action to discover your space's object types and their IDs. The installer will cache these in `references/structures.md` during setup.

## Limitations (Beta API)

- No generic "create object" endpoint yet — can't directly create Projects, Atomic Notes, etc.
- Primary write path is **daily notes** and **weblinks**
- No update/delete endpoints
- No read content endpoint (can't fetch object body text)
- Rate limits are per-user, per-endpoint

## Usage Patterns

**Quick capture from conversation:**
Save to daily note with a heading and bullet points.

**Goblin skill output → Capacities:**
After compiling/decomposing tasks, offer to push the result to today's daily note as a checklist.

**Save a reference:**
When researching something, save interesting URLs as weblinks with tags and notes.

**Search before creating:**
Always lookup first to avoid duplicates.
