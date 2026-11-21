// TAP-02 netlist builder and one-beat simulator (draft, 2026-10-04).
// Signal 0 is constant 0, signal 1 is constant 1, then the inputs, then each
// element's outputs. The circuit's outputs are the last nOut signals.
// NAND is 7 bytes, LATCH is 4, REF is 31 + 3*nIns. Multi-byte integers are big-endian.
// Bits are packed least-significant-bit first, the same way step() reads them.

import type { GateState, StepInputs, StepOutputs } from './circuit';

export type Element =
  | { op: 'nand'; a: number; b: number }
  | { op: 'latch'; d: number }
  | { op: 'ref'; cpu: string; id: bigint; ins: number[]; nOuts: number };

export interface Netlist {
  nIn: number;
  nOut: number;
  elements: Element[];
}

type CompiledEl =
  | { op: 'nand'; a: number; b: number; out: number }
  | { op: 'latch'; d: number; out: number; st: number }
  | { op: 'ref'; cpu: string; id: bigint; ins: number[]; nOuts: number; out: number; st: number; sub: Compiled };

export interface Compiled {
  nIn: number;
  nOut: number;
  nState: number;
  /** NAND + LATCH, including gates reached through REF. */
  gateCount: number;
  /** Gates this netlist burns at tape-out. REF'd gates are not burned again. */
  topNand: number;
  topLatch: number;
  nSignals: number;
  elements: CompiledEl[];
}

export type Resolve = (cpu: string, id: bigint) => Compiled | undefined;

const MAX_SIGNAL = 0x1000000;
const MAX_DEPTH = 16;

export function normalizeCpu(cpu: string): string {
  const hex = cpu.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error('cpu');
  return '0x' + hex;
}

/** First reason the processor would reject this netlist, ignoring REF targets. */
export function problems(net: Netlist): string | null {
  if (!Number.isInteger(net.nIn) || net.nIn < 0 || net.nIn > 65536) return 'too many pins';
  if (!Number.isInteger(net.nOut) || net.nOut < 1 || net.nOut > 65536) {
    return net.nOut === 0 ? 'no outputs' : 'too many pins';
  }
  let sig = 2 + net.nIn;
  for (const e of net.elements) {
    if (e.op === 'nand') {
      if (e.a >= sig || e.b >= sig || e.a < 0 || e.b < 0) return 'NAND: future signal';
      sig += 1;
    } else if (e.op === 'latch') {
      sig += 1;
    } else if (e.op === 'ref') {
      if (e.ins.length > 255 || e.nOuts > 255 || e.nOuts < 1) return 'REF size';
      for (const i of e.ins) if (i >= sig || i < 0) return 'REF: future signal';
      sig += e.nOuts;
    } else {
      return 'bad opcode';
    }
    if (sig > MAX_SIGNAL) return 'size overflow';
  }
  if (sig < 2 + net.nIn + net.nOut) return 'too few signals for outputs';
  const S = sig;
  sig = 2 + net.nIn;
  for (const e of net.elements) {
    if (e.op === 'latch' && (e.d < 0 || e.d >= S)) return 'LATCH d out of range';
    sig += e.op === 'ref' ? e.nOuts : 1;
  }
  return null;
}

export function encode(net: Netlist): Uint8Array {
  const why = problems(net);
  if (why) throw new Error(why);
  const out: number[] = [];
  const u24 = (v: number) => {
    out.push((v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  };
  for (const e of net.elements) {
    if (e.op === 'nand') {
      out.push(0);
      u24(e.a);
      u24(e.b);
    } else if (e.op === 'latch') {
      out.push(1);
      u24(e.d);
    } else {
      out.push(2);
      const cpu = normalizeCpu(e.cpu);
      for (let i = 0; i < 40; i += 2) out.push(parseInt(cpu.slice(2 + i, 4 + i), 16));
      let id = e.id;
      if (id < 0n || id > 0xffffffffffffffffn) throw new Error('REF size');
      for (let i = 7; i >= 0; i--) out.push(Number((id >> BigInt(i * 8)) & 0xffn));
      out.push(e.ins.length, e.nOuts);
      for (const pin of e.ins) u24(pin);
    }
  }
  return Uint8Array.from(out);
}

export function decode(bytes: Uint8Array, nIn: number, nOut: number): Netlist {
  let p = 0;
  const need = (n: number) => {
    if (p + n > bytes.length) throw new Error('truncated record');
  };
  const u8 = () => {
    need(1);
    return bytes[p++];
  };
  const u24 = () => {
    need(3);
    const v = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2];
    p += 3;
    return v;
  };
  const elements: Element[] = [];
  while (p < bytes.length) {
    const op = u8();
    if (op === 0) {
      elements.push({ op: 'nand', a: u24(), b: u24() });
    } else if (op === 1) {
      elements.push({ op: 'latch', d: u24() });
    } else if (op === 2) {
      need(28);
      let cpu = '0x';
      for (let i = 0; i < 20; i++) cpu += bytes[p++].toString(16).padStart(2, '0');
      let id = 0n;
      for (let i = 0; i < 8; i++) id = (id << 8n) | BigInt(bytes[p++]);
      const nIns = u8();
      const nOuts = u8();
      const ins: number[] = [];
      for (let i = 0; i < nIns; i++) ins.push(u24());
      elements.push({ op: 'ref', cpu, id, ins, nOuts });
    } else {
      throw new Error('bad opcode');
    }
  }
  return { nIn, nOut, elements };
}

export function toHex(bytes: Uint8Array): string {
  let s = '0x';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function compile(net: Netlist, resolve?: Resolve, depth = 0): Compiled {
  const why = problems(net);
  if (why) throw new Error(why);
  if (depth > MAX_DEPTH) throw new Error('REF depth');
  let nState = 0;
  let gateCount = 0;
  let topNand = 0;
  let topLatch = 0;
  let sig = 2 + net.nIn;
  const elements: CompiledEl[] = [];
  for (const e of net.elements) {
    if (e.op === 'nand') {
      elements.push({ op: 'nand', a: e.a, b: e.b, out: sig });
      sig += 1;
      topNand += 1;
      gateCount += 1;
    } else if (e.op === 'latch') {
      elements.push({ op: 'latch', d: e.d, out: sig, st: nState });
      sig += 1;
      nState += 1;
      topLatch += 1;
      gateCount += 1;
    } else {
      if (!resolve) throw new Error('no circuit');
      const sub = resolve(normalizeCpu(e.cpu), e.id);
      if (!sub) throw new Error('no circuit');
      if (sub.nIn !== e.ins.length || sub.nOut !== e.nOuts) throw new Error('REF: pin mismatch');
      if (nState + sub.nState > MAX_SIGNAL || gateCount + sub.gateCount > 0xffffffff) {
        throw new Error('size overflow');
      }
      elements.push({
        op: 'ref',
        cpu: normalizeCpu(e.cpu),
        id: e.id,
        ins: e.ins,
        nOuts: e.nOuts,
        out: sig,
        st: nState,
        sub,
      });
      sig += e.nOuts;
      nState += sub.nState;
      gateCount += sub.gateCount;
    }
  }
  return { nIn: net.nIn, nOut: net.nOut, nState, gateCount, topNand, topLatch, nSignals: sig, elements };
}

/** One beat. Missing input or state bits read as 0, matching the processor. */
export function step(c: Compiled, state: ArrayLike<number>, inputs: ArrayLike<number>): { state: Uint8Array; outputs: number[] } {
  const a = new Uint8Array(c.nSignals);
  a[1] = 1;
  for (let i = 0; i < c.nIn; i++) a[2 + i] = i < inputs.length && inputs[i] ? 1 : 0;
  const ns = new Uint8Array(c.nState);
  for (const e of c.elements) {
    if (e.op === 'nand') {
      a[e.out] = a[e.a] & a[e.b] ? 0 : 1;
    } else if (e.op === 'latch') {
      a[e.out] = e.st < state.length && state[e.st] ? 1 : 0;
    } else {
      const subState = new Uint8Array(e.sub.nState);
      for (let i = 0; i < e.sub.nState; i++) subState[i] = state[e.st + i] ? 1 : 0;
      const subIn = new Uint8Array(e.ins.length);
      for (let i = 0; i < e.ins.length; i++) subIn[i] = a[e.ins[i]];
      const r = step(e.sub, subState, subIn);
      if (r.outputs.length !== e.nOuts) throw new Error('REF: pin mismatch');
      for (let i = 0; i < r.outputs.length; i++) a[e.out + i] = r.outputs[i];
      ns.set(r.state, e.st);
    }
  }
  for (const e of c.elements) {
    if (e.op === 'latch') ns[e.st] = a[e.d];
  }
  const outputs: number[] = [];
  for (let i = c.nSignals - c.nOut; i < c.nSignals; i++) outputs.push(a[i]);
  return { state: ns, outputs };
}

export function packBits(bits: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}

export function unpackBits(bytes: ArrayLike<number>, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const byte = i >> 3 < bytes.length ? bytes[i >> 3] : 0;
    out.push((byte >> (i & 7)) & 1);
  }
  return out;
}

/**
 * Builder. NAND is folded (0 NAND x = 1, 1 NAND 1 = 0, 1 NAND x = NOT x) and
 * combined when the same pair was already built. LATCH D may point at a later
 * signal; call tie() after the signal exists. outputs() appends a real gate
 * per result so the last nOut signals are gates even when a result folded to
 * a constant.
 */
export class Builder {
  readonly nIn: number;
  private readonly elements: Element[] = [];
  private readonly cache = new Map<string, number>();
  private readonly latchAt = new Map<number, number>();
  private next: number;
  private committed = false;
  private outSigs: number[] | null = null;

  constructor(nIn: number) {
    if (!Number.isInteger(nIn) || nIn < 0 || nIn > 65536) throw new Error('too many pins');
    this.nIn = nIn;
    this.next = 2 + nIn;
  }

  input(i: number): number {
    if (!Number.isInteger(i) || i < 0 || i >= this.nIn) throw new Error('input');
    return 2 + i;
  }

  nand(a: number, b: number): number {
    if (a > b) { const t = a; a = b; b = t; }
    if (a === 0) return 1;
    if (a === 1 && b === 1) return 0;
    if (a === 1) return this.not(b);
    if (a === b) return this.not(a);
    return this.emit(a, b);
  }

  not(a: number): number {
    if (a === 0) return 1;
    if (a === 1) return 0;
    return this.emit(a, a);
  }

  and(a: number, b: number): number {
    return this.not(this.nand(a, b));
  }

  or(a: number, b: number): number {
    return this.nand(this.not(a), this.not(b));
  }

  xor(a: number, b: number): number {
    const nab = this.nand(a, b);
    return this.nand(this.nand(a, nab), this.nand(b, nab));
  }

  /** Current-state bit. Its D stays unset until tie(). */
  latch(): number {
    if (this.committed) throw new Error('outputs already taken');
    const q = this.next++;
    this.latchAt.set(q, this.elements.length);
    this.elements.push({ op: 'latch', d: -1 });
    return q;
  }

  tie(q: number, d: number): void {
    const idx = this.latchAt.get(q);
    if (idx === undefined) throw new Error('not a latch');
    const e = this.elements[idx];
    if (e.op !== 'latch') throw new Error('not a latch');
    e.d = d;
  }

  /**
   * Identity gates, emitted last. Two NANDs restore each bit, and the
   * restorers are the final elements, so they are the circuit outputs.
   */
  outputs(signals: number[]): number[] {
    if (this.committed) throw new Error('outputs already taken');
    if (signals.length < 1 || signals.length > 65536) throw new Error('no outputs');
    this.committed = true;
    const inv = signals.map(s => this.raw(s));
    this.outSigs = inv.map(t => this.raw(t));
    return this.outSigs;
  }

  finish(nOut: number): Netlist {
    if (!this.outSigs || this.outSigs.length !== nOut) throw new Error('no outputs');
    const net: Netlist = { nIn: this.nIn, nOut, elements: this.elements.map(cloneEl) };
    const why = problems(net);
    if (why) throw new Error(why);
    return net;
  }

  private emit(a: number, b: number): number {
    if (this.committed) throw new Error('outputs already taken');
    const key = a + ',' + b;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const out = this.pushNand(a, b);
    this.cache.set(key, out);
    return out;
  }

  /** NAND(signal, signal), with no folding and no reuse. */
  private raw(signal: number): number {
    return this.pushNand(signal, signal);
  }

  private pushNand(a: number, b: number): number {
    if (a < 0 || b < 0 || a >= this.next || b >= this.next) throw new Error('NAND: future signal');
    const out = this.next++;
    this.elements.push({ op: 'nand', a, b });
    return out;
  }
}

function cloneEl(e: Element): Element {
  if (e.op === 'nand') return { op: 'nand', a: e.a, b: e.b };
  if (e.op === 'latch') return { op: 'latch', d: e.d };
  return { op: 'ref', cpu: e.cpu, id: e.id, ins: [...e.ins], nOuts: e.nOuts };
}

function ge4(b: Builder, a: number[], bits: number[]): number {
  let borrow = 0;
  for (let i = 0; i < 4; i++) {
    const na = b.not(a[i]);
    borrow = b.or(b.or(b.and(na, bits[i]), b.and(na, borrow)), b.and(bits[i], borrow));
  }
  return b.not(borrow);
}

function pop3(b: Builder, p: number, q: number, r: number): [number, number] {
  const c0 = b.xor(b.xor(p, q), r);
  const c1 = b.or(b.or(b.and(p, q), b.and(p, r)), b.and(q, r));
  return [c0, c1];
}

/** Popcount (c0 is the low bit) is at least the 2-bit number k. k = 0 is always true. */
function atLeast(b: Builder, c0: number, c1: number, k0: number, k1: number): number {
  const nk0 = b.not(k0);
  const nk1 = b.not(k1);
  const any = b.or(c0, c1);
  const eq0 = b.and(nk1, nk0);
  const eq1 = b.and(b.and(nk1, k0), any);
  const eq2 = b.and(b.and(k1, nk0), c1);
  const eq3 = b.and(b.and(b.and(k1, k0), c0), c1);
  return b.or(b.or(eq0, eq1), b.or(eq2, eq3));
}

/**
 * The shared state machine. 16 inputs, LSB first, in packInputs() order.
 * 4 outputs: next state bit 0, next state bit 1, alert, release.
 * 2 latches. N and k are ordinary inputs here; a vault wrapper ties them to constants.
 */
export function compileTemplate(): Netlist {
  const b = new Builder(16);
  const s0 = b.latch();
  const s1 = b.latch();
  const ns0 = b.not(s0);
  const ns1 = b.not(s1);
  const active = b.and(ns0, ns1);
  const alert = b.and(s0, ns1);
  const claimable = b.and(ns0, s1);
  const released = b.and(s0, s1);

  const n = [0, 1, 2, 3].map(i => b.input(i));
  const k0 = b.input(4);
  const k1 = b.input(5);
  const missed = [0, 1, 2, 3].map(i => b.input(6 + i));
  const ping = b.input(10);
  const np = b.not(ping);
  const g0 = b.input(11);
  const g1 = b.input(12);
  const g2 = b.input(13);
  const wait = b.input(14);
  const paid = b.input(15);

  const ge = ge4(b, missed, n);
  const [c0, c1] = pop3(b, g0, g1, g2);
  const qk = atLeast(b, c0, c1, k0, k1);
  const quiet = b.and(alert, np);
  const advance = b.and(b.and(quiet, qk), wait);

  const next0 = b.or(
    b.or(b.and(b.and(active, np), ge), b.and(quiet, b.not(b.and(qk, wait)))),
    b.or(b.and(claimable, paid), released),
  );
  const next1 = b.or(b.or(advance, claimable), released);
  const alertOut = b.and(b.and(active, np), ge);
  const releaseOut = b.or(advance, b.and(claimable, b.not(paid)));

  const outs = b.outputs([next0, next1, alertOut, releaseOut]);
  b.tie(s0, outs[0]);
  b.tie(s1, outs[1]);
  return b.finish(4);
}

/**
 * One vault. The 10 pins are missed (4), ping, three guardians, wait, paid.
 * N and k are constant signals, so changing them means a new wrapper.
 * templateId is the taped-out template on `cpu`.
 */
export function compileWrapper(cpu: string, templateId: bigint, n: number, k: number): Netlist {
  if (!Number.isInteger(n) || n < 0 || n > 15) throw new Error('n');
  if (!Number.isInteger(k) || k < 0 || k > 3) throw new Error('k');
  if (templateId < 1n || templateId > 0xffffffffffffffffn) throw new Error('template');
  const bit = (v: number, i: number) => ((v >> i) & 1) as 0 | 1;
  const ins = [
    bit(n, 0), bit(n, 1), bit(n, 2), bit(n, 3),
    bit(k, 0), bit(k, 1),
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  ];
  return {
    nIn: 10,
    nOut: 4,
    elements: [{ op: 'ref', cpu: normalizeCpu(cpu), id: templateId, ins, nOuts: 4 }],
  };
}

function asState(bits: Uint8Array): GateState {
  return (bits[0] | (bits[1] << 1)) as GateState;
}

/** Same bit order as packInputs() in circuit.ts. The check script locks the two together. */
function templateBits(i: StepInputs): number[] {
  const bits = (v: number, w: number) => Array.from({ length: w }, (_, b) => (v >> b) & 1);
  return [
    ...bits(i.n, 4),
    ...bits(i.k, 2),
    ...bits(Math.min(15, i.missed), 4),
    i.ping ? 1 : 0,
    ...i.approvals.map(a => (a ? 1 : 0)),
    i.waitElapsed ? 1 : 0,
    i.payoutDone ? 1 : 0,
  ];
}

export function stepTemplate(c: Compiled, state: GateState, inputs: StepInputs): StepOutputs {
  const r = step(c, [state & 1, (state >> 1) & 1], templateBits(inputs));
  return { next: asState(r.state), alert: r.outputs[2] === 1, release: r.outputs[3] === 1 };
}

export type PlanBits = {
  missed: number;
  ping: boolean;
  approvals: [boolean, boolean, boolean];
  waitElapsed: boolean;
  payoutDone: boolean;
};

/** Wrapper input byte, LSB first. The keeper packs this, not the 16-bit template word. */
export function packPlanBits(pins: PlanBits): Uint8Array {
  const missed = Math.min(15, Math.max(0, pins.missed | 0));
  const bits = [
    missed & 1, (missed >> 1) & 1, (missed >> 2) & 1, (missed >> 3) & 1,
    pins.ping ? 1 : 0,
    pins.approvals[0] ? 1 : 0,
    pins.approvals[1] ? 1 : 0,
    pins.approvals[2] ? 1 : 0,
    pins.waitElapsed ? 1 : 0,
    pins.payoutDone ? 1 : 0,
  ];
  return packBits(bits);
}

export function stepWrapper(c: Compiled, state: GateState, pins: PlanBits): StepOutputs {
  const bits = unpackBits(packPlanBits(pins), 10);
  const r = step(c, [state & 1, (state >> 1) & 1], bits);
  return { next: asState(r.state), alert: r.outputs[2] === 1, release: r.outputs[3] === 1 };
}
