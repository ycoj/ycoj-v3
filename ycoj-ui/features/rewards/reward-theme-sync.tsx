'use client';

import { useEffect } from 'react';

/** Keep portaled menus and dialogs in the equipped theme as well. */
export default function RewardThemeSync({ id }: { id?: string }) {
  useEffect(() => {
    if (id) document.documentElement.setAttribute('data-reward-accent', id);
    else document.documentElement.removeAttribute('data-reward-accent');
    return () => document.documentElement.removeAttribute('data-reward-accent');
  }, [id]);
  return null;
}
