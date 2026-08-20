-- Vocabulary catalog is immutable per source_version. Only trusted importer
-- credentials write content; learners receive published rows through RLS.

create table public.vocabulary_cards (
  id text primary key,
  word text not null check (length(trim(word)) > 0),
  is_phrase boolean not null default false,
  primary_topic text not null check (length(trim(primary_topic)) > 0),
  topics_all jsonb not null default '[]'::jsonb,
  sort_order integer not null check (sort_order >= 0),
  cefr text,
  target_band text,
  phonetic jsonb,
  senses jsonb not null check (jsonb_array_length(senses) > 0),
  examples jsonb,
  collocations jsonb,
  audio_version text,
  audio_path_uk text,
  audio_path_us text,
  content_status text not null default 'draft'
    check (content_status in ('draft', 'published', 'archived')),
  source_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vocabulary_decks (
  slug text primary key,
  display_name_vi text not null check (length(trim(display_name_vi)) > 0),
  description text,
  publish_status text not null default 'draft'
    check (publish_status in ('draft', 'published', 'archived')),
  content_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vocabulary_deck_cards (
  deck_slug text not null references public.vocabulary_decks(slug) on delete cascade,
  card_id text not null references public.vocabulary_cards(id) on delete restrict,
  position integer not null check (position >= 0),
  is_primary boolean not null default false,
  primary key (deck_slug, card_id),
  unique (deck_slug, position)
);

create index vocabulary_cards_publish_topic_order_idx
  on public.vocabulary_cards (primary_topic, sort_order, id)
  where content_status = 'published';
create index vocabulary_deck_cards_card_id_idx
  on public.vocabulary_deck_cards (card_id);

create table public.learner_card_states (
  learner_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.vocabulary_cards(id) on delete restrict,
  state text not null default 'new'
    check (state in ('new', 'learning', 'review', 'mastered')),
  stage smallint,
  due_at timestamptz,
  first_seen_at timestamptz,
  last_reviewed_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learner_id, card_id),
  constraint learner_card_states_valid_stage check (
    (state = 'new' and stage is null and due_at is null)
    or (state = 'learning' and stage = 0 and due_at is not null)
    or (state = 'review' and stage between 1 and 5 and due_at is not null)
    or (state = 'mastered' and stage = 6 and due_at is not null)
  )
);

create table public.learner_card_reviews (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.vocabulary_cards(id) on delete restrict,
  rating text not null check (rating in ('again', 'known')),
  reviewed_at timestamptz not null,
  previous_state text not null check (previous_state in ('new', 'learning', 'review', 'mastered')),
  previous_stage smallint,
  next_state text not null check (next_state in ('learning', 'review', 'mastered')),
  next_stage smallint not null check (next_stage between 0 and 6),
  next_due_at timestamptz not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (learner_id, idempotency_key)
);

create index learner_card_states_due_idx
  on public.learner_card_states (learner_id, due_at, card_id);
create index learner_card_reviews_learner_card_reviewed_idx
  on public.learner_card_reviews (learner_id, card_id, reviewed_at desc);

alter table public.vocabulary_cards enable row level security;
alter table public.vocabulary_decks enable row level security;
alter table public.vocabulary_deck_cards enable row level security;
alter table public.learner_card_states enable row level security;
alter table public.learner_card_reviews enable row level security;

revoke all on table public.vocabulary_cards, public.vocabulary_decks,
  public.vocabulary_deck_cards, public.learner_card_states,
  public.learner_card_reviews from anon, authenticated;

grant select on table public.vocabulary_cards, public.vocabulary_decks,
  public.vocabulary_deck_cards to anon, authenticated;
grant select, insert, update on table public.learner_card_states to authenticated;
grant select, insert on table public.learner_card_reviews to authenticated;

create policy "published vocabulary cards are readable"
  on public.vocabulary_cards for select to anon, authenticated
  using (content_status = 'published');

create policy "published vocabulary decks are readable"
  on public.vocabulary_decks for select to anon, authenticated
  using (publish_status = 'published');

create policy "published deck cards are readable"
  on public.vocabulary_deck_cards for select to anon, authenticated
  using (
    exists (
      select 1 from public.vocabulary_decks deck
      where deck.slug = vocabulary_deck_cards.deck_slug
        and deck.publish_status = 'published'
    )
    and exists (
      select 1 from public.vocabulary_cards card
      where card.id = vocabulary_deck_cards.card_id
        and card.content_status = 'published'
    )
  );

create policy "learners read their own card states"
  on public.learner_card_states for select to authenticated
  using ((select auth.uid()) = learner_id);
create policy "learners create their own card states"
  on public.learner_card_states for insert to authenticated
  with check ((select auth.uid()) = learner_id);
create policy "learners update their own card states"
  on public.learner_card_states for update to authenticated
  using ((select auth.uid()) = learner_id)
  with check ((select auth.uid()) = learner_id);

create policy "learners read their own card reviews"
  on public.learner_card_reviews for select to authenticated
  using ((select auth.uid()) = learner_id);
create policy "learners create their own card reviews"
  on public.learner_card_reviews for insert to authenticated
  with check ((select auth.uid()) = learner_id);
