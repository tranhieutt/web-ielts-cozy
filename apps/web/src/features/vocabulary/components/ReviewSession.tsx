'use client';

/**
 * VOC-WEB-03 (session state) + VOC-WEB-05 (rating interaction).
 *
 * Two rules from the spec drive this component:
 *
 * 1. §8.3 — in-session ordering comes from `session-queue.mjs` and NEVER from
 *    `due_at`. `due_at` was already consumed server-side when the queue was
 *    built; this component must not look at it again.
 * 2. §6.2 + ADR-002 — the next card appears only after the server confirms the
 *    save. Offline or a failed save keeps the current card and says so; it
 *    never pretends progress was stored.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createSessionQueue,
  currentCardId,
  isSessionComplete,
  rateCurrentCard,
  remainingCount,
} from '../srs/session-queue.mjs';
import type { Rating, QueueMode, VocabularyCard } from '../types';
import { Flashcard } from './Flashcard';
import { SessionSummary } from './SessionSummary';
import styles from './flashcard.module.css';

type Queue = ReturnType<typeof createSessionQueue>;

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; cards: VocabularyCard[] };

export interface SessionTally {
  rated: number;
  known: number;
  again: number;
}

export function ReviewSession({
  deck,
  mode,
  limit,
}: {
  deck: string;
  mode: QueueMode;
  limit: number;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [queue, setQueue] = useState<Queue | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tally, setTally] = useState<SessionTally>({ rated: 0, known: 0, again: 0 });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ deck, mode, limit: String(limit) });

    fetch(`/api/vocabulary/queue?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ cards: VocabularyCard[] }>;
      })
      .then(({ cards }) => {
        setLoad({ status: 'ready', cards });
        setQueue(createSessionQueue(cards.map((card) => card.id)));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoad({ status: 'error', message: 'Chưa tải được phiên ôn.' });
      });

    return () => controller.abort();
  }, [deck, mode, limit]);

  const cardsById = useMemo(() => {
    if (load.status !== 'ready') return new Map<string, VocabularyCard>();
    return new Map(load.cards.map((card) => [card.id, card]));
  }, [load]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!queue || saving) return;
      const cardId = currentCardId(queue);
      if (cardId === null) return;

      setSaving(true);
      setSaveError(null);

      try {
        const response = await fetch('/api/vocabulary/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId, rating, idempotencyKey: crypto.randomUUID() }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.json();

        // Advance ONLY after the server confirmed the write.
        setQueue(rateCurrentCard(queue, rating).queue);
        setTally((previous) => ({
          rated: previous.rated + 1,
          known: previous.known + (rating === 'known' ? 1 : 0),
          again: previous.again + (rating === 'again' ? 1 : 0),
        }));
        setFlipped(false);
      } catch {
        setSaveError(
          navigator.onLine
            ? 'Chưa lưu được đánh giá. Thẻ này vẫn giữ nguyên — thử lại nhé.'
            : 'Đang mất kết nối. Vocabulary cần mạng để lưu tiến độ, nên thẻ này sẽ giữ nguyên cho tới khi có mạng lại.',
        );
      } finally {
        setSaving(false);
      }
    },
    [queue, saving],
  );

  if (load.status === 'loading') {
    return (
      <main className={styles.session}>
        <p className={styles.notice} role="status">
          Đang chuẩn bị phiên ôn…
        </p>
      </main>
    );
  }

  if (load.status === 'error') {
    return (
      <main className={styles.session}>
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {load.message} <a href="/vocabulary">Về từ vựng</a>
        </p>
      </main>
    );
  }

  if (load.cards.length === 0) {
    return (
      <main className={styles.session}>
        <p className={styles.notice} role="status">
          {mode === 'due'
            ? 'Không còn thẻ đến hạn trong bộ này. Bạn có thể học từ mới.'
            : 'Bộ từ đang được cập nhật.'}
        </p>
        <a className={styles.exit} href="/vocabulary">
          Về từ vựng
        </a>
      </main>
    );
  }

  if (!queue) return null;

  if (isSessionComplete(queue)) {
    return <SessionSummary deck={deck} tally={tally} />;
  }

  const cardId = currentCardId(queue);
  const card = cardId ? cardsById.get(cardId) : undefined;
  if (!card) return null;

  const position = tally.rated + 1;

  return (
    <main className={styles.session}>
      <div className={styles.sessionBar}>
        <span className={styles.chip}>Thẻ {position}</span>
        <span className={`${styles.chip} ${styles.chipQuiet}`}>
          Còn {remainingCount(queue)} thẻ
        </span>
        <a className={styles.exit} href="/vocabulary">
          Thoát
        </a>
      </div>

      <Flashcard card={card} flipped={flipped} onFlip={() => setFlipped((value) => !value)} />

      <div className={styles.ratings}>
        <div className={styles.ratingRow} role="group" aria-label="Tự đánh giá từ vựng">
          <button
            type="button"
            className={`${styles.rating} ${styles.ratingAgain}`}
            disabled={!flipped || saving}
            aria-describedby="rating-hint"
            onClick={() => void rate('again')}
          >
            Chưa thuộc
          </button>
          <button
            type="button"
            className={`${styles.rating} ${styles.ratingKnown}`}
            disabled={!flipped || saving}
            aria-describedby="rating-hint"
            onClick={() => void rate('known')}
          >
            Thuộc rồi 🎉
          </button>
        </div>
        <span id="rating-hint" className={styles.hint}>
          {saving
            ? 'Đang lưu đánh giá…'
            : flipped
              ? 'Chọn mức độ bạn nhớ từ này.'
              : 'Lật thẻ để xem đáp án và chấm.'}
        </span>
        {saveError ? (
          <span className={`${styles.notice} ${styles.error}`} role="alert">
            {saveError}
          </span>
        ) : null}
      </div>
    </main>
  );
}
