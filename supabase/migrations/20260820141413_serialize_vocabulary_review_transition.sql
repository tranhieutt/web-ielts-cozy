-- Recovered from the remote migration history on 2026-08-21.
-- This change was applied to production WITHOUT a committed migration file.
-- The SQL below is the statement list Supabase recorded, reassembled verbatim
-- so the repo finally matches the deployed schema. Do not edit to 'improve' it:
-- it must keep describing what production actually runs.

drop function if exists public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, timestamptz
);

create function public.submit_vocabulary_review(
  p_card_id text,
  p_rating text,
  p_idempotency_key uuid,
  p_reviewed_at timestamptz,
  p_expected_state text,
  p_expected_stage smallint,
  p_next_state text,
  p_next_stage smallint,
  p_next_due_at timestamptz
)
returns table (
  result_card_id text,
  result_state text,
  result_stage smallint,
  result_due_at timestamptz,
  replayed boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_learner uuid := (select auth.uid());
  v_prev_state text;
  v_prev_stage smallint;
  v_first_seen timestamptz;
  v_count integer;
  v_found boolean;
begin
  if v_learner is null then
    raise exception 'submit_vocabulary_review requires an authenticated learner'
      using errcode = '28000';
  end if;

  return query
    select r.card_id, r.next_state, r.next_stage, r.next_due_at, true
    from public.learner_card_reviews r
    where r.learner_id = v_learner and r.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  if not exists (select 1 from public.vocabulary_cards c where c.id = p_card_id) then
    raise exception 'unknown card: %', p_card_id using errcode = 'P0002';
  end if;

  select s.state, s.stage, s.first_seen_at, s.review_count
    into v_prev_state, v_prev_stage, v_first_seen, v_count
  from public.learner_card_states s
  where s.learner_id = v_learner and s.card_id = p_card_id
  for update;

  v_found := found;
  v_prev_state := coalesce(v_prev_state, 'new');
  v_count := coalesce(v_count, 0);

  if v_prev_state is distinct from p_expected_state
     or v_prev_stage is distinct from p_expected_stage
     or (not v_found and p_expected_state <> 'new') then
    raise exception 'stale learner state for card %: expected %/% but found %/%',
      p_card_id, p_expected_state, p_expected_stage, v_prev_state, v_prev_stage
      using errcode = '40001';
  end if;

  begin
    insert into public.learner_card_reviews (
      learner_id, card_id, rating, reviewed_at,
      previous_state, previous_stage, next_state, next_stage, next_due_at,
      idempotency_key
    ) values (
      v_learner, p_card_id, p_rating, p_reviewed_at,
      v_prev_state, v_prev_stage, p_next_state, p_next_stage, p_next_due_at,
      p_idempotency_key
    );
  exception when unique_violation then
    return query
      select r.card_id, r.next_state, r.next_stage, r.next_due_at, true
      from public.learner_card_reviews r
      where r.learner_id = v_learner and r.idempotency_key = p_idempotency_key;
    return;
  end;

  insert into public.learner_card_states as s (
    learner_id, card_id, state, stage, due_at,
    first_seen_at, last_reviewed_at, review_count, updated_at
  ) values (
    v_learner, p_card_id, p_next_state, p_next_stage, p_next_due_at,
    coalesce(v_first_seen, p_reviewed_at), p_reviewed_at, v_count + 1, now()
  )
  on conflict (learner_id, card_id) do update set
    state = excluded.state,
    stage = excluded.stage,
    due_at = excluded.due_at,
    first_seen_at = coalesce(s.first_seen_at, excluded.first_seen_at),
    last_reviewed_at = excluded.last_reviewed_at,
    review_count = s.review_count + 1,
    updated_at = now();

  return query select p_card_id, p_next_state, p_next_stage, p_next_due_at, false;
end;
$$;

revoke all on function public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, text, smallint, timestamptz
) from public, anon;

grant execute on function public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, text, smallint, timestamptz
) to authenticated;

comment on function public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, text, smallint, timestamptz
) is
  'VOC-API-05s: writes one review event and its state update in a single transaction. Idempotent on (learner_id, idempotency_key). Raises SQLSTATE 40001 when the caller computed its transition from a state that has since changed, so concurrent reviews of one card apply in sequence instead of overwriting each other.';
