# Vocabulary audio operations

## Source and generation

Google Cloud Text-to-Speech generates new MP3 assets from card `word` values. Do not download, proxy, cache, or ship the old Youdao URLs.

```powershell
npm run vocab:generate-audio -- --accent both
npm run vocab:generate-audio -- --project hanzi-cozy-diary --accent both --apply
```

Generated files and manifests remain local under `.generated/audio/vocabulary/`; Git ignores this path.

## Supabase CDN delivery

1. Apply migration `supabase/migrations/202608190001_create_vocabulary_audio_bucket.sql` to create public bucket `vocabulary-audio`.
2. Copy `.env.example` to ignored `.env.local`; set local-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not paste, commit, or expose this key.
3. Dry-run upload, then upload resumably:

```powershell
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary --apply
```

For constrained network or command runtimes, upload resumable batches. Rerun until `remainingFiles` is `0`:

```powershell
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary --max-files 1000 --apply
```

Use a different local config file only when needed:

```powershell
npm run vocab:upload-audio -- --env-file C:\secure\ielts-cozy-supabase.env --apply
```

Object key contract: `v1/{uk|us}/{card_id}.mp3`. Store object paths, not environment-specific CDN URLs, in the future content database.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code, commit it, or place it in Vercel public environment variables.
