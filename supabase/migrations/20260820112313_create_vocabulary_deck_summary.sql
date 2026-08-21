-- Recovered from the remote migration history on 2026-08-21.
-- This change was applied to production WITHOUT a committed migration file.
-- The SQL below is the statement list Supabase recorded, reassembled verbatim
-- so the repo finally matches the deployed schema. Do not edit to 'improve' it:
-- it must keep describing what production actually runs.

create or replace view public.vocabulary_deck_summary
with (security_invoker = on) as
select
  d.slug,
  d.display_name_vi,
  d.publish_status,
  count(dc.card_id) as publishable_card_count
from public.vocabulary_decks d
left join public.vocabulary_deck_cards dc on dc.deck_slug = d.slug
group by d.slug, d.display_name_vi, d.publish_status;

comment on view public.vocabulary_deck_summary is
  'Published deck catalog with publishable card counts. security_invoker keeps RLS in force.';

grant select on public.vocabulary_deck_summary to anon, authenticated;
