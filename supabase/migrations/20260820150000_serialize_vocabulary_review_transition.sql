-- VOC-API-05s — make the SRS transition safe against concurrent reviews.
--
-- THE BUG THIS FIXES:
-- the previous version read the state row with `FOR UPDATE` but wrote the
-- values the CALLER had computed before the transaction began. Two reviews of
-- the same card with DIFFERENT idempotency keys could both read stage 0, both
-- compute stage 1, and both write it: two events, `review_count` +2, but the
-- schedule advanced once. The idempotency key cannot help — by definition these
-- are two reviews, not a retry of one.
--
-- WHY COMPARE-AND-SWAP RATHER THAN A LOCK:
-- `FOR UPDATE` locks nothing on a learner's FIRST review, because there is no
-- row yet, so it never protected the case that matters most. An advisory lock
-- does cover it, but it serialises through PostgREST's connection pool and a
-- request that dies holding one wedges the pool. The `WHERE` on the upsert is
-- the whole guard instead: the row is written only if it still holds the state
-- the caller computed from, and Postgres already serialises the conflicting
-- upsert on its unique index.
--
-- WHY THE SRS MATH IS STILL NOT IN SQL:
-- re-implementing tables 8.1/8.2 in plpgsql would put the schedule in two
-- languages where it can drift. The caller computes the transition and declares
-- what it computed from; this function refuses to write if that is no longer
-- true, and the caller re-reads and recomputes.
--
-- WHY `PT409` AND NOT `40001`:
-- 40001 is `serialization_failure`, which PostgREST treats as transient and
-- retries automatically. That turned one lost race into an unbounded retry loop
-- that exhausted the connection pool and hung every later request. `PTxxx` sets
-- the HTTP status directly, so a lost race answers 409 once and the caller
-- decides what to do.

drop function if exists public.submit_vocabulary_review(
  text, text, uuid, timestamptz, text, smallint, timestamptz
);

create or replace function public.submit_vocabulary_review(
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
  v_written uuid;
begin
  if v_learner is null then
    raise exception 'submit_vocabulary_review requires an authenticated learner'
      using errcode = '28000';
  end if;

  -- Replay first: a retry of one review must return the original result, never
  -- a conflict.
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
    raise exception 'unknown card: %', p_card_id using errcode = 'PT404';
  end if;

  begin
    insert into public.learner_card_reviews (
      learner_id, card_id, rating, reviewed_at,
      previous_state, previous_stage, next_state, next_stage, next_due_at,
      idempotency_key
    ) values (
      v_learner, p_card_id, p_rating, p_reviewed_at,
      -- The expected state IS the previous state: the upsert below refuses to
      -- write unless that was still true, so the audit row cannot record a
      -- transition that did not happen.
      p_expected_state, p_expected_stage, p_next_state, p_next_stage, p_next_due_at,
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
    p_reviewed_at, p_reviewed_at, 1, now()
  )
  on conflict (learner_id, card_id) do update set
    state = excluded.state,
    stage = excluded.stage,
    due_at = excluded.due_at,
    first_seen_at = coalesce(s.first_seen_at, excluded.first_seen_at),
    last_reviewed_at = excluded.last_reviewed_at,
    review_count = s.review_count + 1,
    updated_at = now()
  -- The guard. No row is written when another review moved the card first.
  where s.state = p_expected_state
    and s.stage is not distinct from p_expected_stage
  returning s.learner_id into v_written;

  if v_written is null then
    raise exception 'stale learner state for card %: expected %/%',
      p_card_id, p_expected_state, p_expected_stage
      using errcode = 'PT409';
  end if;

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
  'VOC-API-05s: writes one review event and its state update in a single transaction. Idempotent on (learner_id, idempotency_key). Answers HTTP 409 (PT409) when the caller computed its transition from a state that has since changed, so concurrent reviews of one card apply in sequence instead of overwriting each other.';
