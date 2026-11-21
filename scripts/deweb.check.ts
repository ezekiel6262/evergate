import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { step, type GateState, type StepInputs } from '../lib/circuit.ts';

const require = createRequire(import.meta.url);
const page = require('../deweb/step.js') as {
  step: (state: number, i: StepInputs) => { next: number; alert: boolean; release: boolean };
  packWrapper: (missed: number, ping: boolean, approvals: number, waitElapsed: boolean, paid: boolean) => string;
  signals: (now: number, lastCheckIn: number, interval: number, alertAt: number, waitPeriod: number) => { missed: number; waitElapsed: boolean };
};

const fail = (name: string, detail: string) => {
  console.error(`FAIL ${name}: ${detail}`);
  process.exit(1);
};

const expect = (name: string, got: unknown, want: unknown) => {
  if (got !== want) fail(name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

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
    const got = page.step(state, inputs);
    if (got.next !== want.next || got.alert !== want.alert || got.release !== want.release) {
      fail('page step', `state ${state} word ${word} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
  }
}

expect('pack a301', page.packWrapper(3, false, 5, true, false), 'a301');
expect('pack clamps', page.packWrapper(16, false, 0, false, false), page.packWrapper(15, false, 0, false, false));

const day = 86400;
const interval = 30 * day;
const wait = 30 * day;
const last = 1_000_000;
expect('no miss yet', page.signals(last, last, interval, 0, wait).missed, 0);
expect('two misses', page.signals(last + 3 * interval - 1, last, interval, 0, wait).missed, 2);
expect('three misses', page.signals(last + 3 * interval, last, interval, 0, wait).missed, 3);
expect('cap', page.signals(last + 40 * interval, last, interval, 0, wait).missed, 15);
expect('no alert', page.signals(last + wait, last, interval, 0, wait).waitElapsed, false);
const alertAt = last + 3 * interval;
expect('wait running', page.signals(alertAt + wait - 1, last, interval, alertAt, wait).waitElapsed, false);
expect('wait done', page.signals(alertAt + wait, last, interval, alertAt, wait).waitElapsed, true);

const root = join(import.meta.dirname, '..', 'deweb');
const textNames = ['index.html', 'rule.css', 'step.js'];
for (const name of textNames) {
  const text = readFileSync(join(root, name), 'utf8');
  if (/https?:\/\//i.test(text)) fail('offchain url', name);
  if (/\b(nand|netlist)\b/i.test(text)) fail('jargon', name);
}
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const phrase of [
  'never more than 15',
  'only after an alert has started',
  'a301',
  'complements a will',
  'Nobody else can change it, including Evergate',
]) {
  if (!html.includes(phrase)) fail('copy', phrase);
}

const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (!/^[A-Za-z0-9._-]+$/.test(name)) fail('filename', name);
  }
};
walk(root);

if (!process.exitCode) console.log('deweb ok');
