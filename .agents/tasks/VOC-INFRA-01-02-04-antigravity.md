# Task: VOC-INFRA-01, VOC-INFRA-02, VOC-INFRA-04 — Content CI and resilient audio generation

## Outcome

Protect Vocabulary source content in every pull request and make full Google TTS generation survive access-token expiry. A failed content contract or test must fail CI before merge.

## Scope and allowed files

Own only these paths:

- `.github/workflows/vocabulary-content.yml` — new workflow.
- `package.json` — add/adjust commands only when required by this task.
- `scripts/vocabulary/validate-content.mjs`.
- `scripts/vocabulary/generate-audio.mjs`.
- `scripts/vocabulary/normalize-content.mjs` only if needed to validate the canonical learner-facing catalog.
- `test/vocabulary/**` — CI/validator/token-refresh tests and fixtures.

Do not modify:

- `content/vocabulary/**` source JSONL.
- `supabase/**`, database schema, RLS, storage uploader, or `.env*`.
- `index.html`, application routes, SRS, API, product/architecture docs.
- Existing work by other agents. You are not alone in codebase; preserve unrelated edits and adapt to them.

## Contracts and invariants

- Raw source is only `content/vocabulary/ielts_vocab_by_topic/*.jsonl`.
- Baseline source contract is exactly 23 files, 5,275 unique cards, 7,309 non-empty `senses[].def_vi` values.
- Canonical learner-facing catalog must never contain `def_zh`, `examples[].zh`, `collocations[].zh`, or Youdao URLs.
- Validator failures identify source file/card/line where practical.
- Audio generation remains resumable. Existing MP3 + manifest entries matching word hash and voice must not regenerate.
- Google token must refresh before expiry during a run exceeding one hour; auth failure must retry once with a fresh token before normal retry policy applies.
- No credential values, OAuth tokens, service keys, or raw learner data may appear in logs, tests, artifacts, or source control.

## Acceptance criteria

1. New GitHub Actions workflow runs on pull requests affecting Vocabulary content/scripts or `package.json`:
   - Node 20.
   - `npm run vocab:validate-content`.
   - canonical catalog validation against a temporary output path.
   - `npm run vocab:test-normalize` plus added tests.
2. `validate-content.mjs` exits non-zero unless baseline totals equal 23 / 5,275 / 7,309; it must assert, not merely print, these totals.
3. Validator covers malformed JSONL, duplicate IDs, missing Vietnamese definition, primary-topic/file mismatch, and forbidden learner-facing Chinese/Youdao fields after normalization.
4. `generate-audio.mjs` uses a token provider with an explicit refresh window and renews token safely for long runs. No production Google TTS call occurs in unit tests.
5. Tests prove:
   - source totals mismatch fails;
   - canonical payload leak fails;
   - expired/near-expiry token refreshes;
   - a 401 auth response retries once with new token, without logging token text.
6. Workflow produces a required check named `vocabulary-content`. Note in handoff: repository admin must mark it required in GitHub branch protection; workflow YAML alone cannot enforce this setting.

## Required tests

Run and report exact results:

```powershell
npm run vocab:validate-content
npm run vocab:normalize-content -- --out-dir "$env:TEMP/ielts-cozy-vocabulary-catalog" --apply
npm run vocab:test-normalize
node --test test/vocabulary/*.test.mjs
npm run build
```

Also inspect workflow syntax and report the validation method used.

## Non-goals

- Do not regenerate, upload, delete, or alter any MP3.
- Do not enable `audio_enabled` or change runtime audio delivery.
- Do not deploy, modify Supabase, or run migrations.
- Do not change product decisions, beta deck selection, consent policy, or offline scope.
- Do not introduce a new test framework or runtime dependency solely for this task.

## Handoff reviewer

Claude reviews scope and acceptance. Include `.agents/templates/handoff.md` fields, plus:

- changed file list;
- all test output/results;
- CI workflow trigger paths and check name;
- any remaining branch-protection action;
- risks around Google credential expiry or changed baseline corpus.
