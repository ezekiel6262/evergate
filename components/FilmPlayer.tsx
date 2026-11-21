'use client';
import { useEffect, useRef, useState } from 'react';
import { Film, FILM_LENGTH } from './Film';

export function FilmPlayer({ className = '', controls = true, start = 0 }: { className?: string; controls?: boolean; start?: number }) {
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(true);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPlaying(false); setT(25.8); }
  }, []);

  useEffect(() => {
    if (!playing) { last.current = undefined; return; }
    const tick = (now: number) => {
      if (last.current !== undefined) setT(p => (p + (now - last.current!) / 1000) % FILM_LENGTH);
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing]);

  return (
    <div className={`film ${className}`}>
      <Film t={t} slice style={{ width: '100%', height: '100%' }} />
      {controls && (
        <div className="film-ctl">
          <button onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause film' : 'Play film'}>
            {playing
              ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5l9 5.5-9 5.5z" fill="currentColor" /></svg>}
          </button>
          <input type="range" min={0} max={FILM_LENGTH} step={0.05} value={t} aria-label="Film position"
            onChange={e => { setT(parseFloat(e.target.value)); }} />
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .film { position: relative; }
        .film-ctl { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
          background: rgba(247,249,244,.86); backdrop-filter: blur(6px); padding: 6px 12px 6px 6px; border-radius: 999px; width: min(320px, 80%); }
        .film-ctl button { width: 32px; height: 32px; border-radius: 50%; border: 0; background: var(--pine); color: var(--paper); display: grid; place-items: center; cursor: pointer; flex: none; }
        .film-ctl input { flex: 1; accent-color: var(--pine); }
        @media (max-width: 600px) { .film-ctl { width: auto; padding: 4px; bottom: 8px; left: auto; right: 10px; transform: none; } .film-ctl input { display: none; } }
      ` }} />
    </div>
  );
}
