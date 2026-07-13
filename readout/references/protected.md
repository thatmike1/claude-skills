# Protected Readouts (password) & Version History

## Protected readouts

Publish with `--password <pw>` (or `READOUT_PASSWORD` env) to gate a readout: the
compiled HTML is encrypted at publish time (PBKDF2-SHA256 → AES-256-GCM) and served
as a static unlock shell — decryption happens in the reader's browser, plaintext
never reaches the server. Share either the bare URL (reader types the password) or
`<url>#pw=<password>` for auto-unlock (fragments never leave the browser).

- Add `protected: true` to the frontmatter — publish then refuses to run without the
  password, so an accidental plaintext republish can't happen.
- The password is stored nowhere; every republish needs it again. Ask the user for it
  rather than inventing one silently.
- Comments still work, end-to-end encrypted: the widget (active only after the reader
  unlocks the page in that tab) encrypts bodies and hashes anchors with keys derived
  from the same password, so the public comments API stores only ciphertext. Read them
  with `read-comments.mjs --password <pw>` (or `READOUT_PASSWORD`). Changing the
  password orphans earlier comments — widget and CLI skip them and the CLI reports the
  count. Anyone with the URL can still post junk ciphertext; timestamps/counts are visible.
- Visits: the `visits.js` beacon rides inside the ciphertext, so a visit is recorded only
  after a successful unlock (locked lurkers don't log). Visit rows (viewer name, UA) are
  plaintext but superuser-read-only — visible to the PocketBase admin, not to visitors.
- Remaining trade-offs, applied automatically: skipped by galleries (title/lead would
  leak), version snapshots stored encrypted — restore via
  `node <skill-dir>/scripts/protect.mjs decrypt --password <pw> <file>`
  with the snapshot's `mdx` field as input.

## Version history

Each publish stores the full MDX snapshot in the `readout_versions` collection
(`doc_id = <project>/<slug>`). To inspect or restore, fetch versions from
`<pbUrl>/api/collections/readout_versions/records?filter=(doc_id='<id>')&sort=-version`
and write the `mdx` field back to the source file.
