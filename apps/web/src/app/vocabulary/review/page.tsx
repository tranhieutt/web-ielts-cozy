// VOC-WEB-03 — review route. Route state is only `deck`, `mode`, `limit`;
// the session's progress lives in the runner and on the server, never in the URL.
import { ReviewSession } from '@/features/vocabulary/components/ReviewSession';
import type { QueueMode } from '@/features/vocabulary/types';

export const metadata = { title: 'Ôn từ vựng — IELTS Cozy' };

const DEFAULT_LIMIT = 20;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const deck = first(params.deck) ?? 'environment';
  const rawMode = first(params.mode);
  const mode: QueueMode = rawMode === 'new' ? 'new' : 'due';
  const rawLimit = Number(first(params.limit));
  const limit =
    Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 50 ? rawLimit : DEFAULT_LIMIT;

  return <ReviewSession deck={deck} mode={mode} limit={limit} />;
}
