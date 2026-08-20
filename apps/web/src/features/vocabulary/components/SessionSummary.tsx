'use client';

/**
 * VOC-WEB-07 — end of session (spec §6.3).
 *
 * Shows what happened and three ways forward. No streaks, no guilt copy.
 */

import { useEffect, useState } from 'react';

import type { LearnerProgress } from '../types';
import type { SessionTally } from './ReviewSession';
import styles from './flashcard.module.css';

export function SessionSummary({ deck, tally }: { deck: string; tally: SessionTally }) {
  const [progress, setProgress] = useState<LearnerProgress | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/vocabulary/progress', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<LearnerProgress>) : null))
      .then(setProgress)
      .catch(() => setProgress(null));
    return () => controller.abort();
  }, []);

  return (
    <main className={styles.session}>
      <h1 className={styles.word}>Xong phiên này</h1>

      <ul className={styles.sessionBar} aria-label="Kết quả phiên ôn">
        <li className={styles.chip}>Đã ôn {tally.rated} thẻ</li>
        <li className={styles.chip}>Thuộc rồi {tally.known}</li>
        <li className={`${styles.chip} ${styles.chipQuiet}`}>Sẽ quay lại sớm {tally.again}</li>
        {progress ? (
          <li className={`${styles.chip} ${styles.chipQuiet}`}>
            Còn {progress.dueCount} thẻ đến hạn
          </li>
        ) : null}
      </ul>

      <div className={styles.ratingRow}>
        <a className={`${styles.rating} ${styles.ratingKnown}`} href={`/vocabulary/review?deck=${deck}&mode=new`}>
          Ôn tiếp
        </a>
        <a className={`${styles.rating} ${styles.ratingAgain}`} href="/vocabulary">
          Chọn bộ khác
        </a>
        <a className={styles.exit} href="/vocabulary">
          Về từ vựng
        </a>
      </div>
    </main>
  );
}
