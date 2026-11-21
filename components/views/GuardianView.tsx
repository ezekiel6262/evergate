'use client';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { spell } from '@/lib/cadence';
import { dayLabel, missedOf, useVault } from '@/lib/store';

export function GuardianView() {
  return <AppShell><Guardian /></AppShell>;
}

function Guardian() {
  const { vault, approve } = useVault();
  const me = 0; // Sam
  const g = vault.guardians[me];
  const [confirm, setConfirm] = useState(false);
  const approvals = vault.guardians.filter(x => x.approved).length;
  const waitLeft = vault.alertDay !== null ? Math.max(0, vault.waitDays - (vault.day - vault.alertDay)) : vault.waitDays;

  return (
    <div className="gd">
      <div className="gd-head">
        <p className="muted">Signed in as {g.name}</p>
        <h1>Gates you guard</h1>
      </div>

      <article className={`gd-card s${vault.state}`}>
        <MiniGate state={vault.state} progress={vault.state === 0 ? 1 : 0.1} size={170} />
        <div className="gd-body">
          <h2>{vault.owner}&apos;s gate</h2>

          {vault.state === 0 && (
            <>
              <p>Nothing to do. {vault.owner} is checking in. You will get a TapeSend message and an email if {vault.owner} misses {vault.missesAllowed} check-ins.</p>
              <p className="small muted">{missedOf(vault)} of {vault.missesAllowed} check-ins missed so far.</p>
            </>
          )}

          {vault.state === 1 && (
            <>
              <p className="gd-alert">{vault.owner} has missed {missedOf(vault)} check-ins. The alert went out on {dayLabel(vault.alertDay ?? vault.day)}.</p>
              <div className="gd-steps">
                <p><b>Before you approve,</b> try to reach {vault.owner} by phone or in person. A single check-in from {vault.owner} cancels everything.</p>
                <p className="small muted">Approving does not send money to you. It lets the heirs claim after the wait. {approvals} of {vault.quorum} approvals so far. {waitLeft === 0 ? 'The wait is over.' : `${spell(waitLeft)} of waiting left.`}</p>
              </div>
              {g.approved ? <p className="ok">You approved. Thank you.</p> : !confirm
                ? <button className="btn" onClick={() => setConfirm(true)}>I could not reach {vault.owner}</button>
                : (
                  <div className="gd-confirm">
                    <p>Approve the release of {vault.owner}&apos;s gate to {vault.heirs.map(h => h.name).join(' and ')}?</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => { approve(me); setConfirm(false); }}>Approve release</button>
                      <button className="btn ghost" onClick={() => setConfirm(false)}>Not yet</button>
                    </div>
                  </div>
                )}
              <p className="small muted">Demo: you can also approve as {vault.guardians.slice(1).filter(x => !x.approved).map(x => x.name).join(' or ') || 'nobody else'}.{' '}
                {vault.guardians.map((x, n) => n > 0 && !x.approved && <button key={n} className="linkish" onClick={() => approve(n)}>Approve as {x.name.split(' ')[0]}</button>)}
              </p>
            </>
          )}

          {vault.state >= 2 && <p>The gate is open for {vault.heirs.map(h => h.name).join(' and ')}. Your part is done.</p>}
        </div>
      </article>

      <p className="small muted">Guardians never hold funds and cannot redirect them. <a href="#public">Read {vault.owner}&apos;s rule</a>.</p>

      <style dangerouslySetInnerHTML={{ __html: `
        .gd { display: grid; gap: 24px; max-width: 860px; }
        .gd-head h1 { font-size: 2.6rem; }
        .gd-card { display: grid; grid-template-columns: auto 1fr; gap: 32px; background: var(--paper); border: 1px solid var(--line); border-radius: 160px 28px 28px 160px; padding: 30px 36px 30px 28px; align-items: center; }
        .gd-card.s1 { background: #fbf3ee; border-color: #e7b9a6; }
        .gd-body { display: grid; gap: 14px; justify-items: start; }
        .gd-body h2 { font-size: 1.8rem; }
        .gd-alert { color: var(--alert); font-weight: 560; }
        .gd-steps { display: grid; gap: 8px; }
        .gd-confirm { display: grid; gap: 12px; background: var(--paper); padding: 16px; border-radius: 14px; border: 1px solid var(--line); }
        .ok { color: #2f7d47; font-weight: 600; }
        .linkish { background: none; border: 0; color: var(--pine); text-decoration: underline; cursor: pointer; padding: 0 6px 0 0; font-size: inherit; }
        @media (max-width: 760px) { .gd-card { grid-template-columns: 1fr; justify-items: center; border-radius: 120px 120px 24px 24px; padding: 28px 20px; } }
      ` }} />
    </div>
  );
}
