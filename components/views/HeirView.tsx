'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { PickVault } from '@/components/PickVault';
import { explain } from '@/lib/chain';
import { fmt, missedOf, useVault, Vault } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

export function HeirView() {
  return (
    <AppShell>
      <PickVault role="heir" none="This wallet is not named in a gate.">
        {vault => <Claim vault={vault} />}
      </PickVault>
    </AppShell>
  );
}

function Claim({ vault }: { vault: Vault }) {
  const { account } = useWallet();
  const { claim } = useVault();
  const h = vault.heirs.find(x => account && x.addr.toLowerCase() === account.toLowerCase()) || vault.heirs[0];
  const share = h.bps / 10000;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const timeline = [
    { label: 'The owner is checking in', done: true, now: vault.state === 0 },
    { label: 'Guardians alerted, waiting period running', done: vault.state >= 1, now: vault.state === 1 },
    { label: 'Ready to claim', done: vault.state >= 2, now: vault.state === 2 && !h.claimed },
    { label: 'Your share is in your wallet', done: h.claimed, now: h.claimed },
  ];

  const doClaim = async () => {
    setBusy(true);
    setError('');
    try { await claim(vault.id); }
    catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="cl">
      <section className="cl-hero">
        <div className="cl-art">
          <MiniGate state={vault.state} progress={vault.state === 0 ? 1 : 0.2} size={230} coins={!h.claimed} />
          <AnimatePresence>
            {busy && [0, 1, 2, 3, 4].map(n => (
              <motion.span key={n} className="fly" initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: 160 + n * 8, y: -60 - n * 20, opacity: 0, scale: 0.6 }} transition={{ duration: 1.1, delay: n * 0.08, ease: 'easeOut' }} />
            ))}
          </AnimatePresence>
        </div>
        <div className="cl-copy">
          <h1>You are named in gate {vault.id}.</h1>
          <p className="lead">You receive <b>{h.bps / 100}%</b> of everything in it. {vault.state === 0 && 'There is nothing to do while the owner is checking in.'}{vault.state === 1 && `The owner has missed ${missedOf(vault)} check-ins and the guardians have been alerted. If they check in, this stops.`}</p>
          {vault.state === 2 && !h.claimed && <button className="btn sun big" onClick={doClaim} disabled={busy}>{busy ? 'Claiming…' : `Claim ${h.bps / 100}%`}</button>}
          {h.claimed && <p className="ok">Claimed. The shares were sent.</p>}
          {error && <p className="warn-line">{error}</p>}
        </div>
      </section>

      <div className="cl-grid">
        <section className="panel">
          <h2>Your share</h2>
          {vault.assets.length === 0 && <p className="muted">The gate wallet is empty.</p>}
          <ul className="assets">
            {vault.assets.map(a => <li key={a.sym + (a.token || '')}><span>{a.sym}</span><b>{fmt(a.amount * share)}</b></li>)}
          </ul>
        </section>
        <section className="panel">
          <h2>Where things stand</h2>
          <ol className="tl">
            {timeline.map(t => <li key={t.label} className={`${t.done ? 'done' : ''} ${t.now ? 'now' : ''}`}><span className="tl-dot" />{t.label}</li>)}
          </ol>
        </section>
        <section className="panel wide">
          <h2>Claiming</h2>
          <ol className="newbie">
            <li>Connect the wallet whose address was named as an heir.</li>
            <li>When the guardians have approved and the wait is over, the claim button appears.</li>
            <li>One transaction pays every heir their share. You pay the network fee for that send.</li>
          </ol>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cl { display: grid; gap: 24px; }
        .cl-hero { display: grid; grid-template-columns: auto 1fr; gap: 44px; align-items: center; background: #f3effc; border: 1px solid #d9cdf6; border-radius: 220px 36px 36px 220px; padding: 34px 44px 34px 36px; }
        .cl-art { position: relative; }
        .fly { position: absolute; left: 50%; top: 70%; width: 22px; height: 22px; border-radius: 50%; background: var(--marigold); border: 3px solid var(--marigold-soft); }
        .cl-copy { display: grid; gap: 16px; justify-items: start; }
        .cl-copy h1 { font-size: clamp(1.9rem, 3.4vw, 2.8rem); max-width: 16em; }
        .lead { font-size: 1.1rem; max-width: 34em; }
        .btn.big { min-height: 60px; padding: 0 34px; font-size: 1.1rem; }
        .ok { color: #2f7d47; font-weight: 600; }
        .warn-line { color: var(--alert); }
        .cl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .panel { background: var(--paper); border: 1px solid var(--line); border-radius: 22px; padding: 26px; display: grid; gap: 14px; align-content: start; }
        .panel.wide { grid-column: 1 / -1; }
        .panel h2 { font-size: 1.5rem; }
        .assets { list-style: none; padding: 0; margin: 0; }
        .assets li { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
        .tl { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
        .tl li { display: flex; gap: 12px; align-items: center; padding: 10px 0; color: var(--moss-soft); position: relative; }
        .tl li.done { color: var(--pine); }
        .tl li.now { color: var(--ink); font-weight: 600; }
        .tl-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line); flex: none; background: var(--paper); }
        .tl li.done .tl-dot { background: var(--moss); border-color: var(--moss); }
        .tl li.now .tl-dot { background: var(--marigold); border-color: var(--marigold); box-shadow: 0 0 0 5px rgba(239,166,43,.25); }
        .newbie { margin: 0; padding-left: 1.3em; display: grid; gap: 8px; }
        @media (max-width: 860px) { .cl-hero { grid-template-columns: 1fr; justify-items: center; text-align: center; border-radius: 160px 160px 28px 28px; padding: 30px 20px; } .cl-copy { justify-items: center; } .cl-grid { grid-template-columns: 1fr; } }
      ` }} />
    </div>
  );
}
