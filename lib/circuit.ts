// Mirror of the Evergate state circuit (template T-GATE).
// Same inputs, same outputs as step(id, state, inputs) onchain, so the UI
// can recompute any result locally.

export type GateState = 0 | 1 | 2 | 3;
export const STATE = { ACTIVE: 0, ALERT: 1, CLAIMABLE: 2, RELEASED: 3 } as const;

export const stateCopy: Record<GateState, { name: string; plain: string; tone: 'good' | 'warn' | 'heir' | 'alert' }> = {
  0: { name: 'All good', plain: 'You are checking in. Nothing can move without you.', tone: 'good' },
  1: { name: 'Guardians alerted', plain: 'Check-ins were missed. Guardians are alerted and the waiting period is running. You can still cancel.', tone: 'warn' },
  2: { name: 'Ready for heirs', plain: 'Guardians approved and the wait is over. Heirs can claim their shares.', tone: 'heir' },
  3: { name: 'Handed on', plain: 'Every heir has been paid. This gate is closed for good.', tone: 'heir' },
};

export type StepInputs = {
  n: number;            // check-ins allowed to miss (constant, 4 bits)
  k: number;            // guardian quorum out of 3 (constant, 2 bits)
  missed: number;       // missed intervals, clamped 0-15
  ping: boolean;        // owner checked in or cancelled
  approvals: [boolean, boolean, boolean];
  waitElapsed: boolean;
  payoutDone: boolean;
};

export type StepOutputs = { next: GateState; alert: boolean; release: boolean };

export function step(state: GateState, i: StepInputs): StepOutputs {
  const approvals = i.approvals.filter(Boolean).length;
  const missed = Math.min(15, Math.max(0, i.missed));
  switch (state) {
    case 0:
      if (i.ping) return { next: 0, alert: false, release: false };
      if (missed >= i.n) return { next: 1, alert: true, release: false };
      return { next: 0, alert: false, release: false };
    case 1:
      if (i.ping) return { next: 0, alert: false, release: false };
      if (approvals >= i.k && i.waitElapsed) return { next: 2, alert: false, release: true };
      return { next: 1, alert: false, release: false };
    case 2:
      if (i.payoutDone) return { next: 3, alert: false, release: false };
      return { next: 2, alert: false, release: true };
    default:
      return { next: 3, alert: false, release: false };
  }
}

/** Bit-packed input word, LSB first, exactly as passed to step(). */
export function packInputs(i: StepInputs): string[] {
  const bits = (v: number, w: number) => Array.from({ length: w }, (_, b) => ((v >> b) & 1).toString());
  return [
    ...bits(i.n, 4),
    ...bits(i.k, 2),
    ...bits(Math.min(15, i.missed), 4),
    i.ping ? '1' : '0',
    ...i.approvals.map(a => (a ? '1' : '0')),
    i.waitElapsed ? '1' : '0',
    i.payoutDone ? '1' : '0',
  ];
}

export const bitGroups = [
  { label: 'N', width: 4 },
  { label: 'k', width: 2 },
  { label: 'missed', width: 4 },
  { label: 'ping', width: 1 },
  { label: 'guardians', width: 3 },
  { label: 'wait', width: 1 },
  { label: 'paid', width: 1 },
];
