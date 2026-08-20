'use client';

/**
 * VOC-WEB-06 — pronunciation control (spec §6.2).
 *
 * Rules encoded here:
 * - Never autoplay. Audio starts only from this control.
 * - The accessible name says which accent and which word, because "play" alone
 *   is meaningless when several controls sit on one card.
 * - A playback failure shows a quiet message and leaves the review running; it
 *   never changes the rating flow (spec §7 luồng C).
 * - When the release gate is closed (ADR-003) there is no audio prop at all and
 *   this renders an explicit unavailable note instead of a dead button.
 */

import { useEffect, useRef, useState } from 'react';

import styles from './flashcard.module.css';

const ACCENT_LABEL = { uk: 'Anh-Anh', us: 'Anh-Mỹ' } as const;

type Accent = keyof typeof ACCENT_LABEL;

export function AudioButton({
  word,
  sources,
}: {
  word: string;
  sources?: { uk: string; us: string };
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [failed, setFailed] = useState(false);

  // Stop any in-flight playback when the learner moves to the next card.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [word]);

  if (!sources) {
    return (
      <span className={styles.hint}>Phát âm chưa khả dụng</span>
    );
  }

  const play = async (accent: Accent) => {
    setFailed(false);
    audioRef.current?.pause();

    const audio = new Audio(sources[accent]);
    audioRef.current = audio;

    try {
      await audio.play();
    } catch {
      setFailed(true);
    }
  };

  return (
    <span className={styles.audioRow}>
      {(Object.keys(ACCENT_LABEL) as Accent[]).map((accent) => (
        <button
          key={accent}
          type="button"
          className={styles.audioButton}
          aria-label={`Nghe phát âm ${ACCENT_LABEL[accent]} của ${word}`}
          onClick={() => void play(accent)}
        >
          {accent.toUpperCase()}
        </button>
      ))}
      {failed ? (
        <span className={styles.hint} role="status">
          Chưa phát được audio
        </span>
      ) : null}
    </span>
  );
}
