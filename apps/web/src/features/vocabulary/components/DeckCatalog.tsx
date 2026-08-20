'use client';

/**
 * VOC-WEB-02 — deck catalog screen (spec §6.1).
 *
 * Block order is the spec's: page header + due count + primary CTA, short
 * progress, then the deck list. "Đã xem" is never presented as "đã thuộc":
 * learning and mastered are separate counters.
 */

import { useEffect, useMemo, useState } from 'react';

import type { LearnerProgress } from '../types';
import styles from './deck-catalog.module.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; progress: LearnerProgress };

export function DeckCatalog() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [dueOnly, setDueOnly] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/vocabulary/progress', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<LearnerProgress>;
      })
      .then((progress) => setState({ status: 'ready', progress }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', message: 'Chưa tải được danh sách bộ từ.' });
      });

    return () => controller.abort();
  }, []);

  const decks = useMemo(() => {
    if (state.status !== 'ready') return [];
    return dueOnly
      ? state.progress.decks.filter((deck) => deck.dueCount > 0)
      : state.progress.decks;
  }, [state, dueOnly]);

  if (state.status === 'loading') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Từ vựng</h1>
        <p className={styles.notice} role="status">
          Đang tải bộ từ…
        </p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Từ vựng</h1>
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {state.message} Kiểm tra kết nối rồi thử lại.
        </p>
      </main>
    );
  }

  const { progress } = state;
  const hasDue = progress.dueCount > 0;
  const ctaDeck =
    progress.decks.find((deck) => deck.dueCount > 0)?.slug ??
    [...progress.decks].sort((a, b) => b.publishableCardCount - a.publishableCardCount)[0]?.slug;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Từ vựng</h1>
          <p className={styles.dueLine}>
            {hasDue
              ? `${progress.dueCount} thẻ đến hạn hôm nay`
              : 'Hôm nay chưa có thẻ đến hạn — bạn có thể học từ mới.'}
          </p>
        </div>
        {/* Spec §6.1: with nothing due, the CTA switches to learning new words
            rather than sending the learner into an empty session. The target
            deck is chosen from the data — the first deck that actually has due
            cards, else the largest deck — never a hard-coded slug. */}
        {ctaDeck ? (
          <a
            className={styles.primaryAction}
            href={`/vocabulary/review?deck=${ctaDeck}&mode=${hasDue ? 'due' : 'new'}`}
          >
            {hasDue ? 'Ôn ngay' : 'Học từ mới'}
          </a>
        ) : null}
      </header>

      <ul className={styles.stats} aria-label="Tiến độ của bạn">
        <li className={styles.chip}>Đã học {progress.reviewedCount} từ</li>
        <li className={styles.chip}>Đang học {progress.learningCount}</li>
        <li className={styles.chip}>Đã thuộc {progress.masteredCount}</li>
        <li className={`${styles.chip} ${styles.chipQuiet}`}>
          Chờ ôn lại {progress.scheduledCount}
        </li>
      </ul>

      <div>
        <h2 className={styles.sectionTitle}>Bộ từ theo chủ đề</h2>
        <label className={styles.filter}>
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(event) => setDueOnly(event.target.checked)}
          />
          Chỉ hiện bộ có thẻ đến hạn
        </label>
      </div>

      {decks.length === 0 ? (
        <p className={styles.notice} role="status">
          {dueOnly
            ? 'Không có bộ nào đang có thẻ đến hạn. Bỏ lọc để chọn bộ học từ mới.'
            : 'Bộ từ đang được cập nhật.'}
        </p>
      ) : (
        <ul className={styles.deckGrid}>
          {decks.map((deck) => {
            const studied = deck.progress.learningCount + deck.progress.masteredCount;
            const percent =
              deck.publishableCardCount === 0
                ? 0
                : Math.round((studied / deck.publishableCardCount) * 100);

            return (
              <li key={deck.slug} className={styles.deckCard}>
                <span className={styles.deckName}>{deck.displayNameVi}</span>
                <span className={styles.deckMeta}>
                  {deck.publishableCardCount} thẻ · {deck.dueCount} đến hạn · đã thuộc{' '}
                  {deck.progress.masteredCount}
                </span>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label={`Tiến độ bộ ${deck.displayNameVi}`}
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={styles.progressValue} style={{ width: `${percent}%` }} />
                </div>
                <div className={styles.deckActions}>
                  <a
                    className={styles.deckLink}
                    href={`/vocabulary/review?deck=${deck.slug}&mode=new`}
                  >
                    Học từ mới
                  </a>
                  {/* An aria-disabled link that still navigates is a lie;
                      with nothing due there is no destination to offer. */}
                  {deck.dueCount > 0 ? (
                    <a
                      className={styles.deckLink}
                      href={`/vocabulary/review?deck=${deck.slug}&mode=due`}
                    >
                      Ôn từ đến hạn
                    </a>
                  ) : (
                    <span className={`${styles.deckLink} ${styles.deckLinkInactive}`}>
                      Chưa có thẻ đến hạn
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
