import { GateState, StepInputs } from './circuit';

export type Heir = { name: string; addr: string; bps: number; claimed: boolean; note?: string };
export type Guardian = { name: string; addr: string; approved: boolean; note?: string };
export type Asset = { sym: string; amount: number; raw: bigint; decimals: number; color: string; token: `0x${string}` | null };
export type LogItem = { at: number; text: string; kind: 'check' | 'alert' | 'approve' | 'claim' | 'setup' | 'cancel' };

export type Vault = {
  id: string;
  owner: string;
  ownerAddr: string;
  circuitId: string;
  wallet: string;
  assets: Asset[];
  heirs: Heir[];
  guardians: Guardian[];
  intervalDays: number;
  intervalSeconds: number;
  missesAllowed: number;
  quorum: number;
  waitDays: number;
  waitSeconds: number;
  now: number;
  lastCheckIn: number;
  alertAt: number | null;
  missed: number;
  waitElapsed: boolean;
  state: GateState;
  log: LogItem[];
};

export function missedOf(v: Vault) {
  return v.missed;
}

export function inputsOf(v: Vault, ping = false): StepInputs {
  const ap = [false, false, false] as [boolean, boolean, boolean];
  v.guardians.forEach((g, i) => { if (i < 3) ap[i] = g.approved; });
  return {
    n: v.missesAllowed,
    k: v.quorum,
    missed: v.missed,
    ping,
    approvals: ap,
    waitElapsed: v.waitElapsed,
    payoutDone: v.state === 3,
  };
}

export function whenLabel(unix: number) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function nextCheckIn(v: Vault) {
  return v.lastCheckIn + v.intervalSeconds * (v.missed + 1);
}
