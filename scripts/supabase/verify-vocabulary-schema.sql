select
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled,
  count(policy.policyname) as policy_count
from pg_class relation
join pg_namespace namespace on namespace.oid = relation.relnamespace
left join pg_policies policy
  on policy.schemaname = namespace.nspname
  and policy.tablename = relation.relname
where namespace.nspname = 'public'
  and relation.relname in (
    'vocabulary_cards',
    'vocabulary_decks',
    'vocabulary_deck_cards',
    'learner_card_states',
    'learner_card_reviews'
  )
group by relation.relname, relation.relrowsecurity
order by relation.relname;
