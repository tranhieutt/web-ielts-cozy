-- VOC-API-05s — transactional, idempotent review write.
--
-- WHY AN RPC AND NOT TWO POSTGREST CALLS:
-- spec §8.4 requires the review event and the state update to be ONE unit of
-- work. Two PostgREST requests cannot be one transaction, so a crash between
-- them would leave a review with no state change (progress silently lost) or a
-- state change with no audit row. One function call is one transaction.
--
-- WHY THE SRS MATH IS NOT IN HERE:
-- the schedule lives in `srs/transition.mjs` as a pure function covered by
-- tests against every cell of spec tables 8.1/8.2. Re-implementing it in SQL
-- would put the same rules in two languages, where they would drift. The caller
-- computes the next state; this function's job is to persist it atomically and
-- to be the single source of truth for idempotency.
--
-- SECURITY INVOKER is deliberate: RLS still applies, `auth.uid()` is the
-- learner, and the function cannot be used to reach another learner's rows.

create function public.submit_vocabulary_review(
  p_card_id text,
  p_rating text,
  p_idempotency_key uuid,
  p_reviewed_at timestamptz,
  p_next_state text,
  p_next_stage smallint,
  p_next_due_at timestamptz
)
-- Output names are prefixed on purpose. `RETURNS TABLE` declares them as
-- plpgsql variables, so naming them `card_id`/`next_state` would make every
-- reference to the real columns ambiguous (SQLSTATE 42702).
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
begin
  if v_learner is null then
    raise exception 'submit_vocabulary_review requires an authenticated learner'
      using errcode = '28000';
  end if;

  -- Replay check first. Returning the ORIGINAL result is the contract: a retry
  -- must never advance a second stage (spec §8.4).
  return query
    select r.card_id, r.next_state, r.next_stage, r.next_due_at, true
    from public.learner_card_reviews r
    where r.learner_id = v_learner and r.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  -- RLS-scoped, so an unpublished or non-existent card is rejected here rather
  -- than becoming learner state for content nobody can see.
  if not exists (select 1 from public.vocabulary_cards c where c.id = p_card_id) then
    raise exception 'unknown card: %', p_card_id using errcode = 'P0002';
  end if;

  select s.state, s.stage, s.first_seen_at, s.review_count
    into v_prev_state, v_prev_stage, v_first_seen, v_count
  from public.learner_card_states s
  where s.learner_id = v_learner and s.card_id = p_card_id
  for update;

  v_prev_state := coalesce(v_prev_state, 'new');
  v_count := coalesce(v_count, 0);

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
    -- A concurrent request with the same key won the race. Its result is the
    -- authoritative one; return that instead of failing the learner's retry.
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
  text, text, uuid, timestamptz, text, smallint, timestamptz
) from public, anon;

grant execute on function public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, timestamptz
) to authenticated;

comment on function public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, timestamptz
) is
  'VOC-API-05s: writes one review event and its state update in a single '
  'transaction. Idempotent on (learner_id, idempotency_key) — a replay returns '
  'the original result with replayed = true and never advances a stage.';
