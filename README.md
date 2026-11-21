# Evergate

Crypto inheritance whose rule is a TapeOut circuit on X Layer. Set a rule once, check in now and then; if you stop, guardians are alerted, and after a waiting period heirs claim their shares.

## Run it

```
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to ./out (deploys to Vercel as-is)
npm run check      # cadence, netlist, the rule page, and the tape-out call
```

## Views (hash routed, single page)

| Hash | View |
| --- | --- |
| `#home` | Marketing site with the film, an example rule, chain fees, and the FAQ |
| `#gate` | Owner dashboard: status, check-in, assets, heirs, guardians, rule, activity |
| `#setup` | 5-step setup. Creating a gate signs real X Layer transactions |
| `#guardian` | Guardian view: alert handling and approval |
| `#heir` | Heir claim flow |
| `#public` | Public rule page with in-browser recompute |
| `#film` | Full-screen film; `?capture=1` exposes `window.__setT(t)` for frame rendering |

Connect a wallet on X Layer. There is no sample account and no demo clock. The browser remembers a keeper address you have already published. It does not invent a gate.

## Where things live

- `lib/circuit.ts`: the state machine that mirrors the onchain `step()` circuit, plus input bit-packing.
- `lib/netlist.ts`: TAP-02 builder, encoder, and local `step()`. One template, plus a per-vault wrapper that pins the owner's settings to constant signals.
- `contracts/`: EvergateKeeper. The keeper has no admin. It stores the two state bits and pays only when `step()` says the gate is open. Tests need Foundry. From `contracts/`, run `git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std`, then `forge test`.
- `deweb/`: the static rule page for TapeKit. Relative files only, so it can be published as-is. `npm run check` proves its `step()` matches `lib/circuit.ts`.
- `lib/tapeout.ts`: encodes a netlist into the `tapeout` call, with the exact X Layer fee. It does not send the transaction.
- `lib/notices.ts`: the TapeSend texts for a welcome, a check-in reminder, an alert, and a claim. Sending them waits on an opened circuit and gas.
- `lib/store.tsx`: gates read from the Evergate contract on X Layer. Connect a wallet. There is no sample account.
- `components/Film.tsx`: the commercial, a pure function of time. Render it to video with Playwright plus ffmpeg (see the brief).
- `components/MiniGate.tsx`, `components/Logo.tsx`: the gate illustration and the NAND-gate logo mark.

## Design tokens

Lichen #E6EBE1, Paper #F7F9F4, Pine #173D31, Ink #10231D, Moss #5D7C58, Marigold #EFA62B, Lilac #C6B5F0. Type: Young Serif (display), Onest (UI).
