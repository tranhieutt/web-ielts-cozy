# Runbook — Vocabulary rollback and backup

**Task:** `VOC-QA-08`. This is an input to the beta acceptance review (`VOC-QA-07`), not a by-product of it.

**Scope:** the Vocabulary release — published content, learner data, schema, and the audio artifact.

**Project:** `iixvtoaifxuqjjdbwrzh`. There is currently **one** Supabase project serving every environment; see [Known gaps](#known-gaps).

---

## 1. Pull beta content back to draft

**When:** published content turns out to be wrong — bad translations, wrong deck, mispronounced audio — and learners must stop seeing it now.

**Effect:** RLS hides the decks and their cards immediately. Learner progress is untouched: `learner_card_states` and `learner_card_reviews` keep referencing the cards, so re-publishing restores the learner's position exactly.

```bash
node ./scripts/vocabulary/publish-beta-decks.mjs --apply --unpublish
```

Re-publish with the same script minus `--unpublish`. Both directions are idempotent.

**Verify** (must print 0 decks):

```bash
node ./scripts/vocabulary/publish-beta-decks.mjs
```

then confirm what a learner actually sees, using the anon key rather than trusting the script's own output:

```bash
curl -s "$SUPABASE_URL/rest/v1/vocabulary_decks?select=slug" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "authorization: Bearer $SUPABASE_PUBLISHABLE_KEY"
```

**Caveat:** unpublishing a deck does not unpublish cards it shares with other published decks — by design. If a specific *card* is the problem, it must be pulled everywhere, not just from one deck.

---

## 2. Restore a previous content version

Every card carries `source_version`, the SHA of the canonical catalog it was built from. Current published version:

```
c6b29ad42c4564ff70b40a2771339ad470269d3d12a68ddf304823bdc3a99e4d
```

To go back to an earlier catalog:

1. Check out the commit whose `.generated/vocabulary/catalog-v1/manifest.json` carries the wanted `catalog_sha256`.
2. Dry-run and confirm the count and version look right:
   ```bash
   node ./scripts/vocabulary/import-catalog-to-supabase.mjs
   ```
3. Apply. The importer upserts by card id, so it overwrites in place rather than duplicating:
   ```bash
   node ./scripts/vocabulary/import-catalog-to-supabase.mjs --apply
   node ./scripts/vocabulary/import-decks-to-supabase.mjs --apply
   ```

**What this does NOT do:** cards removed from the newer catalog are not deleted by an upsert — they linger at the old version. After any rollback, check for mixed versions:

```sql
select source_version, count(*) from vocabulary_cards group by source_version;
```

More than one row means the catalog is not internally consistent. Decide deliberately whether to delete the strays; a card still referenced by `learner_card_states` cannot be deleted (`on delete restrict`), which is intentional — it stops a content rollback from silently destroying learner history.

---

## 3. Roll back a schema migration

Migrations live in `supabase/migrations/` and each carries its own rollback note. `AGENTS.md` requires that note before a migration is written; a migration without one is not ready to apply.

State of the migration history:

```bash
npx supabase migration list
```

Any row with a remote version and no local file means **someone changed production outside the repo**. That happened once (seven migrations, recovered 2026-08-21) and it disables both `db push` and `db pull` until fixed. Recover rather than repair: read the recorded statements and commit them as files.

```sql
select version, name, array_to_string(statements, E';\n') from supabase_migrations.schema_migrations order by version;
```

Do **not** run `supabase migration repair --status reverted` on a migration that really was applied. It rewrites history to say something untrue and the drift comes back the next time anyone looks.

### Reverting the two functions

```sql
-- VOC-WEB-10, self-service deletion. Safe: no table, grant or policy depends on it.
drop function if exists public.delete_my_vocabulary_data();
```

`submit_vocabulary_review` is different: **the app cannot record a review without it.** Do not drop it to "roll back" a problem — restore the previous definition from the migration that created it instead. The version history in `supabase/migrations/20260820*` is ordered, and each file contains a complete `create or replace`, so applying an earlier file is the rollback.

⚠️ The current definition carries two properties that were added after production incidents. Any replacement must keep both:
- the compare-and-swap guard (`where s.state = p_expected_state`), without which two concurrent tabs lose an update;
- `PT409` rather than `40001`, because PostgREST auto-retries `serialization_failure` and turns one lost race into an unbounded retry loop.

---

## 4. Learner data

**A learner deleting their own data** is a normal action, not an incident: `delete_my_vocabulary_data()` removes their states and events in one transaction. It is **not recoverable** except from a database backup — the confirmation dialog says so to the learner.

**Deleting an anonymous user** cascades to both learner tables (`on delete cascade`). This is how the ADR-004 retention job will work, and how the integration suite cleans up after itself.

**Point-in-time recovery** is the only route back for deleted learner rows. Confirm the retention window on the project's backup settings before an incident, not during one.

---

## 5. Audio artifact

**Status: there is no backup.** `VOC-INFRA-03` is open.

10,550 generated MP3 files exist on the Supabase storage bucket and on one local machine. `.gitignore` excludes `.generated/audio/`, so the repo holds nothing. If the bucket and that machine are lost on the same day, the entire set must be regenerated through Google TTS at full cost.

Audio delivery is gated off (`VOCABULARY_AUDIO_ENABLED`, ADR-003), so this is not learner-facing today. It becomes a release blocker the moment the gate opens.

Until `VOC-INFRA-03` lands, the honest rollback plan for audio is: regenerate. `scripts/vocabulary/generate-audio.mjs` keeps a checkpoint and resumes.

---

## 6. Verify after any rollback

Run these three, in order. Each checks something the previous one cannot.

```bash
npm test                        # domain and contract, offline
npm run vocab:test-integration  # transaction, idempotency, RLS, durability — against the real project
npm run test:e2e                # learner journeys in a browser
```

Then confirm with a learner's own eyes, not with a report: open `/vocabulary`, check the deck list matches what you intended to publish, start a session, rate one card, reload, and confirm the progress survived.

---

## Known gaps

These are real and named rather than papered over. Each is a task, not a caveat.

| Gap | Task | Consequence today |
|---|---|---|
| No audio backup | `VOC-INFRA-03` | Losing the bucket means regenerating 10,550 files |
| One Supabase project for every environment | D-17 not implemented | A rollback rehearsal *is* a production change; there is nowhere to practise |
| Retention policy not enforced | `VOC-INFRA-09` | ADR-004's 3-month rule exists on paper only |
| Backup/PITR window unconfirmed | — | The recovery window for deleted learner data is unknown |
