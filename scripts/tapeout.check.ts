import { decode, encode, compileTemplate, compileWrapper } from '../lib/netlist.ts';
import { TAPEOUT_FEE_WEI, TAPEOUT_SELECTOR, tapeoutCalldata } from '../lib/tapeout.ts';
import { alerted, claimable, noticesOnStep, reminder, welcome, type GateMail } from '../lib/notices.ts';

const fail = (name: string, detail: string) => {
  console.error(`FAIL ${name}: ${detail}`);
  process.exit(1);
};

const expect = (name: string, got: unknown, want: unknown) => {
  if (got !== want) fail(name, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

const same = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

function payload(data: string) {
  const h = data.slice(2);
  if (!data.startsWith(TAPEOUT_SELECTOR)) fail('selector', data.slice(0, 10));
  const word = (i: number) => BigInt('0x' + h.slice(8 + i * 64, 8 + (i + 1) * 64));
  const off = Number(word(0));
  const nIn = Number(word(1));
  const nOut = Number(word(2));
  const len = Number(word(3));
  if (off !== 96) fail('offset', String(off));
  const start = 8 + 4 * 64;
  const hex = h.slice(start, start + len * 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const padded = h.length - start;
  if (padded !== Math.ceil(len / 32) * 64) fail('padding', `${padded} for ${len}`);
  return { nIn, nOut, bytes };
}

const template = compileTemplate();
const call = tapeoutCalldata(template.nIn, template.nOut, encode(template));
const got = payload(call);
expect('template pins', `${got.nIn}/${got.nOut}`, '16/4');
if (!same(got.bytes, encode(template))) fail('template bytes', 'calldata netlist differs');
const back = decode(got.bytes, got.nIn, got.nOut);
expect('template elements', back.elements.length, template.elements.length);

const cpu = '0x' + 'ab'.repeat(20);
for (const [n, k] of [[3, 2], [2, 1]] as const) {
  const wrapped = compileWrapper(cpu, 7n, n, k);
  const w = payload(tapeoutCalldata(wrapped.nIn, wrapped.nOut, encode(wrapped)));
  expect(`wrapper ${n}/${k}`, `${w.nIn}/${w.nOut}`, '10/4');
  if (!same(w.bytes, encode(wrapped))) fail(`wrapper ${n}/${k} bytes`, 'differs');
  const ref = decode(w.bytes, 10, 4).elements[0];
  if (ref.op !== 'ref' || ref.id !== 7n) fail(`wrapper ${n}/${k} ref`, JSON.stringify(ref.op === 'ref' ? ref.id.toString() : ref.op));
}

expect('fee', TAPEOUT_FEE_WEI, 1_300_000_000_000_000n);
expect('direct', call.slice(0, 10), TAPEOUT_SELECTOR);

const mail: GateMail = {
  owner: 'Ada',
  page: 'tape://2.311.9/ada',
  missesAllowed: 3,
  checkIn: 'every month',
  wait: '1 month',
  guardians: ['Sam Ortiz', 'Priya Nair', 'Kemi Adeyemi'],
  heirs: ['Theo', 'June'],
};

const banned = /\b(nand|netlist|circuit)\b/i;
const all = [
  ...welcome(mail),
  ...reminder(mail),
  ...alerted(mail),
  ...claimable(mail),
  ...noticesOnStep(0, 1, true, mail),
  ...noticesOnStep(1, 2, false, mail),
];
for (const note of all) if (banned.test(note.text)) fail('jargon', note.text);

expect('welcome', welcome(mail).map(n => n.who).join(','), mail.guardians.join(','));
expect('reminder who', reminder(mail).length, 1);
expect('reminder audience', reminder(mail)[0].audience, 'owner');
expect('alerted', alerted(mail).length, 5);
expect('alerted page', alerted(mail).every(n => n.text.includes(mail.page)), true);
expect('claimable', claimable(mail).map(n => n.who).join(','), 'Theo,June');
expect('enter alert', noticesOnStep(0, 1, true, mail).every(n => n.kind === 'alerted'), true);
expect('enter ready', noticesOnStep(1, 2, false, mail).every(n => n.kind === 'claimable'), true);
expect('stay ready', noticesOnStep(2, 2, false, mail).length, 0);
expect('stay alert', noticesOnStep(1, 1, false, mail).length, 0);

if (!process.exitCode) console.log('tapeout ok');
