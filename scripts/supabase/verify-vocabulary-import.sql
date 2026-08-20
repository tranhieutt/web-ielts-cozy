select
  count(*) as cards,
  count(*) filter (where content_status = 'draft') as draft_cards,
  count(distinct source_version) as source_versions
from public.vocabulary_cards;
