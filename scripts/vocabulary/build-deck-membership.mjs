import { DECK_METADATA } from './deck-metadata.mjs';
import { normalizeCorpus } from './normalize-content.mjs';

export function buildDeckMembership(cards, { contentVersion } = {}) {
  if (typeof contentVersion !== 'string' || !contentVersion.trim()) {
    throw new Error('Deck membership needs a non-empty contentVersion.');
  }

  const decks = Object.entries(DECK_METADATA).map(([slug, display_name_vi]) => ({
    slug,
    display_name_vi,
    publish_status: 'draft',
    content_version: contentVersion,
  }));
  const grouped = new Map();
  for (const card of cards) for (const deck_slug of card.topics_all ?? []) {
    if (!DECK_METADATA[deck_slug]) throw new Error(`Missing Vietnamese deck metadata: ${deck_slug}`);
    grouped.set(deck_slug, [...(grouped.get(deck_slug) ?? []), card]);
  }
  if (grouped.size !== decks.length) throw new Error('Every configured deck must have at least one card.');
  const rows = [...grouped.entries()].flatMap(([deck_slug, members]) => members
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((card, position) => ({ deck_slug, card_id: card.id, position, is_primary: deck_slug === card.topic })));
  return { decks, rows };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { decks, rows } = buildDeckMembership(normalizeCorpus().cards, { contentVersion: 'dry-run' });
  console.log(JSON.stringify({ decks: decks.length, memberships: rows.length, draft: true }, null, 2));
}
