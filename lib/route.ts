'use client';
import { useEffect, useState } from 'react';

export const VIEWS = ['home', 'gate', 'setup', 'guardian', 'heir', 'public', 'film'] as const;
export type View = typeof VIEWS[number];

function read(): { view: View; anchor: string | null } {
  if (typeof window === 'undefined') return { view: 'home', anchor: null };
  const h = window.location.hash.replace('#', '');
  if ((VIEWS as readonly string[]).includes(h)) return { view: h as View, anchor: null };
  return { view: 'home', anchor: h || null };
}

export function useRoute() {
  const [r, setR] = useState<{ view: View; anchor: string | null }>({ view: 'home', anchor: null });
  useEffect(() => {
    const f = () => setR(read());
    f(); window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
