'use client';

/**
 * VOC-WEB-09 / VOC-WEB-10 — the quiet end of every Vocabulary screen.
 *
 * ADR-004 decided account creation is OFFERED, never pushed: no banner, no
 * modal, no post-session prompt. So this is a plain link in a footer, and it
 * must stay that way — turning it into a nudge reverses a product decision.
 *
 * The deletion control is deliberately absent mid-review: `usePathname` keeps
 * it on the dashboard only. A destructive action next to the rating buttons is
 * a mis-tap waiting to happen.
 */

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import styles from './vocabulary-footer.module.css';

type Phase =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'deleting' }
  | { status: 'done'; deletedStates: number }
  | { status: 'error' };

export function VocabularyFooter() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });

  const onDashboard = pathname === '/vocabulary';

  async function confirmDelete() {
    setPhase({ status: 'deleting' });
    try {
      const response = await fetch('/api/vocabulary/learner-data', { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as { deletedStates: number };
      setPhase({ status: 'done', deletedStates: result.deletedStates });
    } catch {
      // Never report success on a failed delete: a learner who believes their
      // data is gone when it is not has been told something false about their
      // own privacy.
      setPhase({ status: 'error' });
    }
  }

  return (
    <footer className={styles.footer}>
      {/* Framed as the benefit, not as "Tạo tài khoản": the reason to link an
          account is keeping progress across devices. The stronger warning copy
          about progress being device-local is VOC-WEB-11 and still needs
          Product sign-off, so it is not invented here. */}
      <a className={styles.accountLink} href="/vocabulary/account">
        Giữ tiến độ khi đổi thiết bị
      </a>

      {onDashboard && phase.status === 'idle' && (
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => setPhase({ status: 'confirming' })}
        >
          Xoá dữ liệu học của tôi
        </button>
      )}

      {onDashboard && phase.status === 'confirming' && (
        <div className={styles.confirm}>
          {/* Says what disappears and that it cannot be undone. "Bạn có chắc
              không?" alone gives the learner nothing to decide with. */}
          <p className={styles.confirmText}>
            Thao tác này xoá toàn bộ tiến độ ôn tập và lịch sử đánh giá của bạn. Không khôi phục
            được. Bạn vẫn dùng tiếp được ứng dụng, chỉ là bắt đầu lại từ đầu.
          </p>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.confirmDelete} onClick={confirmDelete}>
              Xoá toàn bộ tiến độ
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setPhase({ status: 'idle' })}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {phase.status === 'deleting' && (
        <p className={styles.status} role="status">
          Đang xoá…
        </p>
      )}

      {phase.status === 'done' && (
        <p className={styles.status} role="status">
          Đã xoá {phase.deletedStates} thẻ khỏi tiến độ của bạn. Tải lại trang để bắt đầu lại.
        </p>
      )}

      {phase.status === 'error' && (
        <p className={`${styles.status} ${styles.error}`} role="alert">
          Chưa xoá được dữ liệu. Kiểm tra kết nối rồi thử lại — tiến độ của bạn vẫn còn nguyên.
        </p>
      )}
    </footer>
  );
}
