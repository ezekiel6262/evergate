'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatUnits, parseUnits, type Address } from 'viem';
import { AppShell } from '@/components/AppShell';
import { MiniGate } from '@/components/MiniGate';
import { RulePlain, ShareBar } from '@/components/VaultBits';
import { CHECK_INS, clampDays, clampMisses, earliestDays, MISS_CHOICES, spell, WAITS } from '@/lib/cadence';
import { asAddress, BEM_UNIT_LIMIT, bemToken, circuitsAbi, erc20Abi, explain, FACTORY, factoryAbi, publicClient, shortAddr, transistorsAbi, USDT0 } from '@/lib/chain';
import { walletBalances } from '@/lib/gates';
import { PublishDraft, PublishStep, publishGate, sharedRuleParts } from '@/lib/publish';
import { fmt, Heir, useVault } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

const STEPS = ['Assets', 'Heirs', 'Guardians', 'Rule', 'Review'];

type AssetDraft = {
  sym: string;
  token: Address | null;
  decimals: number;
  balance: bigint;
  on: boolean;
  amount: string;
  color: string;
};

type Draft = {
  assets: AssetDraft[];
  heirs: { addr: string; bps: number }[];
  guardians: string[];
  quorum: number;
  intervalDays: number;
  missesAllowed: number;
  waitDays: number;
  processor: string;
  keeper: string;
  templateId: string;
  circuitId: string;
};

const blank = (): Draft => ({
  assets: [],
  heirs: [{ addr: '', bps: 0 }, { addr: '', bps: 0 }],
  guardians: ['', '', ''],
  quorum: 2,
  intervalDays: 30,
  missesAllowed: 3,
  waitDays: 30,
  processor: '',
  keeper: '',
  templateId: '',
  circuitId: '',
});

function distinct(values: string[]) {
  const seen = new Set(values.map(v => v.toLowerCase()));
  return seen.size === values.length;
}

function publishPlan(d: Draft) {
  const processorSet = !!asAddress(d.processor);
  const keeperSet = !!asAddress(d.keeper);
  const circuitSet = /^\d+$/.test(d.circuitId) && d.circuitId !== '0';
  const templateSet = /^\d+$/.test(d.templateId) && d.templateId !== '0';
  const willCreate = !processorSet && !keeperSet && !circuitSet && !templateSet;
  const needsPasted = !processorSet && !keeperSet && (circuitSet || templateSet);
  const tapes = circuitSet ? 0 : templateSet ? 1 : 2;
  const needsParts = !circuitSet && !templateSet && sharedRuleParts().calls > 0;
  return { willCreate, needsPasted, tapes, needsParts, reviewOk: !needsPasted, processorSet, keeperSet };
}

async function reviewCosts(processor: string) {
  const token = await bemToken();
  const decimals = Number(await publicClient.readContract({
    address: token, abi: erc20Abi, functionName: 'decimals',
  }).catch(() => 8));
  const deploy = await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'deployFee' });
  const create = `${formatUnits(deploy, decimals)} BEM`;
  try {
    const { calls, units } = sharedRuleParts();
    const cpu = asAddress(processor);
    let protocol: bigint;
    let price: bigint;
    let inBem = true;
    if (cpu) {
      const transistors = await publicClient.readContract({ address: cpu, abi: circuitsAbi, functionName: 'transistors' });
      [protocol, price] = await Promise.all([
        publicClient.readContract({ address: transistors, abi: transistorsAbi, functionName: 'protocolFee' }),
        publicClient.readContract({ address: transistors, abi: transistorsAbi, functionName: 'mintPrice' }),
      ]);
      inBem = protocol < BEM_UNIT_LIMIT && price < BEM_UNIT_LIMIT;
    } else {
      protocol = await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'protocolFee' });
      price = 0n;
    }
    const total = protocol * BigInt(calls) + price * units;
    return { create, parts: inBem ? `${formatUnits(total, decimals)} BEM` : `${formatUnits(total, 18)} OKB` };
  } catch {
    return { create, parts: 'Charged by that processor' };
  }
}

export function SetupView() {
  return <AppShell><Wizard /></AppShell>;
}

function Wizard() {
  const { account, wallet, connect, connecting } = useWallet();
  const { keeper, templateId, remember, refresh } = useVault();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<Draft>(blank);
  const [phase, setPhase] = useState<'edit' | 'creating' | 'done'>('edit');
  const [formError, setFormError] = useState('');
  const total = d.heirs.reduce((s, h) => s + h.bps, 0);
  const heirsOk = d.heirs.length >= 1 && d.heirs.length <= 8
    && d.heirs.every(h => asAddress(h.addr) && h.bps > 0)
    && total === 10000
    && distinct(d.heirs.map(h => h.addr));
  const guardsOk = d.guardians.every(g => asAddress(g)) && distinct(d.guardians);
  const plan = publishPlan(d);
  const valid = [true, heirsOk, guardsOk, true, plan.reviewOk][i];

  useEffect(() => {
    setD(x => ({
      ...x,
      keeper: keeper || x.keeper,
      templateId: templateId ? templateId.toString() : x.templateId,
    }));
  }, [keeper, templateId]);

  useEffect(() => {
    if (!account) return;
    let stop = false;
    walletBalances(account).then(b => {
      if (stop) return;
      setD(x => ({
        ...x,
        assets: [
          { sym: 'OKB', token: null, decimals: 18, balance: b.okb, on: false, amount: '', color: '#173d31' },
          { sym: 'USDT0', token: USDT0, decimals: b.usdtDecimals, balance: b.usdt, on: false, amount: '', color: '#5d7c58' },
        ],
      }));
    }).catch(() => {});
    return () => { stop = true; };
  }, [account]);

  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n); };

  const start = () => {
    if (!account || !wallet) { void connect(); return; }
    setFormError('');
    setPhase('creating');
  };

  if (phase !== 'edit') {
    return <Creating d={d} wallet={wallet} account={account} onDone={result => { remember(result.keeper, result.templateId); void refresh(); }} onFail={msg => { setFormError(msg); setPhase('edit'); }} phase={phase} setPhase={setPhase} />;
  }

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
            {i === 0 && <StepAssets d={d} setD={setD} account={account} connect={connect} connecting={connecting} />}
            {i === 1 && <StepHeirs d={d} setD={setD} total={total} />}
            {i === 2 && <StepGuardians d={d} setD={setD} />}
            {i === 3 && <StepRule d={d} setD={setD} />}
            {i === 4 && <StepReview d={d} setD={setD} />}
          </motion.div>
        </AnimatePresence>
        {formError && <p className="warn-line">{formError}</p>}
        <div className="wiz-nav">
          {i > 0 ? <button className="btn ghost" onClick={() => go(i - 1)}>Back</button> : <a className="btn ghost" href="#gate">Cancel</a>}
          {i < 4
            ? <button className="btn" disabled={!valid} onClick={() => go(i + 1)}>Continue to {STEPS[i + 1].toLowerCase()}</button>
            : <button className="btn sun" disabled={!valid} onClick={start}>{account ? 'Create my gate' : connecting ? 'Connecting…' : 'Connect wallet'}</button>}
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
        .person-card { display: grid; grid-template-columns: 1fr 140px auto; gap: 12px; align-items: end; padding: 16px 0; border-top: 1px solid var(--line); }
        .person-card.g { grid-template-columns: 1fr; }
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
        .cost { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
        .chain-fields { display: grid; gap: 12px; }
        @media (max-width: 900px) {
          .wiz { grid-template-columns: 1fr; }
          .wiz-rail { position: static; }
          .wiz-rail ol { display: flex; flex-wrap: wrap; gap: 6px; }
          .wiz-rail button { white-space: nowrap; padding: 8px 10px; }
          .wiz-nav { flex-wrap: wrap; }
          .wiz-nav .btn { text-align: center; }
          .wiz-art { display: none; }
          .wiz-panel { padding: 24px; }
          .person-card { grid-template-columns: 1fr auto; }
          .person-card .field:first-child { grid-column: 1 / -1; }
          .person-card.g { grid-template-columns: 1fr; }
          .summary { grid-template-columns: 1fr; }
          .opt-row { grid-template-columns: auto 1fr; }
          .opt-row .input { grid-column: 1 / -1; }
        }
      ` }} />
    </div>
  );
}

type SP = { d: Draft; setD: React.Dispatch<React.SetStateAction<Draft>> };

function StepAssets({ d, setD, account, connect, connecting }: SP & { account: string | null; connect: () => void; connecting: boolean }) {
  return (
    <>
      <h2>What goes in the gate?</h2>
      <p className="muted">These move from your wallet into the gate&apos;s own wallet after it opens. You can send more later, and withdraw while you are checking in.</p>
      {!account && <button className="btn" onClick={connect} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect wallet to see balances'}</button>}
      {account && d.assets.length === 0 && <p>Reading your X Layer balances…</p>}
      <div>
        {d.assets.map((a, n) => (
          <div className="opt-row" key={a.sym}>
            <input type="checkbox" className="check" checked={a.on} aria-label={`Include ${a.sym}`}
              onChange={e => setD(x => ({ ...x, assets: x.assets.map((y, m) => (m === n ? { ...y, on: e.target.checked } : y)) }))} />
            <div className="meta"><b>{a.sym}</b><small>In your wallet: {fmt(Number(formatUnits(a.balance, a.decimals)))}</small></div>
            <input className="input" inputMode="decimal" placeholder="0" value={a.amount} disabled={!a.on} aria-label={`${a.sym} amount`}
              onChange={e => setD(x => ({ ...x, assets: x.assets.map((y, m) => (m === n ? { ...y, amount: e.target.value } : y)) }))} />
          </div>
        ))}
      </div>
    </>
  );
}

function StepHeirs({ d, setD, total }: SP & { total: number }) {
  const upd = (n: number, p: Partial<Draft['heirs'][0]>) => setD(x => ({ ...x, heirs: x.heirs.map((h, m) => (m === n ? { ...h, ...p } : h)) }));
  return (
    <>
      <h2>Who inherits, and how much?</h2>
      <p className="muted">Each heir receives their percentage of every asset in the gate. Use the wallet address they control.</p>
      <ShareBar heirs={d.heirs.map(h => ({ name: h.addr ? shortAddr(h.addr) : 'Heir', addr: h.addr, bps: h.bps, claimed: false }))} />
      <div>
        {d.heirs.map((h, n) => (
          <div className="person-card" key={n}>
            <div className="field"><label htmlFor={`ha${n}`}>Wallet address</label><input id={`ha${n}`} className="input" value={h.addr} placeholder="0x" onChange={e => upd(n, { addr: e.target.value.trim() })} /></div>
            <div className="field"><label htmlFor={`hs${n}`}>Share %</label><input id={`hs${n}`} className="input" type="number" min={1} max={100} value={h.bps ? h.bps / 100 : ''} onChange={e => upd(n, { bps: Math.round(Number(e.target.value) * 100) })} /></div>
            <button className="icon-btn" aria-label="Remove heir" disabled={d.heirs.length < 2} onClick={() => setD(x => ({ ...x, heirs: x.heirs.filter((_, m) => m !== n) }))}>
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn sm ghost" disabled={d.heirs.length >= 8} onClick={() => setD(x => ({ ...x, heirs: [...x.heirs, { addr: '', bps: 0 }] }))}>Add an heir</button>
        {total === 10000 && heirsReady(d) ? <span className="ok-line">Shares add up to 100%.</span> : <span className="warn-line">Shares add up to {total / 100}%. Use wallet addresses and make them total 100%.</span>}
      </div>
    </>
  );
}

function heirsReady(d: Draft) {
  return d.heirs.every(h => asAddress(h.addr));
}

function StepGuardians({ d, setD }: SP) {
  return (
    <>
      <h2>Who are your three guardians?</h2>
      <p className="muted">Guardians cannot take anything. They can only approve the release to your heirs, and only after you have missed your check-ins. Each one is a wallet address.</p>
      <div>
        {d.guardians.map((g, n) => (
          <div className="person-card g" key={n}>
            <div className="field"><label htmlFor={`ga${n}`}>Guardian {n + 1}</label><input id={`ga${n}`} className="input" value={g} placeholder="0x" onChange={e => setD(x => ({ ...x, guardians: x.guardians.map((y, m) => m === n ? e.target.value.trim() : y) }))} /></div>
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
      <p className={earliest < 30 ? 'warn-line' : 'ok-line'}>The earliest your heirs could claim is {spell(earliest)} after your last check-in.{earliest < 30 ? ' That is quick. For a gate you mean to keep, give yourself a few months.' : ''}</p>
    </>
  );
}

function previewHeirs(d: Draft): Heir[] {
  return d.heirs.map(h => ({ name: h.addr ? shortAddr(h.addr) : 'Heir', addr: h.addr, bps: h.bps, claimed: false }));
}

function StepReview({ d, setD }: SP) {
  const plan = publishPlan(d);
  const [fees, setFees] = useState<{ create: string; parts: string } | null>(null);
  useEffect(() => {
    if (!plan.willCreate && !plan.needsParts) return;
    let stop = false;
    reviewCosts(d.processor).then(next => { if (!stop) setFees(next); }).catch(() => {
      if (!stop) setFees({ create: '0.1 BEM', parts: '0.02 BEM' });
    });
    return () => { stop = true; };
  }, [plan.willCreate, plan.needsParts, d.processor]);
  return (
    <>
      <h2>Read your rule once more</h2>
      <p className="muted">After you sign, this rule is taped out. You can change it while you are checking in. Once an alert starts, it stays as written until you check in and cancel it. Nobody else can change it, including us.</p>
      <div className="summary">
        <div><h3>The rule</h3><RulePlain v={{ ...d, guardians: d.guardians.map(addr => ({ name: shortAddr(addr), addr, approved: false })), heirs: previewHeirs(d) }} /></div>
        <div>
          <h3>What you will sign</h3>
          {plan.willCreate && <div className="cost"><span>Create the processor</span><span>{fees?.create ?? '…'}</span></div>}
          {plan.needsParts && <div className="cost"><span>Parts for the rule</span><span>{fees?.parts ?? '…'}</span></div>}
          <div className="cost"><span>Publish the rule</span><span>{plan.tapes === 0 ? 'Already published' : `${plan.tapes} × 0.0013 OKB`}</span></div>
          <div className="cost"><span>Open the gate wallet</span><span>0.08 OKB</span></div>
          <div className="cost"><span>Assets sent in</span><span>{d.assets.filter(a => a.on && a.amount).map(a => `${a.amount} ${a.sym}`).join(', ') || 'None yet'}</span></div>
          <p className="small muted">Each signature is a real transaction on X Layer. Closing the wallet stops the rest.</p>
        </div>
      </div>
      <div className="chain-fields">
        <div className="field"><label htmlFor="processor">Processor address, if you already have one</label><input id="processor" className="input" placeholder={plan.willCreate ? 'Leave blank to create one' : '0x'} value={d.processor} onChange={e => setD(x => ({ ...x, processor: e.target.value.trim() }))} /></div>
        {plan.willCreate && <p className="small muted">Leave this blank and a processor is created for you.</p>}
        {plan.needsPasted && <p className="warn-line">That rule number belongs to a processor. Enter its address.</p>}
        {!plan.willCreate && !plan.needsPasted && !plan.processorSet && plan.keeperSet && <p className="small muted">Blank keeps the processor on your Evergate contract.</p>}
        <div className="field"><label htmlFor="keeper">Evergate contract, if you already published one</label><input id="keeper" className="input" placeholder="Leave blank to publish it" value={d.keeper} onChange={e => setD(x => ({ ...x, keeper: e.target.value.trim() }))} /></div>
        <div className="field"><label htmlFor="template">Shared rule number, if this processor already has one</label><input id="template" className="input" inputMode="numeric" value={d.templateId} onChange={e => setD(x => ({ ...x, templateId: e.target.value.trim() }))} /></div>
        <div className="field"><label htmlFor="circuit">Your rule number, if you already taped this gate</label><input id="circuit" className="input" inputMode="numeric" value={d.circuitId} onChange={e => setD(x => ({ ...x, circuitId: e.target.value.trim() }))} /></div>
      </div>
    </>
  );
}

function toPublish(d: Draft): PublishDraft {
  const guardians = d.guardians.map(asAddress);
  if (guardians.some(g => !g) || guardians.length !== 3) throw new Error('Enter three guardian wallets.');
  const heirs = d.heirs.map(h => {
    const account = asAddress(h.addr);
    if (!account || h.bps <= 0) throw new Error('Enter each heir as a wallet address and a share.');
    return { account, bps: h.bps };
  });
  const sends = d.assets.filter(a => a.on).map(a => {
    let amount = 0n;
    if (a.amount.trim()) {
      try { amount = parseUnits(a.amount.trim(), a.decimals); }
      catch { throw new Error(`The ${a.sym} amount is not a number.`); }
    }
    if (amount > a.balance) throw new Error(`The ${a.sym} amount is more than your wallet holds.`);
    return { token: a.token, amount, sym: a.sym };
  }).filter(s => s.amount > 0n);
  const tokens = d.assets.filter(a => a.on && a.token).map(a => a.token) as Address[];
  const processor = asAddress(d.processor);
  const keeper = asAddress(d.keeper);
  const templateId = /^\d+$/.test(d.templateId) && d.templateId !== '0' ? BigInt(d.templateId) : null;
  const circuitId = /^\d+$/.test(d.circuitId) && d.circuitId !== '0' ? BigInt(d.circuitId) : null;
  if (!processor && !keeper && (templateId || circuitId)) throw new Error('Enter the processor that already holds this rule.');
  return {
    processor,
    keeper,
    templateId,
    circuitId,
    guardians: guardians as [Address, Address, Address],
    heirs,
    quorum: d.quorum,
    intervalDays: d.intervalDays,
    missesAllowed: d.missesAllowed,
    waitDays: d.waitDays,
    sends,
    tokens,
  };
}

function Creating({ d, wallet, account, onDone, onFail, phase, setPhase }: {
  d: Draft;
  wallet: ReturnType<typeof useWallet>['wallet'];
  account: Address | null;
  onDone: (result: { keeper: Address; templateId: bigint | null }) => void;
  onFail: (msg: string) => void;
  phase: 'creating' | 'done';
  setPhase: (p: 'done') => void;
}) {
  const [steps, setSteps] = useState<PublishStep[]>([]);
  const [result, setResult] = useState<{ wallet: Address; vaultId: bigint } | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (phase !== 'creating' || ran.current) return;
    ran.current = true;
    if (!wallet || !account) { onFail('Connect your wallet.'); return; }
    let draft: PublishDraft;
    try { draft = toPublish(d); }
    catch (e) { onFail(explain(e)); return; }
    publishGate(wallet, account, draft, setSteps).then(r => {
      onDone(r);
      setResult({ wallet: r.wallet, vaultId: r.vaultId });
      setPhase('done');
    }).catch(e => onFail(explain(e)));
  }, [phase, wallet, account, d, onDone, onFail, setPhase]);

  return (
    <div className="make">
      <MiniGate state={0} progress={steps.length ? steps.filter(s => s.status === 'done').length / steps.length : 0.05} size={220} />
      {phase === 'creating' ? <h1>Building your gate</h1> : <h1>Your gate is live.</h1>}
      <ol className="make-list">
        {steps.map(s => (
          <li key={s.label} className={s.status === 'done' ? 'done' : s.status === 'active' ? 'now' : ''}>
            <span className="mk">{s.status === 'done' ? <Tick /> : s.status === 'active' ? <span className="spin" /> : null}</span>{s.label}
          </li>
        ))}
      </ol>
      {phase === 'done' && result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="make-done">
          <p>Gate {result.vaultId.toString()} is open. Its wallet is <b>{result.wallet}</b>.</p>
          <a href="#gate" className="btn">Go to your gate</a>
        </motion.div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .make { background: var(--paper); border: 1px solid var(--line); border-radius: 260px 260px 32px 32px; padding: 64px 32px 48px; display: grid; justify-items: center; gap: 22px; text-align: center; max-width: 720px; margin: 0 auto; }
        .make h1 { font-size: 2.4rem; }
        .make-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; text-align: left; }
        .make-list li { display: flex; align-items: center; gap: 12px; color: var(--moss-soft); }
        .make-list li.now { color: var(--ink); font-weight: 560; }
        .make-list li.done { color: var(--pine); }
        .mk { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); flex: none; }
        .make-list li.done .mk { background: var(--marigold); border-color: var(--marigold); }
        .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--pine); border-right-color: transparent; animation: sp .8s linear infinite; }
        @keyframes sp { to { transform: rotate(360deg); } }
        .make-done { display: grid; gap: 18px; justify-items: center; }
        .make-done p { max-width: 36em; word-break: break-all; }
      ` }} />
    </div>
  );
}

function Tick() {
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 7.5l2.6 2.6L11 4.5" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
