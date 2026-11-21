// The tape-out transaction, built and not sent.
// tapeout(bytes,uint32,uint32) is selector 0x7bd3ac1d (TAP-02).
// Pass the bytes from encode() in lib/netlist.ts. This file does not import
// that module, so the check script can load either one on its own.
// On X Layer the fee is exactly TAPEOUT_FEE(), read on 2026-11-21.
// Any other value reverts. This file never broadcasts.

export const TAPEOUT_SELECTOR = '0x7bd3ac1d';

/** 0.0013 OKB. The caller attaches this as msg.value and nothing else. */
export const TAPEOUT_FEE_WEI = 1_300_000_000_000_000n;

const word = (n: number | bigint) => n.toString(16).padStart(64, '0');

export function tapeoutCalldata(nIn: number, nOut: number, raw: Uint8Array): string {
  if (nIn > 0xffffffff || nOut > 0xffffffff) throw new Error('width');
  const body = Array.from(raw, b => b.toString(16).padStart(2, '0')).join('');
  const pad = (64 - (body.length % 64)) % 64;
  return '0x' + TAPEOUT_SELECTOR.slice(2)
    + word(96)
    + word(nIn)
    + word(nOut)
    + word(raw.length)
    + body
    + '0'.repeat(pad);
}
