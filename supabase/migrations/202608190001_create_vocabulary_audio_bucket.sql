-- Generated Google TTS audio is public learning content, never learner data.
-- Uploads run only from trusted local/CI scripts using the service-role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vocabulary-audio',
  'vocabulary-audio',
  true,
  262144,
  array['audio/mpeg']
)
on conflict (id) do nothing;
