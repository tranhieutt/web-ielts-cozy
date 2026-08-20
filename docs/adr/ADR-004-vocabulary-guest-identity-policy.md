# ADR-004 — Vocabulary guest identity policy

**Status:** Accepted
**Date:** 2026-08-20
**Related:** D-12 (Anonymous Auth UUID as learner key), D-05 (support minors),
spec §9 Learner identity, `VOC-PLAN-05`, `VOC-INFRA-06`, `VOC-API-01`

## Context

D-12 already fixed the architecture: `learner_id` **is** the Supabase Anonymous
Auth UUID, there is no `guest_identities` table, and RLS reads `auth.uid()`
directly. The migration backs this with `on delete cascade` from both
`learner_card_states` and `learner_card_reviews` to `auth.users`.

What D-12 did not fix were the policy parameters that make it implementable:
how long an anonymous user lives, when we ask them to create an account, what we
tell them about device boundaries, whether identity linking is manual, and how
many anonymous sign-ins one IP may make. Without these, `VOC-INFRA-06` cannot
choose config values and `VOC-API-01` cannot be written — which is why learner
state is still held in process memory and `VOC-07` is unmet.

Two facts drive the decisions below:

- An anonymous UUID is bound to one browser's stored session. Clearing site data
  loses the progress. This is a property of the design, not a defect.
- Supabase never expires anonymous users on its own. Left alone, `auth.users`
  accumulates every bot, crawler and single-visit user forever.

## Decision

### 1. Anonymous user retention — 30 days of inactivity

An anonymous user with no activity for 30 days is deleted. Because both learner
tables cascade from `auth.users`, deleting the user removes their states and
review history in the same operation; no separate cleanup path is written.

No separate tier for zero-review users: a single 30-day rule covers both the
bot/crawler noise and the genuine lapsed learner, and one rule is one thing to
get right. If `auth.users` growth becomes a problem in beta, a shorter sweep for
users with zero reviews can be added without superseding this ADR.

### 2. Account creation is offered as a passive header link

The invitation to create an account is a link in the site header, always present
and never interruptive. No modal, no post-session prompt, no gating of any
learning action.

This is deliberately the minimum viable treatment for beta. Conversion is
expected to be low; improving the placement and timing is follow-up UI work, not
part of this decision.

### 3. Device boundary is disclosed, not hidden

While the learner is anonymous, the catalog screen shows a plain statement that
progress is stored in this browser — "Tiến độ đang lưu trên trình duyệt này".

Learners are told the limit up front rather than discovering it by losing work.
The statement is informational and does not block anything.

### 4. Google OAuth — `enable_manual_linking = true`

Sign-in uses Google OAuth. Manual identity linking is therefore **required**:
without it, signing in creates a *new* user and the anonymous learner's progress
is orphaned. With it, the Google identity links onto the existing anonymous
UUID and no rows move.

Google OAuth credentials do not exist yet and are created when `VOC-API-01`
reaches the sign-in flow.

### 5. Anonymous sign-in rate limit — 50 per hour per IP

Raised from the Supabase default of 30. IELTS Cozy's learners cluster behind
shared NAT — a class at a prep centre, a school, a café — where 30 new learners
in one hour is ordinary, and the 31st would be unable to use the app at all.

50 is a beta starting point, not a derived number. The app must still render an
explicit, human message when the limit is hit, never a blank or broken screen.

## Alternatives considered

- **No retention limit.** Rejected: unbounded `auth.users` growth and holding
  learner records indefinitely with no purpose conflicts with the minimal-data
  posture of D-05.
- **Interruptive account prompt after a session.** Would convert better, but
  costs a decision now about placement and copy that beta does not need.
  Deferred to follow-up UI work.
- **Staying on the default rate limit of 30.** Rejected: the failure mode is an
  entire classroom locked out, and it would present as the app being down.

## Consequences

- A scheduled job must delete anonymous users inactive for 30 days. It does not
  exist yet and has no task ID; it is required before production, not before
  beta.
- A learner who pauses for over a month loses their progress. With only a
  passive header link driving account creation, few learners will be protected
  from this in beta. Accepted knowingly for beta; revisit with real retention
  data.
- `supabase/config.toml` changes: `enable_anonymous_sign_ins = true`,
  `enable_manual_linking = true`, `anonymous_users = 50`.
- The catalog screen carries a permanent anonymous-state disclosure, and the
  header carries a permanent sign-in affordance.
- Google OAuth client credentials become a release prerequisite.
