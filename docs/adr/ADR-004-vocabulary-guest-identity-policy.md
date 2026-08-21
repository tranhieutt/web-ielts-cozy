# ADR-004: Vocabulary Guest Identity, Retention, and Account Policy

## Status

Accepted — 2026-08-21

Closes `VOC-PLAN-05` and unblocks `VOC-INFRA-06` and `VOC-API-01`.

## Context

D-12 already fixed the identity model: the Supabase Anonymous Auth UUID **is**
`learner_id`. There is no `guest_identities` table and signing in later links an
identity to the same UUID, so no row is ever migrated.

What D-12 did not settle is policy: how long an inactive guest is kept, when (or
whether) a guest is asked to create an account, whether a guest can recover
progress on a second device, and how a learner deletes their own data. Those
questions gate `VOC-INFRA-06`, which in turn gates every durable-storage task,
so they were blocking the critical path rather than the release.

## Decision

### 1. Retention — 3 months of inactivity

An anonymous learner with no activity for 3 months is deleted. Deletion cascades
through `learner_card_states` and `learner_card_reviews` via the existing
`on delete cascade` foreign keys, so no orphaned learner state is possible.

Supabase does not expire anonymous users on its own, so this requires a
scheduled cleanup job. Until that job exists the policy is written down but not
enforced — see Consequences.

### 2. No account prompt — a footer link only

The product does not interrupt a learner to ask them to create an account. No
post-session banner, no modal, no gate. Account creation is reachable as an
ordinary link in the footer, and a learner takes it when they want it.

### 3. Device change — recover by linking an OAuth identity

`enable_manual_linking = true`. A learner who signs in with OAuth links that
identity to the anonymous UUID they already hold, keeping their progress. A
learner who changes device or clears cookies *without* having linked an identity
starts fresh; that is accepted.

### 4. Anonymous rate limit — 50 per hour per IP

Raised from the Supabase default of 30. Learners share IPs: a class, a school
computer lab, a cafe. At 30 the 31st learner in an hour is refused, and from
their side that reads as a broken app rather than as a limit.

### 5. Self-service deletion — an in-app button

A "Xoá dữ liệu học của tôi" control deletes everything belonging to the caller's
`auth.uid()`. No identity verification step: only the holder of the session can
press it, and requiring proof of identity from an anonymous learner would be
both impossible and pointless.

## Consequences

### Positive

- `VOC-INFRA-06` and `VOC-API-01` are unblocked; the Supabase adapter written
  for `VOC-API-02s/03s/05s` gets a real learner token and can run.
- No onboarding friction: a learner reaches a flashcard without an account wall.
- Retention is bounded, so learner data is not accumulated indefinitely.
- Deletion is one cascade, not a multi-table cleanup that can half-fail.

### Negative

- **Most guests will never have an account.** Decisions 2 and 3 compose: we
  never invite anyone to create an account, and recovery requires having created
  one. A learner who studies for weeks, then switches phones, loses everything
  and was never told that could happen. The footer link is discoverable in
  principle and easy to never notice in practice.
- **Retention and silence compound.** A learner who studies for two months,
  pauses for three, and returns finds an empty app with no explanation. The
  3-month clock is invisible to them.
- Raising the anonymous limit to 50 also raises the ceiling for automated
  abuse from one IP. Acceptable at beta scale; revisit if signup spam appears.
- The retention policy is inert until a cleanup job exists. Writing the policy
  is not the same as enforcing it.

### Mitigation to decide before beta

The two negatives above are about a learner not knowing the rules that govern
their own data. Neither is fixed by code alone. At minimum, the point where a
guest's progress is shown should say plainly that progress lives on this device
unless they link an account. That copy is not yet specified.

## Revisit trigger

Revisit decision 2 if beta shows guests losing meaningful progress on device
change, or if the footer link converts at a rate indistinguishable from zero.
Revisit decision 4 if anonymous signups from single IPs look automated.

## Related decisions

- Implements the policy half of D-12 (anonymous learner identity).
- Depends on D-17 (local/preview/production environments) for rollout order.
- Consent and age gating remain out of scope here: that is `VOC-PLAN-07` /
  D-05, and no analytics event may be emitted until it is settled.
