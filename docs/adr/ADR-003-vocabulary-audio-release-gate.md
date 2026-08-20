# ADR-003 — Vocabulary audio release gate

**Status:** Accepted  
**Date:** 2026-08-20  
**Related:** D-04 (audio managed by product), spec §5 release gate, `VOC-API-07`, `VOC-PLAN-08`

## Context

10,550 Google TTS MP3s are generated, uploaded to the public `vocabulary-audio`
bucket, and pass a browser delivery probe. They have **not** passed pronunciation
QA. `generate-audio.mjs` sends plain text, so Google TTS picks one reading for
heteronyms — `record`, `content`, `subject`, `present`, `lead` and ~33 others may
be spoken wrongly.

A wrong pronunciation in an IELTS product is a content defect that teaches the
error, and it is worse than having no audio at all. The execution plan required a
feature flag but never said where the flag lives, which meant "audio is off" was
an intention rather than an enforced state.

## Decision

Audio delivery is gated by two server-side environment variables that must both
be satisfied, resolved in one module (`features/vocabulary/audio.ts`):

| Variable | Meaning |
|---|---|
| `VOCABULARY_AUDIO_ENABLED` | Release switch. Audio is off unless this is exactly `true`. |
| `VOCABULARY_AUDIO_BASE_URL` | Approved delivery origin (Supabase Storage public base for `vocabulary-audio`). |

Rules:

- Default is **off**. Absence of configuration means no audio, never a guess.
- Only Google TTS objects under `v1/{accent}/{card_id}.mp3` are an approved
  source. Youdao URLs in the source JSONL stay metadata: never played, proxied,
  or cached.
- When the gate is closed the API omits audio entirely and the UI renders an
  explicit unavailable state. It does not emit URLs that 404.
- Audio failure never blocks flipping or rating a card.
- The flag may only be turned on after pronunciation QA (`VOC-PLAN-08`) passes
  and mis-read cards are regenerated with SSML `<phoneme>` from the IPA already
  present in `phonetic.uk`/`phonetic.us`.

## Alternatives considered

- **Flag in the database** (a `feature_flags` row): flipping it is a data edit
  with no code review and no deploy trail. Rejected for a switch whose whole
  purpose is preventing a content defect from reaching learners.
- **Client-side flag**: trivially bypassed and would ship the URLs to the
  browser regardless. Rejected.
- **Ship audio, mark suspect cards in the UI**: pushes a content-quality problem
  onto learners who cannot judge it. Rejected.

## Consequences

- Enabling audio is a deploy-time, reviewable configuration change.
- The UI must carry an unavailable state permanently, not as a temporary branch.
- Per-deck or per-card audio rollout is not supported by this decision; if
  partial rollout is needed later, this ADR must be superseded.
