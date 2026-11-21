'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { RulePlain } from '@/components/VaultBits';
import { bitGroups, packInputs, stateCopy, step } from '@/lib/circuit';
import { dayLabel, inputsOf, useVault } from '@/lib/store';

export function PublicView() {
  return <AppShell><Page /></AppShell>;
}

function Page() {
  const { vault } = useVault();
  const [ran, setRan] = useState(0);
  const inputs = inputsOf(vault);
  const out = step(vault.state, inputs);
  const bits = packInputs(inputs);
  const sc = stateCopy[vault.state];
  let off = 0;

  const facts = [
    ['Rule number', vault.circuitId],
    ['Network', 'X Layer, chain 196'],
    ['Gate wallet', `${vault.wallet.slice(0, 10)}…${vault.wallet.slice(-6)}`],
    ['Guardians', vault.guardians.map(g => g.name).join(', ')],
    ['Heirs', vault.heirs.map(h => `${h.name} ${h.bps / 100}%`).join(', ')],
    ['Created', dayLabel(0)],
  ];

  return (
    <article className="pr">
      <div className="addr">
        <span className="addr-url"><Lock />{vault.page}</span>
        <span className="addr-ok"><Shield />Every byte of this page matches its onchain hash</span>
      </div>

      <header className="pr-head">
        <MiniGate state={vault.state} progress={vault.state === 0 ? 1 : 0.15} size={200} />
        <div>
          <p className="muted">Public rule page</p>
          <h1>{vault.owner}&apos;s gate</h1>
          <span className={`pill ${sc.tone}`}><span className="dot" />{sc.name}</span>
          <p className="pr-plain">{publicPlain(vault.owner, vault.state)}</p>
        </div>
      </header>

      <div className="pr-grid">
        <section className="pr-sec">
          <h2>The rule, in plain words</h2>
          <RulePlain v={vault} />
          <p className="small muted">The rule cannot read the clock. The keeper turns it into two answers: how many check-ins were missed, never more than 15, and whether the wait is over, only after an alert has started. While the gate is all good, {vault.owner} can replace the plan. Nobody else can change it, including Evergate.</p>
        </section>

        <section className="pr-sec">
          <h2>Facts</h2>
          <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </section>

        <section className="pr-sec wide">
          <div className="rc-head">
            <div>
              <h2>Recompute it yourself</h2>
              <p className="muted">Runs the same step the rule runs onchain, with today&apos;s inputs. It costs nothing and needs no account. The misses allowed and the quorum are fixed in the rule. The keeper only sends the bits that can change.</p>
            </div>
            <button className="btn" onClick={() => setRan(r => r + 1)}>Recompute now</button>
          </div>
          <motion.div key={ran} className="rc" initial={ran ? { opacity: 0.3 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="rc-col">
              <p className="small muted">Inputs</p>
              <div className="bits">
                {bitGroups.map(g => {
                  const slice = bits.slice(off, off + g.width); off += g.width;
                  return <div key={g.label} className="bitg"><div className="cells">{slice.map((b, i) => <span key={i} className={b === '1' ? 'one' : ''}>{b}</span>)}</div><small>{g.label}</small></div>;
                })}
              </div>
            </div>
            <svg className="rc-wire" viewBox="0 0 120 40" aria-hidden><path d="M0 20h110" stroke="var(--pine)" strokeWidth="3" strokeDasharray="6 6"><animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" /></path><path d="M104 12l10 8-10 8" fill="none" stroke="var(--pine)" strokeWidth="3" /></svg>
            <div className="rc-col">
              <p className="small muted">Outputs</p>
              <div className="outs">
                <div><b>{stateCopy[out.next].name}</b><small>next state</small></div>
                <div><b>{out.alert ? 'Yes' : 'No'}</b><small>send alert</small></div>
                <div><b>{out.release ? 'Yes' : 'No'}</b><small>heirs may claim</small></div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="pr-sec wide heirs-how">
          <h2>If you are an heir</h2>
          <ol>
            <li>You will get a TapeSend message and an email when the gate is ready.</li>
            <li>Open this page or the Evergate app and connect a wallet. The app helps you create one.</li>
            <li>Press claim. Your share of every asset arrives in one transaction.</li>
          </ol>
          <p className="small muted">This page is served from X Layer through DeWEB. It keeps working even if Evergate&apos;s own servers do not.</p>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .pr { display: grid; gap: 28px; }
        .addr { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: var(--paper); border: 1px solid var(--line); border-radius: 999px; padding: 8px 10px 8px 16px; font-size: .9rem; }
        .addr-url { display: flex; align-items: center; gap: 8px; font-weight: 560; font-variant-numeric: tabular-nums; }
        .addr-ok { display: flex; align-items: center; gap: 8px; color: #2f7d47; background: #e5f1e7; padding: 4px 12px; border-radius: 999px; }
        .pr-head { display: grid; grid-template-columns: auto 1fr; gap: 40px; align-items: center; }
        .pr-head > div { display: grid; gap: 12px; justify-items: start; }
        .pr-head h1 { font-size: clamp(2.4rem, 4.4vw, 3.6rem); }
        .pr-plain { max-width: 34em; font-size: 1.08rem; }
        .pr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .pr-sec { background: var(--paper); border: 1px solid var(--line); border-radius: 22px; padding: 28px; display: grid; gap: 16px; align-content: start; }
        .pr-sec.wide { grid-column: 1 / -1; }
        .pr-sec h2 { font-size: 1.6rem; }
        .facts { margin: 0; display: grid; }
        .facts div { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); }
        .facts dt { color: var(--moss); }
        .facts dd { margin: 0; font-variant-numeric: tabular-nums; }
        .rc-head { display: flex; justify-content: space-between; align-items: end; gap: 20px; flex-wrap: wrap; }
        .rc { display: grid; grid-template-columns: 1fr 120px 1fr; gap: 16px; align-items: center; background: var(--lichen); border-radius: 18px; padding: 24px; }
        .rc-col { display: grid; gap: 10px; }
        .bits { display: flex; flex-wrap: wrap; gap: 10px; }
        .bitg { display: grid; justify-items: center; gap: 4px; }
        .cells { display: flex; gap: 2px; }
        .cells span { width: 20px; height: 26px; display: grid; place-items: center; border-radius: 5px; background: var(--paper); font-size: .85rem; color: var(--moss); font-variant-numeric: tabular-nums; }
        .cells span.one { background: var(--pine); color: var(--marigold-soft); }
        .bitg small, .outs small { font-size: .75rem; color: var(--moss); }
        .outs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .outs div { background: var(--paper); border-radius: 12px; padding: 12px; display: grid; gap: 2px; }
        .heirs-how ol { margin: 0; padding-left: 1.3em; display: grid; gap: 8px; }
        @media (max-width: 860px) {
          .pr-head { grid-template-columns: 1fr; justify-items: center; text-align: center; }
          .pr-head > div { justify-items: center; }
          .pr-grid { grid-template-columns: 1fr; }
          .rc { grid-template-columns: 1fr; }
          .rc-wire { transform: rotate(90deg); width: 60px; justify-self: center; }
          .facts div { grid-template-columns: 1fr; gap: 2px; }
        }
      ` }} />
    </article>
  );
}

function Lock() { return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" fill="var(--pine)" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="var(--pine)" strokeWidth="1.6" fill="none" /></svg>; }
function Shield() { return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M7 1l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V3z" fill="#2f7d47" /><path d="M4.6 7.2l1.7 1.7L9.6 5.6" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>; }

function publicPlain(owner: string, state: number) {
  return [
    `${owner} is checking in. Nothing in this gate can move without ${owner}.`,
    `${owner} has missed check-ins. Guardians and heirs have been alerted and the waiting period is running. One check-in from ${owner} cancels it.`,
    'Guardians approved and the waiting period is over. Heirs can claim their shares.',
    'Every heir has claimed. This gate is closed for good.',
  ][state];
}
