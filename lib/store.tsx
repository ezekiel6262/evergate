'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { checkInPhrase, waitPhrase } from './cadence';
import { GateState, step, StepInputs } from './circuit';
import { noticesOnStep } from './notices';

export type Person = { name: string; addr: string; note?: string };
export type Heir = Person & { bps: number; claimed: boolean };
export type Guardian = Person & { approved: boolean };
export type Asset = { sym: string; amount: number; color: string };
export type LogItem = { day: number; text: string; kind: 'check' | 'alert' | 'approve' | 'claim' | 'setup' | 'cancel' };

export type Vault = {
  id: string;
  owner: string;
  circuitId: string;
  wallet: string;
  page: string;
  assets: Asset[];
  heirs: Heir[];
  guardians: Guardian[];
  intervalDays: number;
  missesAllowed: number;
  quorum: number;
  waitDays: number;
  day: number;
  lastCheckIn: number;
  alertDay: number | null;
  state: GateState;
  log: LogItem[];
};

export const demoVault = (): Vault => ({
  id: 'ada',
  owner: 'Ada',
  circuitId: '2.311.9',
  wallet: '0x7a3f9e21c08d4b55e1a90f6c2d3b8e4fa1c2c41e',
  page: 'tape://2.311.9/ada',
  assets: [
    { sym: 'USDT0', amount: 12500, color: '#5d7c58' },
    { sym: 'OKB', amount: 42, color: '#173d31' },
  ],
  heirs: [
    { name: 'Theo', addr: '0x41c2…9a0e', bps: 6000, claimed: false, note: 'Son' },
    { name: 'June', addr: '0x93be…17d4', bps: 4000, claimed: false, note: 'Daughter' },
  ],
  guardians: [
    { name: 'Sam Ortiz', addr: '0x2d71…c3a8', approved: false, note: 'Brother' },
    { name: 'Priya Nair', addr: '0x8e05…44b1', approved: false, note: 'Lawyer' },
    { name: 'Kemi Adeyemi', addr: '0xa61f…0d29', approved: false, note: 'Old friend' },
  ],
  intervalDays: 30,
  missesAllowed: 3,
  quorum: 2,
  waitDays: 30,
  day: 12,
  lastCheckIn: 0,
  alertDay: null,
  state: 0,
  log: [{ day: 0, text: 'Gate created. Your guardians were sent a welcome.', kind: 'setup' }],
});

const KEY = 'evergate.vault.v2';

export function missedOf(v: Vault) {
  return Math.floor((v.day - v.lastCheckIn) / v.intervalDays);
}

export function inputsOf(v: Vault, ping = false): StepInputs {
  const ap = v.guardians.map(g => g.approved) as [boolean, boolean, boolean];
  return {
    n: v.missesAllowed,
    k: v.quorum,
    missed: missedOf(v),
    ping,
    approvals: ap,
    waitElapsed: v.alertDay !== null && v.day - v.alertDay >= v.waitDays,
    payoutDone: v.heirs.every(h => h.claimed),
  };
}

/** Run the circuit until it settles (what a permissionless poke() does). */
function settle(v: Vault, ping = false): Vault {
  let cur = { ...v };
  for (let i = 0; i < 4; i++) {
    const out = step(cur.state, inputsOf(cur, ping && i === 0));
    if (out.next === cur.state) break;
    const prev = cur.state;
    cur = { ...cur, state: out.next };
    if (out.next === 1) cur.alertDay = cur.day;
    if (out.next === 0 && prev === 1) {
      cur.alertDay = null;
      cur.guardians = cur.guardians.map(g => ({ ...g, approved: false }));
    }
    const mailed = noticesOnStep(prev, out.next, out.alert, {
      owner: cur.owner,
      page: cur.page,
      missesAllowed: cur.missesAllowed,
      checkIn: checkInPhrase(cur.intervalDays),
      wait: waitPhrase(cur.waitDays),
      guardians: cur.guardians.map(g => g.name),
      heirs: cur.heirs.map(h => h.name),
    });
    const seen = new Set<string>();
    for (const note of mailed) {
      if (seen.has(note.kind)) continue;
      seen.add(note.kind);
      cur.log = [{ day: cur.day, text: note.text, kind: note.kind === 'alerted' ? 'alert' : 'approve' }, ...cur.log];
    }
    if (out.next === 3) cur.log = [{ day: cur.day, text: 'Every heir has claimed. Gate handed on.', kind: 'claim' }, ...cur.log];
  }
  return cur;
}

type Ctx = {
  vault: Vault;
  checkIn: () => void;
  advance: (days: number) => void;
  approve: (i: number) => void;
  claim: (i: number) => void;
  reset: () => void;
  replace: (v: Vault) => void;
};

const VaultCtx = createContext<Ctx | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [vault, setVault] = useState<Vault>(demoVault);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setVault(JSON.parse(raw));
    } catch {}
  }, []);

  const save = useCallback((v: Vault) => {
    setVault(v);
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
  }, []);

  const api = useMemo<Ctx>(() => ({
    vault,
    checkIn: () => {
      if (vault.state > 1) return;
      const wasAlert = vault.state === 1;
      const v = settle({ ...vault, lastCheckIn: vault.day }, true);
      v.log = [{ day: v.day, text: wasAlert ? 'You checked in and cancelled the alert.' : 'You checked in.', kind: wasAlert ? 'cancel' : 'check' }, ...v.log];
      save(v);
    },
    advance: days => save(settle({ ...vault, day: vault.day + days })),
    approve: i => {
      if (vault.state !== 1) return;
      const guardians = vault.guardians.map((g, j) => (j === i ? { ...g, approved: true } : g));
      const v = { ...vault, guardians, log: [{ day: vault.day, text: `${vault.guardians[i].name} approved the release.`, kind: 'approve' as const }, ...vault.log] };
      save(settle(v));
    },
    claim: i => {
      if (vault.state !== 2) return;
      const heirs = vault.heirs.map((h, j) => (j === i ? { ...h, claimed: true } : h));
      const v = { ...vault, heirs, log: [{ day: vault.day, text: `${vault.heirs[i].name} claimed ${vault.heirs[i].bps / 100}%.`, kind: 'claim' as const }, ...vault.log] };
      save(settle(v));
    },
    reset: () => save(demoVault()),
    replace: v => save(v),
  }), [vault, save]);

  return <VaultCtx.Provider value={api}>{children}</VaultCtx.Provider>;
}

export function useVault() {
  const c = useContext(VaultCtx);
  if (!c) throw new Error('useVault outside provider');
  return c;
}

export function dayLabel(day: number) {
  const base = Date.UTC(2026, 11, 1);
  const d = new Date(base + day * 864e5);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
