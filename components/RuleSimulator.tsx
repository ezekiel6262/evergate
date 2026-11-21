'use client';
import { useMemo, useState } from 'react';
import { bitGroups, GateState, packInputs, stateCopy, step, StepInputs } from '@/lib/circuit';
import { MiniGate } from './MiniGate';

const guardianNames = ['Guardian 1', 'Guardian 2', 'Guardian 3'];

export function RuleSimulator() {
  const [missed, setMissed] = useState(0);
  const [approvals, setApprovals] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [waitOver, setWaitOver] = useState(false);
  const [paid, setPaid] = useState(false);
  const [flash, setFlash] = useState('');

  const inputs: StepInputs = { n: 3, k: 2, missed, ping: false, approvals, waitElapsed: waitOver, payoutDone: paid };

  const state: GateState = useMemo(() => {
    let s: GateState = 0;
    for (let i = 0; i < 4; i++) s = step(s, inputs).next;
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missed, approvals, waitOver, paid]);

  const checkIn = () => {
    const r = step(state, { ...inputs, ping: true });
    if (state > 1) { setFlash('Too late to check in: the gate is already open for heirs.'); return; }
    setMissed(0); setApprovals([false, false, false]); setWaitOver(false); setPaid(false);
    setFlash(r.next === 0 && state === 1 ? 'Alert cancelled. Back to all good.' : 'Checked in. The count starts again.');
  };

  const bits = packInputs(inputs);
  let off = 0;

  return (
    <div className="sim">
      <div className="sim-ctl">
        <p className="sim-rule">Example rule: if <b>3</b> check-ins are missed, alert the guardians. Release only when <b>2 of 3</b> approve and the <b>1-month</b> wait is over.</p>

        <div className="sim-row">
          <span>Check-ins missed</span>
          <div className="stepper">
            <button aria-label="Fewer missed" onClick={() => setMissed(m => Math.max(0, m - 1))} disabled={state > 1}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
            <output aria-live="polite">{missed}</output>
            <button aria-label="More missed" onClick={() => setMissed(m => Math.min(6, m + 1))} disabled={state > 1}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
          </div>
        </div>

        <div className="sim-row">
          <span>Guardians who approve</span>
          <div className="chips">
            {guardianNames.map((g, i) => (
              <button key={g} className={`chip ${approvals[i] ? 'on' : ''}`} aria-pressed={approvals[i]}
                onClick={() => setApprovals(a => a.map((v, j) => (j === i ? !v : v)) as [boolean, boolean, boolean])}>{g}</button>
            ))}
          </div>
        </div>

        <div className="sim-row">
          <span>1-month wait is over</span>
          <button className={`switch ${waitOver ? 'on' : ''}`} role="switch" aria-checked={waitOver} onClick={() => setWaitOver(w => !w)}><i /></button>
        </div>

        <div className="sim-row">
          <span>Heirs have claimed</span>
          <button className={`switch ${paid ? 'on' : ''}`} role="switch" aria-checked={paid} onClick={() => setPaid(w => !w)}><i /></button>
        </div>

        <button className="btn sun" onClick={checkIn}>Check in as the owner</button>
        <p className="sim-flash" aria-live="polite">{flash}</p>
      </div>

      <div className="sim-out">
        <MiniGate state={state} progress={state === 0 ? 1 - missed / 3 : state === 1 ? 0.15 : 1} size={240} />
        <div className="ladder" role="list" aria-label="Gate states">
          {([0, 1, 2, 3] as GateState[]).map(s => (
            <div key={s} role="listitem" className={`rung ${s === state ? 'on' : ''} ${s < state ? 'past' : ''}`}>
              <span className="rung-dot" />{stateCopy[s].name}
            </div>
          ))}
        </div>
        <p className="sim-plain">{stateCopy[state].plain}</p>
        <div className="bits" aria-label="Input bits sent to the circuit">
          {bitGroups.map(g => {
            const slice = bits.slice(off, off + g.width); off += g.width;
            return (
              <div key={g.label} className="bitg">
                <div className="bitg-cells">{slice.map((b, i) => <span key={i} className={b === '1' ? 'one' : ''}>{b}</span>)}</div>
                <small>{g.label}</small>
              </div>
            );
          })}
        </div>
        <p className="small muted">These are the exact bits the onchain circuit reads. The page recomputes its answer the same way.</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sim { display: grid; grid-template-columns: 1fr 1.05fr; gap: 0; background: var(--paper); border-radius: 28px; overflow: hidden; border: 1px solid var(--line); }
        .sim-ctl { padding: 36px; display: grid; gap: 22px; align-content: start; }
        .sim-rule { font-size: 1.02rem; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
        .sim-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-weight: 520; }
        .stepper { display: flex; align-items: center; border: 1.5px solid var(--line); border-radius: 999px; }
        .stepper button { width: 42px; height: 40px; border: 0; background: none; cursor: pointer; color: var(--pine); display: grid; place-items: center; }
        .stepper button:disabled { opacity: .3; }
        .stepper output { min-width: 28px; text-align: center; font-weight: 650; font-variant-numeric: tabular-nums; }
        .chips { display: flex; gap: 8px; }
        .chip { border: 1.5px solid var(--line); background: none; border-radius: 999px; padding: 7px 14px; cursor: pointer; font-weight: 520; }
        .chip.on { background: var(--pine); border-color: var(--pine); color: var(--paper); }
        .switch { width: 52px; height: 30px; border-radius: 999px; border: 0; background: var(--line); position: relative; cursor: pointer; flex: none; transition: background .2s; }
        .switch i { position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: var(--paper); transition: transform .25s var(--ease); }
        .switch.on { background: var(--pine); }
        .switch.on i { transform: translateX(22px); }
        .sim-flash { min-height: 1.5em; color: var(--moss); font-size: .95rem; }
        .sim-out { background: var(--lichen); padding: 32px; display: grid; justify-items: center; gap: 16px; align-content: start; }
        .ladder { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
        .rung { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-size: .88rem; color: var(--moss); border: 1px solid transparent; transition: all .3s; }
        .rung-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
        .rung.past .rung-dot { background: var(--moss); }
        .rung.on { background: var(--paper); color: var(--ink); border-color: var(--line); font-weight: 600; }
        .rung.on .rung-dot { background: var(--marigold); box-shadow: 0 0 0 4px rgba(239,166,43,.25); }
        .sim-plain { text-align: center; max-width: 28em; min-height: 3em; }
        .bits { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .bitg { display: grid; justify-items: center; gap: 4px; }
        .bitg-cells { display: flex; gap: 2px; }
        .bitg-cells span { width: 20px; height: 26px; display: grid; place-items: center; border-radius: 5px; background: var(--paper); font-family: var(--sans); font-variant-numeric: tabular-nums; font-size: .85rem; color: var(--moss); }
        .bitg-cells span.one { background: var(--pine); color: var(--marigold-soft); }
        .bitg small { font-size: .75rem; color: var(--moss); }
        @media (max-width: 900px) { .sim { grid-template-columns: 1fr; } .sim-ctl { padding: 24px; } }
      ` }} />
    </div>
  );
}
