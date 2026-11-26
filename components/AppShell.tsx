'use client';
import { useRoute } from '@/lib/route';
import { shortAddr } from '@/lib/chain';
import { useWallet } from '@/lib/wallet';
import { Logo } from './Logo';

const tabs = [
  { href: '#gate', label: 'Your gate' },
  { href: '#guardian', label: 'Guardian' },
  { href: '#heir', label: 'Heir' },
  { href: '#public', label: 'Public page' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view } = useRoute();
  const path = '#' + view;
  const { account, connect, connecting } = useWallet();
  return (
    <div className="shell">
      <header className="shell-top">
        <div className="shell-top-in">
          <Logo href="#home" />
          <nav className="seats" aria-label="App">
            {tabs.map(t => {
              const on = path === t.href;
              return (
                <a key={t.href} href={t.href} className={`seat ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}>
                  <span>{t.label}</span>
                </a>
              );
            })}
          </nav>
          <div className="shell-actions">
            <a href="#setup" className="btn sm ghost new-btn">New gate</a>
            <button className="btn sm" onClick={connect} disabled={connecting || !!account}>
              {account ? shortAddr(account) : connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          </div>
        </div>
      </header>
      <main className="shell-main">{children}</main>
      <style dangerouslySetInnerHTML={{ __html: `
        .shell { min-height: 100vh; }
        .shell-top { position: sticky; top: 0; z-index: 40; background: var(--lichen); border-bottom: 1px solid var(--line); }
        .shell-top-in { width: min(1180px, 100% - 32px); margin: 0 auto; height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .shell-actions { display: flex; gap: 8px; align-items: center; }
        .seats { display: flex; gap: 4px; background: var(--paper); border: 1px solid var(--line); border-radius: 999px; padding: 4px; }
        .seat { display: grid; text-decoration: none; padding: 8px 16px; border-radius: 999px; line-height: 1.15; text-align: center; color: var(--pine); }
        .seat span { font-weight: 560; font-size: .92rem; }
        .seat.on { background: var(--pine); color: var(--paper); }
        .shell-main { width: min(1180px, 100% - 32px); margin: 0 auto; padding: 36px 0 64px; }
        .empty { background: var(--paper); border: 1px solid var(--line); border-radius: 28px; padding: 48px 32px; display: grid; gap: 14px; justify-items: start; max-width: 640px; }
        .empty h1 { font-size: 2.4rem; }
        .picks { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .picks button { border: 1.5px solid var(--line); background: var(--paper); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
        .picks button.on { background: var(--pine); color: var(--paper); border-color: var(--pine); }
        @media (max-width: 820px) {
          .shell-top-in { height: auto; padding: 12px 0 10px; display: grid; grid-template-columns: 1fr auto; gap: 10px 8px; align-items: center; }
          .seats { grid-column: 1 / -1; width: auto; display: grid; grid-template-columns: 1fr 1fr; border-radius: 16px; }
          .seat { padding: 10px 8px; }
          .seat span { font-size: .86rem; white-space: nowrap; }
          .shell-actions .btn.sm { padding: 0 12px; min-height: 40px; }
        }
      ` }} />
    </div>
  );
}
