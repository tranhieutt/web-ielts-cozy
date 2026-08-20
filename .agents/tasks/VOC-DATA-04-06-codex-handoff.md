# Handoff: VOC-DATA-04, VOC-DATA-05, VOC-DATA-06

## Changed files

- `scripts/vocabulary/build-deck-membership.mjs`
- `scripts/vocabulary/deck-metadata.mjs`
- `scripts/vocabulary/import-decks-to-supabase.mjs`
- `test/vocabulary/deck-membership.test.mjs`
- `package.json`
- `docs/runbooks/vocabulary-content-build.md`
- `docs/product/VOCABULARY_EXECUTION_PLAN.md`

## Behavior delivered

- Catalog importer remains canonical JSONL-only and idempotent, writing cards as `draft`.
- Deck importer maps every `topics_all` membership without duplicating card identity. It creates 23 Vietnamese-named draft decks and 8,271 memberships.
- Deck `content_version` comes from canonical catalog `manifest.json` SHA, matching card `source_version`; hard-coded `v1` removed.
- `npm run vocab:import-decks` dry-runs. `--apply` requires local Supabase service-role credentials and does not publish decks.
- CI contract glob now runs deck mapping regression tests.

## Contracts or migrations changed

No migration or public API contract changed. Existing catalog/deck schema used unchanged.

## Tests run and result

```text
node --test test/vocabulary/*.test.mjs  -> 13 pass, 0 fail
npm run vocab:normalize-content -- --out-dir .tmp/vocabulary-catalog --apply -> 5,275 cards, 7,309 definitions
node scripts/vocabulary/validate-content.mjs --canonical-dir .tmp/vocabulary-catalog -> pass
npm run vocab:import-catalog -> dry-run: 5,275 cards
npm run vocab:import-decks -> dry-run: 23 decks, 8,271 memberships, catalog SHA matched
git diff --check -> pass
```

## Risks / follow-ups

- Do not run either importer with `--apply` until Product approves beta deck list and reviewer approves target environment.
- VOC-DATA-07 remains blocked by VOC-PLAN-02: select beta decks and publish statuses. Recommended set in spec is Environment, Education, Technology, General Academic; it is not an approval.
- M2 API must use server-side boundary per D-13; browser must not receive service-role credential.
- Repo lacks Next.js BFF/Supabase client, and local `supabase/config.toml` has anonymous sign-ins disabled. Do not start VOC-API-01 until Claude/Product approves runtime/bootstrap scope and anonymous-auth configuration.
- Remaining release gates: translation audit, pronunciation QA, consent/age decision, audio backup, branch protection required check.
