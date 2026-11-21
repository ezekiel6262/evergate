'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { RulePlain, ShareBar } from '@/components/VaultBits';
import { CHECK_INS, clampDays, clampMisses, earliestDays, MISS_CHOICES, spell, WAITS } from '@/lib/cadence';
import { demoVault, fmt, Heir, useVault } from '@/lib/store';

const STEPS = ['Assets', 'Heirs', 'Guardians', 'Rule', 'Review'];

type Draft = {
  assets: { sym: string; bal: number; amount: number; on: boolean; color: string }[];
  heirs: Heir[];
  guardians: { name: string; addr: string; note: string }[];
  quorum: number;
  intervalDays: number;
  missesAllowed: number;
  waitDays: number;
};

const initial: Draft = {
  assets: [
    { sym: 'USDT0', bal: 15200, amount: 12500, on: true, color: '#5d7c58' },
    { sym: 'OKB', bal: 58.4, amount: 42, on: true, color: '#173d31' },
  ],
  heirs: [
    { name: 'Theo', addr: '0x41c2…9a0e', bps: 6000, claimed: false, note: 'Son' },
    { name: 'June', addr: '0x93be…17d4', bps: 4000, claimed: false, note: 'Daughter' },
  ],
  guardians: [
    { name: 'Sam Ortiz', addr: '0x2d71…c3a8', note: 'Brother' },
    { name: 'Priya Nair', addr: '0x8e05…44b1', note: 'Lawyer' },
    { name: 'Kemi Adeyemi', addr: '0xa61f…0d29', note: 'Old friend' },
  ],
  quorum: 2, intervalDays: 30, missesAllowed: 3, waitDays: 30,
};

export function SetupView() {
  return <AppShell><Wizard /></AppShell>;
}

function Wizard() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<Draft>(initial);
  const [phase, setPhase] = useState<'edit' | 'creating' | 'done'>('edit');
  const total = d.heirs.reduce((s, h) => s + h.bps, 0);
  const valid = [d.assets.some(a => a.on && a.amount > 0), total === 10000 && d.heirs.every(h => h.name), d.guardians.every(g => g.name), true, true][i];

  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n); };

  if (phase !== 'edit') return <Creating d={d} phase={phase} setPhase={setPhase} />;

  return (
    <div className="wiz">
      <aside className="wiz-rail">
        <h1>Set up your gate</h1>
        <ol>
          {STEPS.map((s, n) => (
            <li key={s} className={n === i ? 'on' : n < i ? 'done' : ''}>
              <button onClick={() => n < i && go(n)} disabled={n > i}><span className="n">{n < i ? <Tick /> : n + 1}</span>{s}</button>
            </li>
          ))}
        </ol>
        <div className="wiz-art"><MiniGate state={0} progress={(i + 1) / STEPS.length} size={150} /></div>
      </aside>

      <section className="wiz-panel">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={i} custom={dir}
            initial={{ opacity: 0, x: 40 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 * dir }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }} className="wiz-step">
            {i === 0 && <StepAssets d={d} setD={setD} />}
            {i === 1 && <StepHeirs d={d} setD={setD} total={total} />}
            {i === 2 && <StepGuardians d={d} setD={setD} />}
            {i === 3 && <StepRule d={d} setD={setD} />}
            {i === 4 && <StepReview d={d} />}
          </motion.div>
        </AnimatePresence>
        <div className="wiz-nav">
          {i > 0 ? <button className="btn ghost" onClick={() => go(i - 1)}>Back</button> : <a className="btn ghost" href="#gate">Cancel</a>}
          {i < 4
            ? <button className="btn" disabled={!valid} onClick={() => go(i + 1)}>Continue to {STEPS[i + 1].toLowerCase()}</button>
            : <button className="btn sun" onClick={() => setPhase('creating')}>Create my gate</button>}
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .wiz { display: grid; grid-template-columns: 280px 1fr; gap: 28px; align-items: start; }
        .wiz-rail { position: sticky; top: 108px; display: grid; gap: 24px; }
        .wiz-rail h1 { font-size: 2.1rem; }
        .wiz-rail ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
        .wiz-rail button { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: 0; padding: 10px 12px; border-radius: 12px; font-weight: 520; color: var(--moss); cursor: pointer; text-align: left; }
        .wiz-rail button:disabled { cursor: default; }
        .wiz-rail li.on button { background: var(--paper); color: var(--ink); }
        .wiz-rail li.done button { color: var(--pine); }
        .n { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); font-size: .85rem; flex: none; }
        .wiz-rail li.on .n { background: var(--pine); color: var(--paper); border-color: var(--pine); }
        .wiz-rail li.done .n { background: var(--marigold); border-color: var(--marigold); }
        .wiz-art { padding-left: 12px; }
        .wiz-panel { background: var(--paper); border: 1px solid var(--line); border-radius: 28px; padding: 40px; min-height: 560px; display: grid; grid-template-rows: 1fr auto; gap: 32px; overflow: hidden; }
        .wiz-step { display: grid; gap: 22px; align-content: start; }
        .wiz-step h2 { font-size: 2rem; }
        .wiz-nav { display: flex; justify-content: space-between; gap: 12px; padding-top: 24px; border-top: 1px solid var(--line); }
        .opt-row { display: grid; grid-template-columns: auto 1fr 160px; gap: 16px; align-items: center; padding: 14px 0; border-top: 1px solid var(--line); }
        .opt-row:last-child { border-bottom: 1px solid var(--line); }
        .opt-row .meta { display: grid; }
        .opt-row .meta small { color: var(--moss); }
        .check { width: 26px; height: 26px; accent-color: var(--pine); }
        .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .person-card { display: grid; grid-template-columns: 1fr 1.3fr 110px auto; gap: 12px; align-items: end; padding: 16px 0; border-top: 1px solid var(--line); }
        .person-card.g { grid-template-columns: 1fr 1.3fr 1fr; }
        .icon-btn { width: 44px; height: 48px; border: 1.5px solid var(--line); background: none; border-radius: 10px; cursor: pointer; color: var(--moss); display: grid; place-items: center; }
        .seg { display: flex; gap: 6px; flex-wrap: wrap; }
        .seg button { border: 1.5px solid var(--line); background: none; border-radius: 999px; padding: 9px 18px; cursor: pointer; font-weight: 520; }
        .seg button.on { background: var(--pine); color: var(--paper); border-color: var(--pine); }
        .rule-q { display: grid; gap: 10px; padding: 18px 0; border-top: 1px solid var(--line); }
        .rule-q > span { font-weight: 560; }
        .warn-line { color: var(--alert); font-size: .92rem; }
        .ok-line { color: #2f7d47; font-size: .92rem; }
        .day-field { display: flex; align-items: center; gap: 8px; }
        .day-field .input { width: 96px; }
        .rhythm-note { margin: 0; color: var(--moss); font-size: .92rem; }
        .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .summary > div { background: var(--lichen); border-radius: 18px; padding: 22px; display: grid; gap: 12px; align-content: start; }
        .summary h3 { font-size: 1.2rem; }
        .cost { display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
        @media (max-width: 900px) {
          .wiz { grid-template-columns: 1fr; }
          .wiz-rail { position: static; }
          .wiz-rail ol { display: flex; overflow-x: auto; }
          .wiz-rail button { white-space: nowrap; }
          .wiz-art { display: none; }
          .wiz-panel { padding: 24px; }
          .person-card, .person-card.g, .two, .summary { grid-template-columns: 1fr; }
          .opt-row { grid-template-columns: auto 1fr; }
          .opt-row .input { grid-column: 1 / -1; }
        }
      ` }} />
    </div>
  );
}

type SP = { d: Draft; setD: React.Dispatch<React.SetStateAction<Draft>> };

function StepAssets({ d, setD }: SP) {
  return (
    <>
      <h2>What goes in the gate?</h2>
      <p className="muted">These move from your wallet into the gate&apos;s own wallet. You can add or withdraw later while you are checking in.</p>
      <div>
        {d.assets.map((a, n) => (
          <div className="opt-row" key={a.sym}>
            <input type="checkbox" className="check" checked={a.on} aria-label={`Include ${a.sym}`}
              onChange={e => setD(x => ({ ...x, assets: x.assets.map((y, m) => (m === n ? { ...y, on: e.target.checked } : y)) }))} />
            <div className="meta"><b>{a.sym}</b><small>In your wallet: {fmt(a.bal)}</small></div>
            <input className="input" type="number" min={0} max={a.bal} step="any" value={a.amount} disabled={!a.on} aria-label={`${a.sym} amount`}
              onChange={e => setD(x => ({ ...x, assets: x.assets.map((y, m) => (m === n ? { ...y, amount: Math.min(y.bal, Number(e.target.value)) } : y)) }))} />
          </div>
        ))}
      </div>
    </>
  );
}

function StepHeirs({ d, setD, total }: SP & { total: number }) {
  const upd = (n: number, p: Partial<Heir>) => setD(x => ({ ...x, heirs: x.heirs.map((h, m) => (m === n ? { ...h, ...p } : h)) }));
  return (
    <>
      <h2>Who inherits, and how much?</h2>
      <p className="muted">Each heir receives their percentage of every asset in the gate.</p>
      <ShareBar heirs={d.heirs} />
      <div>
        {d.heirs.map((h, n) => (
          <div className="person-card" key={n}>
            <div className="field"><label htmlFor={`hn${n}`}>Name</label><input id={`hn${n}`} className="input" value={h.name} onChange={e => upd(n, { name: e.target.value })} /></div>
            <div className="field"><label htmlFor={`ha${n}`}>Wallet or email</label><input id={`ha${n}`} className="input" value={h.addr} onChange={e => upd(n, { addr: e.target.value })} /></div>
            <div className="field"><label htmlFor={`hs${n}`}>Share %</label><input id={`hs${n}`} className="input" type="number" min={1} max={100} value={h.bps / 100} onChange={e => upd(n, { bps: Math.round(Number(e.target.value) * 100) })} /></div>
            <button className="icon-btn" aria-label={`Remove ${h.name || 'heir'}`} disabled={d.heirs.length < 2} onClick={() => setD(x => ({ ...x, heirs: x.heirs.filter((_, m) => m !== n) }))}>
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn sm ghost" disabled={d.heirs.length >= 4} onClick={() => setD(x => ({ ...x, heirs: [...x.heirs, { name: '', addr: '', bps: 0, claimed: false }] }))}>Add an heir</button>
        {total === 10000 ? <span className="ok-line">Shares add up to 100%.</span> : <span className="warn-line">Shares add up to {total / 100}%. Make them total 100% to continue.</span>}
      </div>
      <p className="small muted">An email works if your heir has no wallet yet. Their claim page will help them create one.</p>
    </>
  );
}

function StepGuardians({ d, setD }: SP) {
  const upd = (n: number, p: Partial<Draft['guardians'][0]>) => setD(x => ({ ...x, guardians: x.guardians.map((g, m) => (m === n ? { ...g, ...p } : g)) }));
  return (
    <>
      <h2>Who are your three guardians?</h2>
      <p className="muted">Guardians cannot take anything. They can only approve the release to your heirs, and only after you have missed your check-ins.</p>
      <div>
        {d.guardians.map((g, n) => (
          <div className="person-card g" key={n}>
            <div className="field"><label htmlFor={`gn${n}`}>Guardian {n + 1}</label><input id={`gn${n}`} className="input" value={g.name} onChange={e => upd(n, { name: e.target.value })} /></div>
            <div className="field"><label htmlFor={`ga${n}`}>Wallet or email</label><input id={`ga${n}`} className="input" value={g.addr} onChange={e => upd(n, { addr: e.target.value })} /></div>
            <div className="field"><label htmlFor={`gr${n}`}>Who they are to you</label><input id={`gr${n}`} className="input" value={g.note} onChange={e => upd(n, { note: e.target.value })} /></div>
          </div>
        ))}
      </div>
      <div className="rule-q">
        <span>How many must approve?</span>
        <div className="seg">{[1, 2, 3].map(q => <button key={q} className={d.quorum === q ? 'on' : ''} onClick={() => setD(x => ({ ...x, quorum: q }))}>{q} of 3{q === 2 ? ' (recommended)' : ''}</button>)}</div>
      </div>
    </>
  );
}

function StepRule({ d, setD }: SP) {
  const earliest = earliestDays(d.intervalDays, d.missesAllowed, d.waitDays);
  const check = CHECK_INS.find(r => r.days === d.intervalDays);
  const wait = WAITS.find(r => r.days === d.waitDays);
  return (
    <>
      <h2>When should the gate open?</h2>
      <p className="muted">Pick a rhythm, or type a number of days. A month is the one we recommend. Anything you type is the rule.</p>
      <div className="rule-q">
        <span>How often do you check in?</span>
        <div className="seg" role="group" aria-label="Check-in rhythm">
          {CHECK_INS.map(r => (
            <button key={r.days} className={d.intervalDays === r.days ? 'on' : ''} onClick={() => setD(x => ({ ...x, intervalDays: r.days }))}>{r.label}</button>
          ))}
        </div>
        <label className="day-field">Or every <input className="input" type="number" min={1} max={3650} aria-label="Check-in interval in days" value={d.intervalDays} onChange={e => setD(x => ({ ...x, intervalDays: clampDays(Number(e.target.value)) }))} /> days</label>
        <p className="rhythm-note">{check ? check.note : `A custom rhythm: every ${spell(d.intervalDays)}.`}</p>
      </div>
      <div className="rule-q">
        <span>How many can you miss in a row?</span>
        <div className="seg" role="group" aria-label="Missed check-ins allowed">
          {MISS_CHOICES.map(v => (
            <button key={v} className={d.missesAllowed === v ? 'on' : ''} onClick={() => setD(x => ({ ...x, missesAllowed: v }))}>{v}{v === 3 ? ' (recommended)' : ''}</button>
          ))}
        </div>
        <label className="day-field">Or <input className="input" type="number" min={1} max={15} aria-label="Missed check-ins allowed" value={d.missesAllowed} onChange={e => setD(x => ({ ...x, missesAllowed: clampMisses(Number(e.target.value)) }))} /> missed, from 1 to 15</label>
      </div>
      <div className="rule-q">
        <span>After the alert, how long can you still cancel?</span>
        <div className="seg" role="group" aria-label="Waiting period">
          {WAITS.map(r => (
            <button key={r.days} className={d.waitDays === r.days ? 'on' : ''} onClick={() => setD(x => ({ ...x, waitDays: r.days }))}>{r.label}</button>
          ))}
        </div>
        <label className="day-field">Or <input className="input" type="number" min={1} max={3650} aria-label="Waiting period in days" value={d.waitDays} onChange={e => setD(x => ({ ...x, waitDays: clampDays(Number(e.target.value)) }))} /> days</label>
        <p className="rhythm-note">{wait ? wait.note : `A custom wait of ${spell(d.waitDays)}.`}</p>
      </div>
      <p className={earliest < 30 ? 'warn-line' : 'ok-line'}>The earliest your heirs could claim is {spell(earliest)} after your last check-in.{earliest < 30 ? ' That is quick. Fine for trying it. For a real gate, give yourself a few months.' : ''}</p>
    </>
  );
}

function StepReview({ d }: { d: Draft }) {
  return (
    <>
      <h2>Read your rule once more</h2>
      <p className="muted">After you sign, this rule is taped out. You can change it while you are checking in. Once an alert starts, it stays as written until you check in and cancel it. Nobody else can change it, including us.</p>
      <div className="summary">
        <div><h3>The rule</h3><RulePlain v={{ ...d, guardians: d.guardians.map(g => ({ ...g, approved: false })) }} /></div>
        <div>
          <h3>What happens when you sign</h3>
          <div className="cost"><span>Assets moved to the gate</span><span>{d.assets.filter(a => a.on).map(a => `${fmt(a.amount)} ${a.sym}`).join(', ')}</span></div>
          <div className="cost"><span>Setup, onchain costs included</span><span>$49</span></div>
          <div className="cost"><span>Keeper plan, first year</span><span>$79</span></div>
          <p className="small muted">You sign twice in your wallet: once to create the gate, once to move your assets in.</p>
        </div>
      </div>
    </>
  );
}

const making = [
  'Publishing your rule',
  'Opening the gate’s own wallet',
  'Moving your assets into the gate',
  'Publishing your heirs’ page',
  'Sending your guardians a TapeSend welcome',
];

function Creating({ d, phase, setPhase }: { d: Draft; phase: 'creating' | 'done'; setPhase: (p: 'done') => void }) {
  const [k, setK] = useState(0);
  const { replace } = useVault();
  useEffect(() => {
    if (phase !== 'creating') return;
    if (k >= making.length) {
      const base = demoVault();
      replace({
        ...base, day: 0, lastCheckIn: 0, assets: d.assets.filter(a => a.on).map(a => ({ sym: a.sym, amount: a.amount, color: a.color })),
        heirs: d.heirs, guardians: d.guardians.map(g => ({ ...g, approved: false })), quorum: d.quorum,
        intervalDays: d.intervalDays, missesAllowed: d.missesAllowed, waitDays: d.waitDays,
      });
      setPhase('done'); return;
    }
    const t = setTimeout(() => setK(x => x + 1), 900);
    return () => clearTimeout(t);
  }, [k, phase, d, replace, setPhase]);

  return (
    <div className="make">
      <MiniGate state={phase === 'done' ? 0 : 0} progress={Math.min(1, k / making.length)} size={220} />
      {phase === 'creating' ? <h1>Building your gate</h1> : <h1>Your gate is live.</h1>}
      <ol className="make-list">
        {making.map((m, n) => (
          <li key={m} className={n < k ? 'done' : n === k ? 'now' : ''}>
            <span className="mk">{n < k ? <Tick /> : n === k ? <span className="spin" /> : null}</span>{m}
          </li>
        ))}
      </ol>
      {phase === 'done' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="make-done">
          <p>Your rule is published. Your heirs&apos; page is at <b>tape://2.311.9/ada</b>.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="#gate" className="btn">Go to your gate</a>
            <a href="#public" className="btn ghost">See the public page</a>
          </div>
        </motion.div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .make { background: var(--paper); border: 1px solid var(--line); border-radius: 260px 260px 32px 32px; padding: 64px 32px 48px; display: grid; justify-items: center; gap: 22px; text-align: center; max-width: 720px; margin: 0 auto; }
        .make h1 { font-size: 2.4rem; }
        .make-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; text-align: left; }
        .make-list li { display: flex; align-items: center; gap: 12px; color: var(--moss-soft); transition: color .3s; }
        .make-list li.now { color: var(--ink); font-weight: 560; }
        .make-list li.done { color: var(--pine); }
        .mk { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); flex: none; }
        .make-list li.done .mk { background: var(--marigold); border-color: var(--marigold); }
        .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--pine); border-right-color: transparent; animation: sp .8s linear infinite; }
        @keyframes sp { to { transform: rotate(360deg); } }
        .make-done { display: grid; gap: 18px; justify-items: center; }
      ` }} />
    </div>
  );
}

function Tick() {
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 7.5l2.6 2.6L11 4.5" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
