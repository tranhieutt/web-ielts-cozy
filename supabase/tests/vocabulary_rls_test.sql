BEGIN;
SELECT plan(8);

-- Seed only test fixtures. Policies are asserted as anon/authenticated below.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'vocab-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'vocab-other@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.vocabulary_cards (id, word, primary_topic, sort_order, senses, content_status, source_version)
values
  ('w_public', 'public', 'environment', 0, '[{"def_vi":"công khai"}]'::jsonb, 'published', 'v1'),
  ('w_draft', 'draft', 'environment', 1, '[{"def_vi":"nháp"}]'::jsonb, 'draft', 'v1');
insert into public.vocabulary_decks (slug, display_name_vi, publish_status, content_version)
values ('environment', 'Môi trường', 'published', 'v1');
insert into public.vocabulary_deck_cards (deck_slug, card_id, position, is_primary)
values ('environment', 'w_public', 0, true);
insert into public.learner_card_states (learner_id, card_id)
values ('11111111-1111-1111-1111-111111111111', 'w_public');

set local role anon;
select results_eq(
  $$select id from public.vocabulary_cards order by id$$,
  array['w_public'],
  'anon reads published content only'
);
select throws_ok(
  $$insert into public.learner_card_states (learner_id, card_id) values ('11111111-1111-1111-1111-111111111111', 'w_public')$$,
  '42501', null, 'anon cannot write learner state'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select learner_id::text from public.learner_card_states$$,
  array['11111111-1111-1111-1111-111111111111'],
  'owner reads own state'
);
select lives_ok(
  $$insert into public.learner_card_reviews (learner_id, card_id, rating, reviewed_at, previous_state, next_state, next_stage, next_due_at, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 'w_public', 'known', now(), 'new', 'review', 1, now() + interval '1 day', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'owner creates own review'
);
select throws_ok(
  $$insert into public.learner_card_reviews (learner_id, card_id, rating, reviewed_at, previous_state, next_state, next_stage, next_due_at, idempotency_key)
    values ('22222222-2222-2222-2222-222222222222', 'w_public', 'known', now(), 'new', 'review', 1, now() + interval '1 day', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  '42501', null, 'owner cannot create another learner review'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$select * from public.learner_card_states$$,
  'other learner cannot read owner state'
);
select is_empty(
  $$update public.learner_card_states set review_count = 1
    where learner_id = '11111111-1111-1111-1111-111111111111' returning card_id$$,
  'other learner cannot update owner state'
);
reset role;

select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename in ('vocabulary_cards', 'vocabulary_decks', 'vocabulary_deck_cards', 'learner_card_states', 'learner_card_reviews')),
  8::bigint,
  'all Vocabulary tables have explicit policies'
);

SELECT * FROM finish();
ROLLBACK;
