# readout — PocketBase server setup

The readout site is served by a single PocketBase instance at
`https://readout.ssscribe.app`: it hosts the compiled static site from
`pb_public/` **and** exposes the API on the same origin. Because the widget and
the API share an origin, the compiled pages need no injected config and no keys.

## 1. Import the collections

`pb-collections.json` defines both collections (`readout_comments`,
`readout_versions`) in the PocketBase v0.23+ import format.

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

Public rules are the empty string `""` (everyone); superuser-only rules are
`null`. Comment row shape is enforced by the field `required` + `max`
constraints (`doc_id`/`anchor_id` ≤ 200, `author` ≤ 80, `body` ≤ 4000).

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

## 3. Moderation

There is no public delete rule, so comments can only be removed by a superuser.
Delete an unwanted comment from **Admin UI → Collections → readout_comments**,
select the row, delete. That is the whole moderation story for the MVP.
