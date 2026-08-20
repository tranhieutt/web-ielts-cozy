-- Deck catalog in one round trip.
--
-- WHY: the dashboard needs each published deck's publishable card count. Doing
-- that from the client meant either fetching every card just to call .length
-- (600KB) or one count request per deck. Measured round-trip latency to the
-- project is ~600ms while the count itself executes in ~2ms, so the cost is the
-- number of requests, not the work. This view answers the whole catalog once.
--
-- SECURITY: `security_invoker = on` means the view executes with the caller's
-- privileges, so the existing RLS policies on the underlying tables still
-- decide visibility. A view owned by a privileged role would otherwise bypass
-- them. Unpublished decks and unpublished cards therefore stay invisible here
-- exactly as they are in the base tables.
--
-- ROLLBACK: drop view public.vocabulary_deck_summary;
--   Nothing depends on it in the database; the application falls back by
--   reverting the adapter commit. No data is lost - the view stores nothing.

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
