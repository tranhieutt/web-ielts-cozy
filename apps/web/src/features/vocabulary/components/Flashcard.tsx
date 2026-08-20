'use client';

/**
 * VOC-WEB-04 — flashcard front/back (spec §6.2).
 *
 * The whole card is one button so tap, click, Enter and Space all flip it with
 * no extra key handling. Cards without phonetic (the 20 `is_phrase` cards)
 * render no phonetic region at all — never empty brackets (VOC-08b).
 */

import type { VocabularyCard } from '../types';
import styles from './flashcard.module.css';

const MAX_SENSES = 2;

export function Flashcard({
  card,
  flipped,
  onFlip,
}: {
  card: VocabularyCard;
  flipped: boolean;
  onFlip: () => void;
}) {
  const phonetic = card.phonetic?.uk ?? card.phonetic?.us;
  const senses = card.senses.slice(0, MAX_SENSES);
  const example = card.examples?.[0];
  const collocation = card.collocations?.[0];

  return (
    <button
      type="button"
      className={`${styles.card} ${flipped ? styles.cardFlipped : ''}`}
      onClick={onFlip}
      aria-pressed={flipped}
      aria-label={flipped ? `Mặt sau của thẻ ${card.word}` : `Mặt trước của thẻ ${card.word}`}
    >
      <span className={styles.side}>{flipped ? 'Nghĩa' : 'Từ'}</span>
      <span className={styles.word}>{card.word}</span>

      {phonetic ? <span className={styles.phonetic}>/{phonetic}/</span> : null}

      {flipped ? (
        <>
          {senses.map((sense, index) => (
            <span key={index} className={styles.meaning}>
              {sense.pos ? <em>({sense.pos}) </em> : null}
              {sense.def_vi}
            </span>
          ))}
          {/* def_en is bilingual support, never a replacement for def_vi. */}
          {senses[0]?.def_en ? <span className={styles.meaningEn}>{senses[0].def_en}</span> : null}
          {example ? <span className={styles.example}>“{example.en}”</span> : null}
          {collocation ? <span className={styles.example}>{collocation.en}</span> : null}
        </>
      ) : (
        <>
          <span className={styles.hint}>
            {card.cefr ?? 'Chưa phân cấp'}
            {card.target_band ? ` · band ${card.target_band}` : ''}
          </span>
          <span className={styles.hint}>bấm để lật</span>
        </>
      )}
    </button>
  );
}
