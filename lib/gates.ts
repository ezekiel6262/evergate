import { formatUnits, type Address } from 'viem';
import { GateState } from './circuit';
import {
  EXEC_FEE, OPENER, USDT0, erc20Abi, keeperAbi, openerAbi, publicClient, shortAddr,
} from './chain';
import { Asset, Guardian, Heir, LogItem, Vault } from './vault';

const COLORS = ['#173d31', '#5d7c58', '#c6b5f0', '#efa62b'];

function daysOf(seconds: number) {
  const days = seconds / 86400;
  return days >= 1 ? Math.round(days) : 1;
}

async function tokenMeta(token: Address, wallet: Address) {
  const [raw, decimals, symbol] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }).catch(() => shortAddr(token)),
  ]);
  return { raw, decimals: Number(decimals), symbol };
}

export async function readVault(keeper: Address, id: bigint): Promise<Vault> {
  const [row, heirs, guardians, tokens, wallet, preview, block] = await Promise.all([
    publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'vaults', args: [id] }),
    publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'heirsOf', args: [id] }),
    publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'guardiansOf', args: [id] }),
    publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'tokensOf', args: [id] }),
    publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'walletOf', args: [id] }),
    publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'preview', args: [id] }),
    publicClient.getBlock(),
  ]);
  const [owner, circuitId, lastCheckInRaw, alertAtRaw, intervalRaw, waitRaw, nRaw, kRaw, stateRaw, approvalsRaw] = row;
  const [missedRaw, waitElapsed] = preview;
  if (owner === '0x0000000000000000000000000000000000000000') throw new Error('No gate with that number.');

  const native = await publicClient.getBalance({ address: wallet });
  const assets: Asset[] = [];
  if (native > 0n) {
    assets.push({ sym: 'OKB', amount: Number(formatUnits(native, 18)), raw: native, decimals: 18, color: COLORS[0], token: null });
  }
  for (let i = 0; i < tokens.length; i++) {
    const meta = await tokenMeta(tokens[i], wallet);
    assets.push({
      sym: meta.symbol,
      amount: Number(formatUnits(meta.raw, meta.decimals)),
      raw: meta.raw,
      decimals: meta.decimals,
      color: COLORS[(i + 1) % COLORS.length],
      token: tokens[i],
    });
  }

  const released = Number(stateRaw) === 3;
  const heirRows: Heir[] = heirs.map(h => ({
    name: shortAddr(h.account),
    addr: h.account,
    bps: Number(h.bps),
    claimed: released,
  }));
  const guardRows: Guardian[] = guardians.map((addr, i) => ({
    name: shortAddr(addr),
    addr,
    approved: (Number(approvalsRaw) & (1 << i)) !== 0,
  }));

  const now = Number(block.timestamp);
  const lastCheckIn = Number(lastCheckInRaw);
  const alertAt = Number(alertAtRaw) === 0 ? null : Number(alertAtRaw);
  const intervalSeconds = Number(intervalRaw);
  const waitSeconds = Number(waitRaw);
  const log: LogItem[] = [
    { at: lastCheckIn, text: 'Last check-in.', kind: 'check' },
  ];
  if (alertAt) log.unshift({ at: alertAt, text: 'An alert started. Nothing was paid.', kind: 'alert' });
  if (released) log.unshift({ at: now, text: 'The shares were paid and the gate is closed.', kind: 'claim' });

  return {
    id: id.toString(),
    owner: shortAddr(owner),
    ownerAddr: owner.toLowerCase(),
    circuitId: circuitId.toString(),
    wallet,
    assets,
    heirs: heirRows,
    guardians: guardRows,
    intervalDays: daysOf(intervalSeconds),
    intervalSeconds,
    missesAllowed: Number(nRaw),
    quorum: Number(kRaw),
    waitDays: daysOf(waitSeconds),
    waitSeconds,
    now,
    lastCheckIn,
    alertAt,
    missed: Number(missedRaw),
    waitElapsed,
    state: Number(stateRaw) as GateState,
    log,
  };
}

export async function readAll(keeper: Address): Promise<Vault[]> {
  const next = await publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'nextVaultId' });
  const out: Vault[] = [];
  for (let id = 1n; id < next; id++) out.push(await readVault(keeper, id));
  return out;
}

/** How many brain-wallet executes a claim will make, and the OKB the caller must attach. */
export function claimValue(vault: Vault) {
  const calls = (total: bigint) => {
    let paid = 0n;
    let n = 0n;
    vault.heirs.forEach((h, i) => {
      const amount = i + 1 === vault.heirs.length ? total - paid : total * BigInt(h.bps) / 10_000n;
      paid += amount;
      if (amount > 0n) n++;
    });
    return n;
  };
  let n = 0n;
  for (const asset of vault.assets) n += calls(asset.raw);
  return { calls: n, value: EXEC_FEE * n };
}

export async function walletBalances(account: Address) {
  const [okb, raw, decimals] = await Promise.all([
    publicClient.getBalance({ address: account }),
    publicClient.readContract({ address: USDT0, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    publicClient.readContract({ address: USDT0, abi: erc20Abi, functionName: 'decimals' }).catch(() => 6),
  ]);
  return { okb, usdt: raw, usdtDecimals: Number(decimals) };
}

export async function openFee() {
  return publicClient.readContract({ address: OPENER, abi: openerAbi, functionName: 'FEE' });
}
