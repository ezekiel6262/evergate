'use client';
import { useRoute } from '@/lib/route';
import { useState } from 'react';
import { Logo } from './Logo';
import { dayLabel, missedOf, useVault } from '@/lib/store';
import { stateCopy } from '@/lib/circuit';

const tabs = [
  { href: '#gate', label: 'Your gate', who: 'Ada' },
  { href: '#guardian', label: 'Guardian', who: 'Sam' },
  { href: '#heir', label: 'Heir', who: 'Theo' },
  { href: '#public', label: 'Public page', who: 'Anyone' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view } = useRoute();
  const path = '#' + view;
  return (
    <div className="shell">
      <header className="shell-top">
        <div className="shell-top-in">
          <Logo href="#home" />
          <nav className="seats" aria-label="View the demo as">
            {tabs.map(t => {
              const on = path === t.href;
              return (
                <a key={t.href} href={t.href} className={`seat ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}>
                  <span>{t.label}</span><small>{t.who}</small>
                </a>
              );
            })}
          </nav>
          <a href="#setup" className="btn sm ghost new-btn">New gate</a>
        </div>
      </header>
      <main className="shell-main">{children}</main>
      <DemoClock key={view} startOpen={view === 'gate'} />
      <style dangerouslySetInnerHTML={{ __html: `
        .shell { min-height: 100vh; padding-bottom: 120px; }
        .shell-top { position: sticky; top: 0; z-index: 40; background: rgba(230,235,225,.92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
        .shell-top-in { width: min(1180px, 100% - 32px); margin: 0 auto; height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .seats { display: flex; gap: 4px; background: var(--paper); border: 1px solid var(--line); border-radius: 999px; padding: 4px; }
        .seat { display: grid; text-decoration: none; padding: 5px 16px; border-radius: 999px; line-height: 1.15; text-align: center; color: var(--pine); }
        .seat span { font-weight: 560; font-size: .92rem; }
        .seat small { font-size: .72rem; color: var(--moss); }
        .seat.on { background: var(--pine); color: var(--paper); }
        .seat.on small { color: var(--marigold-soft); }
        .shell-main { width: min(1180px, 100% - 32px); margin: 0 auto; padding-top: 36px; }
        @media (max-width: 820px) {
          .shell-top-in { height: auto; padding: 10px 0; flex-wrap: wrap; }
          .seats { order: 3; width: 100%; overflow-x: auto; }
          .seat { flex: 1; padding: 5px 8px; }
        }
      ` }} />
    </div>
  );
}

function DemoClock({ startOpen }: { startOpen: boolean }) {
  const { vault, advance, reset } = useVault();
  const [open, setOpen] = useState(startOpen);
  const missed = missedOf(vault);
  return (
    <aside className={`clock ${open ? '' : 'closed'}`} aria-label="Demo timeline">
      <button className="clock-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M9 5v4l2.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></svg>
        Demo timeline
      </button>
      {open && (
        <div className="clock-body">
          <p><b>{dayLabel(vault.day)}</b></p>
          <p className="small">{stateCopy[vault.state].name}. {vault.state < 2 ? `${missed} of ${vault.missesAllowed} check-ins missed.` : ''}</p>
          <div className="clock-btns">
            <button className="btn sm" onClick={() => advance(vault.intervalDays)}>Skip one check-in</button>
            <button className="btn sm ghost" onClick={reset}>Reset</button>
          </div>
          <p className="small clock-note">Moves the calendar forward so you can see every stage. Real gates use real time.</p>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .clock { position: fixed; right: 20px; bottom: 20px; z-index: 60; width: 270px; background: var(--ink); color: var(--paper); border-radius: 20px; padding: 6px; }
        .clock.closed { width: auto; }
        .clock-toggle { display: flex; align-items: center; gap: 8px; background: none; border: 0; color: var(--marigold-soft); font-weight: 600; padding: 8px 10px; cursor: pointer; font-size: .9rem; }
        .clock-body { padding: 4px 12px 12px; display: grid; gap: 8px; }
        .clock-btns { display: flex; gap: 8px; margin-top: 4px; }
        .clock .btn { background: var(--marigold); border-color: var(--marigold); color: var(--ink); }
        .clock .btn.ghost { background: transparent; color: var(--paper); border-color: rgba(247,249,244,.4); }
        .clock-note { color: var(--moss-soft); font-size: .78rem; }
        @media (max-width: 600px) { .clock { left: 12px; right: 12px; bottom: 12px; width: auto; } }
      ` }} />
    </aside>
  );
}
