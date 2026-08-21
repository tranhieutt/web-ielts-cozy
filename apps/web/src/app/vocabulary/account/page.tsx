// VOC-WEB-09 — where the footer link lands.
//
// HONEST STATE: `VOC-API-01` built anonymous sessions only. Linking an OAuth
// identity to the existing anonymous UUID is enabled on the project
// (`enable_manual_linking`) but has no UI and no route yet. This page says so
// plainly rather than showing a sign-in button that cannot work — a dead
// control costs more trust than a missing one.
import styles from '@/features/vocabulary/components/account.module.css';

export const metadata = { title: 'Tài khoản — IELTS Cozy' };

export default function AccountPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Giữ tiến độ khi đổi thiết bị</h1>

      <p className={styles.body}>
        Bạn đang học với một phiên ẩn danh. Tiến độ được lưu trên máy chủ, nhưng phiên này gắn với
        trình duyệt hiện tại — mở trên điện thoại khác hoặc xoá dữ liệu trình duyệt là bắt đầu lại
        từ đầu.
      </p>

      <p className={styles.body}>
        Chức năng liên kết tài khoản để giữ tiến độ qua nhiều thiết bị{' '}
        <strong>chưa khả dụng</strong>. Khi có, tiến độ hiện tại của bạn sẽ được giữ nguyên: tài
        khoản gắn vào chính phiên bạn đang dùng, không phải tạo lại từ đầu.
      </p>

      <p className={styles.footnote}>
        Nếu bạn không hoạt động trong 3 tháng, dữ liệu học sẽ được xoá.
      </p>

      <a className={styles.back} href="/vocabulary">
        Về từ vựng
      </a>
    </main>
  );
}
