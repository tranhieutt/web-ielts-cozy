# Vocabulary schema rollback

## Scope

Migration `20260820041818_create_vocabulary_catalog_and_learner_state.sql` creates Vocabulary catalog, learner state/review tables, indexes, grants and RLS policies. It creates no content rows and does not change Auth users or audio storage.

## Before apply

1. Run `supabase test db` locally with Docker or via GitHub workflow `Vocabulary database tests`, including `supabase/tests/vocabulary_rls_test.sql`.
2. Run `npx supabase@latest db advisors` against target project; resolve security findings.
3. Confirm no production importer/API is writing these tables.

## Apply

Use Supabase CLI migration workflow. Verify migration list, then run RLS test against local staging schema before deploy. Do not use service-role credentials in browser code.

## Rollback

Because this migration has no seeded learner progress, rollback before importer/API release is reversible:

```sql
drop table if exists public.learner_card_reviews;
drop table if exists public.learner_card_states;
drop table if exists public.vocabulary_deck_cards;
drop table if exists public.vocabulary_decks;
drop table if exists public.vocabulary_cards;
```

After any learner progress exists, do not drop tables. Create a forward migration to disable application traffic or fix schema/policy, export affected records, and preserve review audit history.
