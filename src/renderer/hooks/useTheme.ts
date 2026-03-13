import { useEffect } from 'react';
import type { Appearance } from '@shared/types';

export function useTheme(appearance: Appearance) {
  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark);
    };

    if (appearance === 'dark') {
      apply(true);
      return;
    }

    if (appearance === 'light') {
      apply(false);
      return;
    }

    // system
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);

    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [appearance]);
}
