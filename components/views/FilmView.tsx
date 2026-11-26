'use client';
import { useEffect, useState } from 'react';
import { Film } from '@/components/Film';
import { FilmPlayer } from '@/components/FilmPlayer';
import { Logo } from '@/components/Logo';

declare global { interface Window { __setT?: (t: number) => void; __ready?: boolean } }

export function FilmView() {
  const [capture, setCapture] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('capture')) {
      setCapture(true);
      window.__setT = (v: number) => setT(v);
      document.fonts.ready.then(() => { window.__ready = true; });
    }
  }, []);

  if (capture) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#e6ebe1' }}>
        <Film t={t} style={{ width: '100vw', height: '100vh' }} />
        <style dangerouslySetInnerHTML={{ __html: `body { overflow: hidden; } [aria-hidden][style*="position: fixed"] { display: none !important; }` }} />
      </div>
    );
  }

  return (
    <div className="fp">
      <header className="fp-top">
        <Logo />
        <a href="#setup" className="btn sm">Set up your gate</a>
      </header>
      <div className="fp-stage">
        <FilmPlayer className="fp-film" />
      </div>
      <div className="fp-foot">
        <p>The Evergate film, 32 seconds.</p>
        <a className="btn ghost sm" href="#home">Back to the site</a>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .fp { min-height: 100vh; background: var(--pine); color: var(--paper); display: grid; grid-template-rows: auto 1fr auto; }
        .fp-top { display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; }
        .fp-top .logo { color: var(--paper) !important; }
        .fp-top .btn { background: var(--marigold); border-color: var(--marigold); color: var(--ink); }
        .fp-stage { display: grid; place-items: center; padding: 0 24px; }
        .fp-film { width: min(1400px, 100%); aspect-ratio: 16 / 9; border-radius: 22px; overflow: hidden; }
        .fp-foot { display: flex; justify-content: space-between; align-items: center; padding: 20px 28px; color: var(--moss-soft); gap: 12px; flex-wrap: wrap; }
        @media (max-width: 520px) {
          .fp-top, .fp-foot { padding: 14px 16px; }
          .fp-stage { padding: 0 16px; }
          .fp-top .btn { padding: 0 12px; }
        }
        .fp-foot .btn { color: var(--paper); border-color: rgba(247,249,244,.4); }
      ` }} />
    </div>
  );
}
