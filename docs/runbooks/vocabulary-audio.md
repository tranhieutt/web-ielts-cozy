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
2. Set local-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Dry-run upload, then upload resumably:

```powershell
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary --apply
```

Object key contract: `v1/{uk|us}/{card_id}.mp3`. Store object paths, not environment-specific CDN URLs, in the future content database.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code, commit it, or place it in Vercel public environment variables.
