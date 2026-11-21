import { step, type GateState, type StepInputs } from '../lib/circuit.ts';
import {
  compile, compileTemplate, compileWrapper, decode, encode, normalizeCpu, packBits,
  problems, step as beat, stepTemplate, stepWrapper, toHex, unpackBits, type Compiled,
} from '../lib/netlist.ts';

const fail = (name: string, detail: string) => {
  console.error(`FAIL ${name}: ${detail}`);
  process.exit(1);
};

const expect = (name: string, got: unknown, want: unknown) => {
  if (got !== want) fail(name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

const sameBytes = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

// A one-input inverter, plus a latch that delays its D by one beat.
const notNet = decode(encode({
  nIn: 1,
  nOut: 1,
  elements: [{ op: 'nand', a: 2, b: 2 }],
}), 1, 1);
const notC = compile(notNet);
expect('not 0', beat(notC, [], [0]).outputs[0], 1);
expect('not 1', beat(notC, [], [1]).outputs[0], 0);

const delay = compile({
  nIn: 1,
  nOut: 1,
  elements: [{ op: 'latch', d: 2 }],
});
expect('delay out', beat(delay, [0], [1]).outputs[0], 0);
expect('delay next', beat(delay, [0], [1]).state[0], 1);
expect('delay held', beat(delay, [1], [0]).outputs[0], 1);
expect('delay clear', beat(delay, [1], [0]).state[0], 0);

const CEREBR = '0xb04eb79d1a5eecaabaaff7b77d7c27578ee693ff';
const refHex = '02b04eb79d1a5eecaabaaff7b77d7c27578ee693ff00000000000000010201000000000001';
const constRef = {
  nIn: 0,
  nOut: 1,
  elements: [{ op: 'ref' as const, cpu: CEREBR, id: 1n, ins: [0, 1], nOuts: 1 }],
};
expect('const ref bytes', toHex(encode(constRef)), '0x' + refHex);
expect('future ref', problems({
  nIn: 0,
  nOut: 1,
  elements: [{ op: 'ref', cpu: CEREBR, id: 1n, ins: [2, 3], nOuts: 1 }],
}), 'REF: future signal');
const round = decode(encode(constRef), 0, 1);
expect('ref pin0', round.elements[0].op === 'ref' ? round.elements[0].ins[0] : -1, 0);
expect('ref pin1', round.elements[0].op === 'ref' ? round.elements[0].ins[1] : -1, 1);

const templateNet = compileTemplate();
const templateBytes = encode(templateNet);
const template = compile(decode(templateBytes, templateNet.nIn, templateNet.nOut));
expect('template in', template.nIn, 16);
expect('template out', template.nOut, 4);
expect('template state', template.nState, 2);
expect('template latches', template.topLatch, 2);
expect('round trip', toHex(encode(decode(templateBytes, 16, 4))), toHex(templateBytes));
const latches = template.elements.filter(e => e.op === 'latch');
if (latches[0].op !== 'latch' || latches[1].op !== 'latch') fail('latches', 'missing');
expect('latch d0', latches[0].d, template.nSignals - 4);
expect('latch d1', latches[1].d, template.nSignals - 3);

const wordInputs = (word: number): StepInputs => ({
  n: word & 15,
  k: (word >> 4) & 3,
  missed: (word >> 6) & 15,
  ping: ((word >> 10) & 1) === 1,
  approvals: [((word >> 11) & 1) === 1, ((word >> 12) & 1) === 1, ((word >> 13) & 1) === 1],
  waitElapsed: ((word >> 14) & 1) === 1,
  payoutDone: ((word >> 15) & 1) === 1,
});

for (let state = 0; state < 4; state++) {
  for (let word = 0; word < 65536; word++) {
    const inputs = wordInputs(word);
    const want = step(state as GateState, inputs);
    const got = stepTemplate(template, state as GateState, inputs);
    if (got.next !== want.next || got.alert !== want.alert || got.release !== want.release) {
      fail('template', `state ${state} word ${word} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
  }
}

const CPU = '0x' + '11'.repeat(20);
const plans: [number, number][] = [[3, 2], [1, 1], [15, 3], [0, 0], [8, 2], [2, 1]];
for (const [n, k] of plans) {
  const wrapped = compileWrapper(CPU, 1n, n, k);
  expect(`wrapper ${n}/${k} pins`, wrapped.elements[0].op === 'ref' ? wrapped.elements[0].ins.length : 0, 16);
  const ref = wrapped.elements[0];
  if (ref.op !== 'ref') fail('wrapper', 'not a ref');
  expect(`n0 ${n}`, ref.ins[0], n & 1);
  expect(`n1 ${n}`, ref.ins[1], (n >> 1) & 1);
  expect(`k0 ${k}`, ref.ins[4], k & 1);
  expect(`k1 ${k}`, ref.ins[5], (k >> 1) & 1);
  const c = compile(wrapped, (cpu, id) => (cpu === CPU && id === 1n ? template : undefined));
  expect(`wrapper state ${n}/${k}`, c.nState, 2);
  expect(`wrapper burn ${n}/${k}`, c.topNand + c.topLatch, 0);
  expect(`wrapper gates ${n}/${k}`, c.gateCount, template.gateCount);
  for (let state = 0; state < 4; state++) {
    for (let bits = 0; bits < 1024; bits++) {
      const pins = {
        missed: bits & 15,
        ping: ((bits >> 4) & 1) === 1,
        approvals: [((bits >> 5) & 1) === 1, ((bits >> 6) & 1) === 1, ((bits >> 7) & 1) === 1] as [boolean, boolean, boolean],
        waitElapsed: ((bits >> 8) & 1) === 1,
        payoutDone: ((bits >> 9) & 1) === 1,
      };
      const want = step(state as GateState, { n, k, ...pins });
      const got = stepWrapper(c, state as GateState, pins);
      if (got.next !== want.next || got.alert !== want.alert || got.release !== want.release) {
        fail('wrapper', `n ${n} k ${k} state ${state} bits ${bits} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
      }
    }
  }
}

// The three create-time checks the keeper will run on a new wrapper.
const pin = (n: number, k: number) => compile(compileWrapper(CPU, 1n, n, k), () => template);
const live = pin(3, 2);
const alerted = stepWrapper(live, 0, {
  missed: 3, ping: false, approvals: [false, false, false], waitElapsed: false, payoutDone: false,
});
expect('pin alert', `${alerted.next}${alerted.alert}`, '1true');
const quiet = stepWrapper(live, 0, {
  missed: 2, ping: false, approvals: [false, false, false], waitElapsed: false, payoutDone: false,
});
expect('pin stay', `${quiet.next}${quiet.alert}`, '0false');
const opened = stepWrapper(live, 1, {
  missed: 0, ping: false, approvals: [true, true, false], waitElapsed: true, payoutDone: false,
});
expect('pin release', `${opened.next}${opened.release}`, '2true');

console.log(`template ${template.topNand} nand + ${template.topLatch} latch, ${templateBytes.length} bytes`);

const RPC = 'https://rpc.xlayer.tech';
const RPC2 = 'https://xlayer.drpc.org';

const u256 = (n: bigint) => n.toString(16).padStart(64, '0');

async function rpc(url: string, to: string, data: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json() as { result?: string; error?: { message?: string } };
  if (!body.result) fail('rpc', body.error?.message || 'empty result');
  return body.result;
}

function readWord(hex: string, index: number): bigint {
  const h = hex.replace(/^0x/, '');
  return BigInt('0x' + h.slice(index * 64, index * 64 + 64));
}

function readBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, '');
  const off = Number(readWord(h, 0));
  const len = Number(BigInt('0x' + h.slice(off * 2, off * 2 + 64)));
  const start = off * 2 + 64;
  const raw = h.slice(start, start + len * 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function readTwoBytes(hex: string): [Uint8Array, Uint8Array] {
  const h = hex.replace(/^0x/, '');
  const take = (off: number) => {
    const len = Number(BigInt('0x' + h.slice(off * 2, off * 2 + 64)));
    const start = off * 2 + 64;
    const raw = h.slice(start, start + len * 2);
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
    return out;
  };
  return [take(Number(readWord(h, 0))), take(Number(readWord(h, 1)))];
}

function encodeBytes(data: Uint8Array): string {
  let hex = '';
  for (const b of data) hex += b.toString(16).padStart(2, '0');
  const pad = (32 - (data.length % 32)) % 32;
  return u256(BigInt(data.length)) + hex + '00'.repeat(pad);
}

async function circuitInfo(url: string, cpu: string, id: bigint) {
  const data = '0x084d60f1' + u256(id);
  const hex = await rpc(url, cpu, data);
  return {
    nIn: Number(readWord(hex, 0)),
    nOut: Number(readWord(hex, 1)),
    nState: Number(readWord(hex, 2)),
    gateCount: Number(readWord(hex, 3)),
  };
}

async function netlistOf(url: string, cpu: string, id: bigint) {
  return readBytes(await rpc(url, cpu, '0x3fc4be56' + u256(id)));
}

async function loadCircuit(url: string, cpu: string, id: bigint, cache: Map<string, Compiled>): Promise<Compiled> {
  const key = normalizeCpu(cpu) + ':' + id.toString();
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.has('loading:' + key)) fail('ref', 'cycle at ' + key);
  cache.set('loading:' + key, undefined as unknown as Compiled);
  const info = await circuitInfo(url, cpu, id);
  const bytes = await netlistOf(url, cpu, id);
  const back = decode(bytes, info.nIn, info.nOut);
  if (toHex(encode(back)) !== toHex(bytes)) fail('decode', key);
  const subs = new Map<string, Compiled>();
  for (const e of back.elements) {
    if (e.op === 'ref') subs.set(normalizeCpu(e.cpu) + ':' + e.id.toString(), await loadCircuit(url, e.cpu, e.id, cache));
  }
  const compiled = compile(back, (c, i) => subs.get(normalizeCpu(c) + ':' + i.toString()));
  expect(key + ' state', compiled.nState, info.nState);
  expect(key + ' gates', compiled.gateCount, info.gateCount);
  cache.set(key, compiled);
  return compiled;
}

async function chain() {
  const info14 = await circuitInfo(RPC, CEREBR, 14n);
  expect('cerebr 14 in', info14.nIn, 2);
  expect('cerebr 14 out', info14.nOut, 1);
  expect('cerebr 14 state', info14.nState, 2);
  const info14b = await circuitInfo(RPC2, CEREBR, 14n);
  expect('drpc 14 gates', info14b.gateCount, info14.gateCount);

  const cache = new Map<string, Compiled>();
  const c14 = await loadCircuit(RPC, CEREBR, 14n, cache);
  let matched = 0;
  for (let state = 0; state < 4; state++) {
    for (let input = 0; input < 4; input++) {
      const stateBits = [state & 1, (state >> 1) & 1];
      const inputBits = [input & 1, (input >> 1) & 1];
      const local = beat(c14, stateBits, inputBits);
      const stateEnc = encodeBytes(packBits(stateBits));
      const inputEnc = encodeBytes(packBits(inputBits));
      const offIn = 0x60 + stateEnc.length / 2;
      const data = '0xe8281a1a' + u256(14n) + u256(0x60n) + u256(BigInt(offIn)) + stateEnc + inputEnc;
      const [newState, outputs] = readTwoBytes(await rpc(RPC, CEREBR, data));
      const wantState = packBits(local.state);
      const wantOut = packBits(local.outputs);
      if (!sameBytes(newState, wantState) || !sameBytes(outputs, wantOut)) {
        fail('step 14', `state ${state} input ${input} chain ${toHex(newState)} ${toHex(outputs)} local ${toHex(wantState)} ${toHex(wantOut)}`);
      }
      matched += 1;
    }
  }
  const spot = await rpc(RPC2, CEREBR, '0xe8281a1a' + u256(14n) + u256(0x60n) + u256(0xa0n) + encodeBytes(new Uint8Array([1])) + encodeBytes(new Uint8Array([2])));
  const [spotState, spotOut] = readTwoBytes(spot);
  const spotLocal = beat(c14, [1, 0], [0, 1]);
  if (!sameBytes(spotState, packBits(spotLocal.state)) || !sameBytes(spotOut, packBits(spotLocal.outputs))) {
    fail('drpc step', `${toHex(spotState)} ${toHex(spotOut)}`);
  }

  const c5 = await loadCircuit(RPC, CEREBR, 5n, cache);
  expect('cerebr 5 state', c5.nState, 0);
  const evalHex = await rpc(RPC, CEREBR, '0x934d06ea' + u256(5n) + u256(0x40n) + encodeBytes(new Uint8Array([0x01])));
  const evalOut = readBytes(evalHex);
  const local5 = packBits(beat(c5, [], unpackBits(new Uint8Array([0x01]), c5.nIn)).outputs);
  if (!sameBytes(evalOut, local5)) fail('eval 5', `chain ${toHex(evalOut)} local ${toHex(local5)}`);
  expect('eval 5 byte', evalOut[0], 1);
  console.log(`chain ok: cerebr #14 ${matched}/16 steps, #5 eval`);
}

await chain();
console.log('netlist ok');
