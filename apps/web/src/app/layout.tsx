import type { ReactNode } from 'react';

import { SiteNav } from '@/components/SiteNav';

import './globals.css';

export const metadata = {
  title: 'IELTS Cozy',
  description: 'Học từ vựng IELTS theo chủ đề.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {/* The shell every real page sits inside. Without it a learner who
            reaches /vocabulary has no way back to any other screen. */}
        <SiteNav />
        {/* Skip-link target. `tabIndex={-1}` so focus can land here without
            adding another tab stop of its own. */}
        <div id="noi-dung" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
