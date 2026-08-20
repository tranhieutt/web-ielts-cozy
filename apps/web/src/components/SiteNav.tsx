'use client';

/**
 * Shared navigation shell (the piece VOC-WEB-01 deferred).
 *
 * The Next app took over `/vocabulary` from the prototype, but shipped without
 * a nav — so a learner who reached it had no way back to any other screen
 * except the browser's back button. This restores the same eleven destinations
 * the prototype offers, in the same order and with the same labels, so moving
 * between the real page and the remaining mockup screens does not feel like
 * landing in a different product.
 *
 * Plain `<a>` on purpose: every destination except `/vocabulary` is served by
 * the prototype, which needs a real document load. Next's client router would
 * only 404 against routes it does not own.
 */

import { usePathname } from 'next/navigation';

import styles from './site-nav.module.css';

/**
 * Mirrors the prototype's own nav list, labels included. When a screen moves to
 * a real page, only `scripts/app-routes.mjs` needs to change — this list is
 * about what a learner can reach, not about who renders it.
 */
const ITEMS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reading', label: 'Reading' },
  { href: '/listening', label: 'Listening' },
  { href: '/writing', label: 'Writing' },
  { href: '/speaking', label: 'Speaking' },
  { href: '/mock', label: 'Mock' },
  { href: '/vocabulary', label: 'Từ vựng' },
  { href: '/library', label: 'Kho đề' },
  { href: '/progress', label: 'Tiến độ' },
  { href: '/profile', label: 'Hồ sơ' },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Điều hướng chính">
        {/*
          Eleven links sit in front of every page's content, so without this a
          keyboard user tabs through the whole nav before reaching the flashcard
          — on every card, every session. Hidden until focused, which is the
          only time it is useful.
        */}
        <a className={styles.skip} href="#noi-dung">
          Bỏ qua điều hướng
        </a>
        <ul className={styles.list}>
        {ITEMS.map((item) => {
          // `/vocabulary/review` still belongs to the Từ vựng section, so the
          // learner is never left without a marked position in the nav.
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(`${item.href}/`));

          return (
            <li key={item.href}>
              <a
                className={active ? `${styles.item} ${styles.itemActive}` : styles.item}
                href={item.href}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          );
        })}
        </ul>
      </nav>
    </div>
  );
}
