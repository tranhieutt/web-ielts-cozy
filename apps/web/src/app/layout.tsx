import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'IELTS Cozy',
  description: 'Học từ vựng IELTS theo chủ đề.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
