// The footer is a layout concern (VOC-WEB-09): ADR-004 puts the account link on
// every Vocabulary screen, not on one of them.
import type { ReactNode } from 'react';

import { VocabularyFooter } from '@/features/vocabulary/components/VocabularyFooter';

export default function VocabularyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <VocabularyFooter />
    </>
  );
}
