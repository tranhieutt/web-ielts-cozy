# IELTS Cozy Architecture

## Scope

MVP serves roughly 1,000 monthly active B2C learners. It supports Vocabulary, Grammar, and Listening. Writing, Speaking, AI scoring, full mocks, payments, and social features are explicitly outside this release.

## Chosen approach

Modular monolith: Next.js full-stack web app deployed on Vercel, with Supabase Auth, Postgres, and Storage. Code separates domains but does not use networked microservices.

```text
Browser / PWA
  → Next.js app and BFF API
  → feature services and repositories
  → Supabase Auth / Postgres / Storage CDN
```

## Domain boundaries

| Domain | Responsibility |
|---|---|
| `learner` | Anonymous/account identity, age gate, consent, preferences |
| `vocabulary` | Decks, cards, spaced repetition, review events |
| `grammar` | Exercise delivery, answer validation, scoring |
| `listening` | Audio metadata, signed playback URLs, questions, submissions |
| `content-library` | Publish/version/license lifecycle |
| `progress` | XP, streak, dashboard summaries, recommendations |

## Identity and privacy

Guest learner starts with a Supabase anonymous session. Its Auth UUID is the learner key for progress records. Account registration later links this identity without losing history. No browser fingerprinting.

Age gate and consent records are mandatory because the product includes minors. Public learning requires only minimal data. Social sharing remains disabled by default.

## Data rules

- Published content versions are immutable.
- Every attempt stores its `content_version_id`.
- Content updates create a new version; historical attempts remain reproducible.
- Audio records include source, license, expiry, checksum, and storage path.
- RLS prevents learners accessing another learner's progress.

## Client/server rule

Client components handle interaction: audio playback, timer, flashcard, and forms. Server Actions or `/api/v1` Route Handlers validate input and invoke feature services. UI does not directly access database tables.

## Offline behavior

PWA may cache app shell and active deck/exercise metadata. Audio does not download by default. Vocabulary MVP does not queue offline review mutations: rating controls are disabled offline and no progress is reported saved until server confirmation. Revisit after beta under ADR-002.

## Reliability targets

- p95 interactive load under 2.5 seconds on common mobile network after cache.
- 99.5% monthly availability target.
- Writing not in MVP; no long-lived media recording in MVP.
- Daily Postgres backup; restore exercise quarterly.
