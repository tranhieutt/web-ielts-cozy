-- VOC-WEB-10 / ADR-004 — let a learner delete their own study data.
--
-- WHY A FUNCTION INSTEAD OF `grant delete`:
-- A blanket DELETE grant would also let a learner remove individual rows —
-- dropping review events while keeping the state row that those events explain,
-- or vice versa. The review history would then disagree with the schedule.
-- ADR-004 describes one all-or-nothing action ("Xoá dữ liệu học của tôi"), so
-- that is exactly what is exposed, in one transaction. Neither table gets a
-- DELETE grant.
--
-- WHY `security definer` (the one place in this schema that uses it):
-- The learner has no DELETE privilege, so an invoker-rights function could not
-- delete anything. The definer rights are made safe by two things:
--   1. The learner is taken from `auth.uid()` and NEVER from a parameter, so a
--      caller cannot name someone else's rows. The function takes no arguments
--      at all, which makes that structurally impossible rather than merely
--      checked.
--   2. `search_path` is pinned, so a caller cannot shadow `public` with their
--      own tables and have the deletes land somewhere else.
-- Do not add a parameter to this function. A `p_learner_id` argument would turn
-- it into a delete-anyone primitive.
--
-- SCOPE: study data only. The anonymous auth user itself is left alone, so the
-- learner keeps working in the same session and simply starts from zero. The
-- ADR-004 retention job is what removes idle users.
--
-- ROLLBACK:
--   drop function if exists public.delete_my_vocabulary_data();
-- Dropping it removes the ability to self-delete and changes nothing else — no
-- table, column, grant or policy is touched by this migration. Rows already
-- deleted by a learner are NOT recoverable by rolling back; restore them from a
-- database backup if that is ever required.

create or replace function public.delete_my_vocabulary_data()
returns table (deleted_states integer, deleted_reviews integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_learner uuid := (select auth.uid());
  v_states integer := 0;
  v_reviews integer := 0;
begin
  if v_learner is null then
    raise exception 'delete_my_vocabulary_data requires an authenticated learner'
      using errcode = '28000';
  end if;

  -- Events first: the state row is what the learner sees, so if anything went
  -- wrong the visible thing is the last to disappear. Both are in one
  -- transaction, so this ordering only matters for how a failure would look.
  delete from public.learner_card_reviews where learner_id = v_learner;
  get diagnostics v_reviews = row_count;

  delete from public.learner_card_states where learner_id = v_learner;
  get diagnostics v_states = row_count;

  return query select v_states, v_reviews;
end;
$$;

revoke all on function public.delete_my_vocabulary_data() from public, anon;
grant execute on function public.delete_my_vocabulary_data() to authenticated;
