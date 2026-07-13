# readout — PocketBase server setup

The readout site is served by a single PocketBase instance at
`https://readout.ssscribe.app`: it hosts the compiled static site from
`pb_public/` **and** exposes the API on the same origin. Because the widget and
the API share an origin, the compiled pages need no injected config and no keys.

## 1. Import the collections

`pb-collections.json` defines the collections (`readout_comments`,
`readout_versions`, `readout_visits`) in the PocketBase v0.23+ import format.

1. Open the admin UI: `https://readout.ssscribe.app/_/`.
2. Go to **Settings → Import collections**.
3. Load `pb-collections.json` (paste its contents or choose the file).
4. Leave **"Merge with existing"** on so a re-import updates rather than wipes.
   Do **not** enable the "delete missing collections" option unless you intend
   to drop everything else.
5. Review the diff, then **Import**.

Resulting API rules:

| collection | list | view | create | update | delete |
| --- | --- | --- | --- | --- | --- |
| `readout_comments` | public | public | public | superuser | superuser |
| `readout_versions` | public | public | superuser | superuser | superuser |
| `readout_visits` | superuser | superuser | public | superuser | superuser |

`readout_visits` is the visit log written by the `visits.js` beacon (one row
per tab-session per doc: `doc_id`, `viewer`, `ua`, `referrer`). Reads are
superuser-only so viewer names never leak to other visitors; `read-visits.mjs`
reads it with the `pbToken`.

Public rules are the empty string `""` (everyone); superuser-only rules are
`null`. Comment row shape is enforced by the field `required` + `max`
constraints (`doc_id`/`anchor_id` ≤ 200, `author` ≤ 80, `body` ≤ 4000).

Workflow fields on `readout_comments`: `parent_id` (reply threading),
`audience` (`agent` | `human` routing; empty means agent), `resolved` and
`consumed` (bools, written only by `read-comments.mjs` with the superuser
token — the public create rule technically accepts them on new rows, which is
harmless).

To apply a schema change to a running instance without the admin UI, PATCH the
collection with the superuser token:

```bash
curl -s -X PATCH "https://readout.ssscribe.app/api/collections/readout_comments" \
  -H "Authorization: <pbToken>" -H "Content-Type: application/json" \
  -d "$(node -e "const c=JSON.parse(require('fs').readFileSync('pb-collections.json','utf8')).find(c=>c.name==='readout_comments');process.stdout.write(JSON.stringify({fields:c.fields,indexes:c.indexes}))")"
```

To create a NEW collection on a running instance (e.g. `readout_visits` on a
box that predates it), POST the full definition instead (run from `server/`):

```bash
curl -s -X POST "https://readout.ssscribe.app/api/collections" \
  -H "Authorization: <pbToken>" -H "Content-Type: application/json" \
  -d "$(node -e "const c=JSON.parse(require('fs').readFileSync('pb-collections.json','utf8')).find(c=>c.name==='readout_visits');process.stdout.write(JSON.stringify(c))")"
```

## 2. Superuser token for the publish script

`readout_versions` create/update/delete are superuser-only, so the publish
script must authenticate as a superuser before writing.

```bash
# obtain a superuser auth token (valid for the configured token duration)
curl -s -X POST \
  "https://readout.ssscribe.app/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity":"you@example.com","password":"<superuser-password>"}' \
  | jq -r '.token'
```

Send the returned token as `Authorization: <token>` (PocketBase accepts the raw
token, no `Bearer` prefix required) on write requests to
`/api/collections/readout_versions/records`.

For an unattended publisher, prefer a dedicated superuser account whose
credentials live in the publish environment rather than reusing a human admin
login. To impersonate without shipping a password, an existing superuser can
mint a longer-lived token from **Admin UI → Collections → _superusers → (pick
the account) → Impersonate**, which returns a token with a chosen duration.

## 3. Caddy access logs (IP-level supplement)

The `visits.js` beacon is the primary who/when source, but only fires when the
page's JS runs. For a raw request-level record (curl, bots, JS-disabled), turn
on access logging in the shared Caddy on the VPS — inside the
`readout.ssscribe.app` site block in `/opt/messscribe/Caddyfile`:

```
log {
    output file /data/access-readout.log {
        roll_size 10MiB
        roll_keep 5
    }
}
```

Back up the Caddyfile first (`/root/backups/`), then reload:
`cd /opt/messscribe && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`.
Logs are JSON lines inside the caddy container's `/data` volume. Quick tail:

```bash
docker compose exec caddy sh -c 'tail -200 /data/access-readout.log' \
  | jq -r 'select(.request.uri|test("\\.html$|/$")) | [.ts|todate, .request.remote_ip, .request.uri] | @tsv'
```

## 4. Moderation

There is no public delete rule, so comments can only be removed by a superuser.
Delete an unwanted comment from **Admin UI → Collections → readout_comments**,
select the row, delete. That is the whole moderation story for the MVP.
