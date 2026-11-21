'use client';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { PickVault } from '@/components/PickVault';
import { spell } from '@/lib/cadence';
import { explain, shortAddr } from '@/lib/chain';
import { missedOf, useVault, Vault, whenLabel } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

export function GuardianView() {
  return (
    <AppShell>
      <PickVault role="guardian" none="This wallet is not a guardian of a gate.">
        {vault => <Guardian vault={vault} />}
      </PickVault>
    </AppShell>
  );
}

function Guardian({ vault }: { vault: Vault }) {
  const { account } = useWallet();
  const { approve } = useVault();
  const g = vault.guardians.find(x => account && x.addr.toLowerCase() === account.toLowerCase()) || vault.guardians[0];
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approvals = vault.guardians.filter(x => x.approved).length;
  const leftSec = vault.alertAt ? vault.alertAt + vault.waitSeconds - vault.now : vault.waitSeconds;
  const waitLine = leftSec <= 0 ? 'The wait is over.' : leftSec < 86400 ? 'Less than a day of waiting left.' : `${spell(Math.ceil(leftSec / 86400))} of waiting left.`;

  const doApprove = async () => {
    setBusy(true);
    setError('');
    try {
      await approve(vault.id);
      setConfirm(false);
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gd">
      <div className="gd-head">
        <p className="muted">Signed in as {account ? shortAddr(account) : g.name}</p>
        <h1>Gates you guard</h1>
      </div>

      <article className={`gd-card s${vault.state}`}>
        <MiniGate state={vault.state} progress={vault.state === 0 ? 1 : 0.1} size={170} />
        <div className="gd-body">
          <h2>Gate {vault.id}</h2>

          {vault.state === 0 && (
            <>
              <p>Nothing to do. {vault.owner} is checking in. You will be asked only if {vault.missesAllowed} check-ins are missed.</p>
              <p className="small muted">{missedOf(vault)} of {vault.missesAllowed} check-ins missed so far.</p>
            </>
          )}

          {vault.state === 1 && (
            <>
              <p className="gd-alert">{vault.owner} has missed {missedOf(vault)} check-ins{vault.alertAt ? `. The alert started on ${whenLabel(vault.alertAt)}.` : '.'}</p>
              <div className="gd-steps">
                <p><b>Before you approve,</b> try to reach {vault.owner} by phone or in person. A single check-in from them cancels everything.</p>
                <p className="small muted">Approving does not send money to you. It lets the heirs claim after the wait. {approvals} of {vault.quorum} approvals so far. {waitLine}</p>
              </div>
              {g.approved ? <p className="ok">You approved. Thank you.</p> : !confirm
                ? <button className="btn" onClick={() => setConfirm(true)}>I could not reach {vault.owner}</button>
                : (
                  <div className="gd-confirm">
                    <p>Approve the release of gate {vault.id} to {vault.heirs.map(h => h.name).join(' and ')}?</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn" disabled={busy} onClick={doApprove}>{busy ? 'Waiting for your wallet…' : 'Approve release'}</button>
                      <button className="btn ghost" onClick={() => setConfirm(false)}>Not yet</button>
                    </div>
                  </div>
                )}
              {error && <p className="warn-line">{error}</p>}
            </>
          )}

          {vault.state >= 2 && <p>The gate is open for {vault.heirs.map(h => h.name).join(' and ')}. Your part is done.</p>}
        </div>
      </article>

      <p className="small muted">Guardians never hold funds and cannot redirect them. <a href="#public">Read the rule</a>.</p>

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
        .warn-line { color: var(--alert); }
        @media (max-width: 720px) {
          .gd-card { grid-template-columns: 1fr; justify-items: center; text-align: center; border-radius: 140px 140px 24px 24px; padding: 28px 18px; }
          .gd-body { justify-items: center; }
        }
      ` }} />
    </div>
  );
}
