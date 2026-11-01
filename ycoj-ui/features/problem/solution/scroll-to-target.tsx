'use client';

import { useEffect } from 'react';

type Props = {
  /** DOM id of the element to scroll to, when the URL targets one. */
  targetId?: string;
};

/**
 * Scrolls to a permalink target without a hash in the canonical URL, so the
 * highlighted solution stays addressable as `/problem/:pid/solution/:psid`.
 */
export default function ScrollToTarget({ targetId }: Props) {
  useEffect(() => {
    if (!targetId) return;
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
  }, [targetId]);

  return null;
}
