'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { PickVault } from '@/components/PickVault';
import { fmt, missedOf, nextCheckIn, useVault, Vault, whenLabel } from '@/lib/store';
import { stateCopy } from '@/lib/circuit';
import { explain } from '@/lib/chain';
import { RulePlain, ShareBar } from '@/components/VaultBits';
import { parseUnits } from 'viem';

export function GateView() {
  return (
    <AppShell>
      <PickVault role="owner" none="This wallet has no gate on X Layer.">
        {vault => <Owner vault={vault} />}
      </PickVault>
    </AppShell>
  );
}

function Owner({ vault }: { vault: Vault }) {
  const { checkIn, withdraw } = useVault();
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [taking, setTaking] = useState('');
  const missed = missedOf(vault);
  const nextDue = nextCheckIn(vault);
  const progress = vault.state === 0 ? Math.max(0.04, 1 - (missed / (vault.missesAllowed + 1))) : vault.state === 1 ? 0.08 : 1;
  const sc = stateCopy[vault.state];

  const note = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(''), 5000);
  };

  const doCheck = async () => {
    const wasAlert = vault.state === 1;
    setBusy(true);
    try {
      await checkIn(vault.id);
      note(wasAlert ? 'Alert cancelled.' : `Checked in. Next check-in by ${whenLabel(nextDue)}.`);
    } catch (e) {
      note(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    setBusy(true);
    try {
      const amount = parseUnits(taking || '0', 18);
      if (amount <= 0n) throw new Error('Enter an OKB amount.');
      await withdraw(vault.id, null, amount);
      setTaking('');
      note('Withdrawn to your wallet.');
    } catch (e) {
      note(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const headline = { 0: 'All good.', 1: 'Your guardians have been alerted.', 2: 'Your gate is open for your heirs.', 3: 'Your gate has been handed on.' }[vault.state];

  return (
    <div className="dash">
      <section className={`status s${vault.state}`}>
        <div className="status-art"><MiniGate state={vault.state} progress={progress} size={250} /></div>
        <div className="status-copy">
          <span className={`pill ${sc.tone}`}><span className="dot" />{sc.name}</span>
          <h1>{headline}</h1>
          {vault.state === 0 && <p className="lead">Next check-in by <b>{whenLabel(nextDue)}</b>. {missed > 0 ? `You have missed ${missed} of ${vault.missesAllowed} allowed.` : 'You are up to date.'}</p>}
          {vault.state === 1 && <p className="lead">You missed {missed} check-ins{vault.alertAt ? `, starting ${whenLabel(vault.alertAt)}` : ''}. Nothing has moved. Check in to cancel.</p>}
          {vault.state === 2 && <p className="lead">Your guardians approved and the waiting period ended. Anyone can send the shares to your heirs.</p>}
          {vault.state === 3 && <p className="lead">The shares have been paid. This gate is closed for good.</p>}
          {vault.state < 2 && (
            <button className="btn sun here" onClick={doCheck} disabled={busy}>
              {busy ? 'Waiting for your wallet…' : vault.state === 1 ? "I'm here, cancel the alert" : "I'm here"}
            </button>
          )}
          <AnimatePresence>
            {toast && (
              <motion.p className="toast" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.p>
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-h"><h2>In your gate</h2><span className="small muted">Held in the gate&apos;s own wallet</span></div>
          <ul className="assets">
            {vault.assets.length === 0 && <li>Nothing in the gate yet. Send OKB or a token to the wallet below.</li>}
            {vault.assets.map(a => (
              <li key={a.sym + (a.token || '')}><span className="tok" style={{ background: a.color }} aria-hidden>{a.sym[0]}</span><span>{a.sym}</span><b>{fmt(a.amount)}</b></li>
            ))}
          </ul>
          <p className="small muted wallet">Wallet {vault.wallet}</p>
          <div className="row-btns">
            <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(vault.wallet); note('Gate wallet copied. Send funds to that address.'); }}>Copy wallet</button>
          </div>
          {vault.state === 0 && (
            <div className="row-btns">
              <input className="input" inputMode="decimal" placeholder="OKB to withdraw" aria-label="OKB to withdraw" value={taking} onChange={e => setTaking(e.target.value)} />
              <button className="btn sm ghost" disabled={busy} onClick={doWithdraw}>Withdraw</button>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Heirs</h2><span className="small muted">Paid by share of every asset</span></div>
          <ShareBar heirs={vault.heirs} />
          <ul className="people">
            {vault.heirs.map((h, i) => (
              <li key={h.addr}><span className="av" style={{ background: i ? 'var(--marigold-soft)' : 'var(--lilac)' }}>{h.addr.slice(2, 4)}</span>
                <div><b>{h.name}</b><small>{h.addr}</small></div>
                <span className="share">{h.bps / 100}%{h.claimed ? ', paid' : ''}</span></li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Guardians</h2><span className="small muted">{vault.quorum} of {vault.guardians.length} must approve</span></div>
          <ul className="people">
            {vault.guardians.map(g => (
              <li key={g.addr}><span className="av">{g.addr.slice(2, 4)}</span>
                <div><b>{g.name}</b><small>{g.addr}</small></div>
                <span className={`share ${g.approved ? 'ok' : ''}`}>{g.approved ? 'Approved' : vault.state === 1 ? 'Alerted' : 'Standing by'}</span></li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Your rule</h2><a href={`#public`} className="small">See the public page</a></div>
          <RulePlain v={vault} />
          <p className="small muted">You can change this plan while you are checking in. Once an alert starts, it stays until you check in. Nobody else can change it, including Evergate. Rule {vault.circuitId}.</p>
        </section>

        <section className="panel wide">
          <div className="panel-h"><h2>Activity</h2></div>
          <ol className="log">
            {vault.log.map((l, i) => (
              <li key={i} className={l.kind}><span className="log-d">{whenLabel(l.at)}</span><span>{l.text}</span></li>
            ))}
          </ol>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .dash { display: grid; gap: 28px; }
        .status { display: grid; grid-template-columns: auto 1fr; gap: 48px; align-items: center; background: var(--paper); border: 1px solid var(--line); border-radius: 220px 36px 36px 220px; padding: 34px 48px 34px 40px; }
        .status.s1 { border-color: #e7b9a6; background: #fbf3ee; }
        .status.s2, .status.s3 { background: #f3effc; border-color: #d9cdf6; }
        .status-copy { display: grid; gap: 16px; justify-items: start; }
        .status-copy h1 { font-size: clamp(2rem, 3.6vw, 3rem); }
        .lead { font-size: 1.1rem; max-width: 32em; }
        .here { min-height: 60px; padding: 0 34px; font-size: 1.1rem; }
        .toast { background: var(--ink); color: var(--paper); padding: 10px 16px; border-radius: 12px; font-size: .95rem; }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .panel { background: var(--paper); border: 1px solid var(--line); border-radius: 22px; padding: 26px; display: grid; gap: 16px; align-content: start; }
        .panel.wide { grid-column: 1 / -1; }
        .panel-h { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .panel-h h2 { font-size: 1.5rem; }
        .assets, .people, .log { list-style: none; margin: 0; padding: 0; display: grid; }
        .assets li { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
        .tok { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: var(--paper); font-weight: 700; font-size: .8rem; }
        .wallet { font-variant-numeric: tabular-nums; word-break: break-all; }
        .row-btns { display: flex; gap: 8px; align-items: center; }
        .row-btns .input { max-width: 180px; }
        .people li { display: grid; grid-template-columns: 38px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
        .people li div { display: grid; }
        .people small { color: var(--moss); font-size: .8rem; word-break: break-all; }
        .av { width: 36px; height: 36px; border-radius: 50%; background: var(--lichen); display: grid; place-items: center; font-weight: 650; color: var(--pine); text-transform: uppercase; }
        .share { font-weight: 600; font-size: .92rem; color: var(--pine); }
        .share.ok { color: #2f7d47; }
        .log li { display: grid; grid-template-columns: 130px 1fr; gap: 16px; padding: 10px 0; border-top: 1px solid var(--line); }
        .log-d { color: var(--moss); font-size: .9rem; font-variant-numeric: tabular-nums; }
        .log li.alert span:last-child { color: var(--alert); }
        @media (max-width: 860px) {
          .status { grid-template-columns: 1fr; justify-items: center; text-align: center; border-radius: 160px 160px 28px 28px; padding: 32px 22px; }
          .status-copy { justify-items: center; }
          .dash-grid { grid-template-columns: 1fr; }
          .log li { grid-template-columns: 1fr; gap: 2px; }
        }
      ` }} />
    </div>
  );
}
