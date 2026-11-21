'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { asAddress, EXEC_FEE, KEEPER_KEY, TEMPLATE_KEY, keeperAbi, publicClient, xlayer } from './chain';
import { claimValue, readAll, readVault } from './gates';
import { Vault } from './vault';
import { useWallet } from './wallet';

export type { Asset, Guardian, Heir, LogItem, Vault } from './vault';
export { fmt, inputsOf, missedOf, nextCheckIn, whenLabel } from './vault';

type Ctx = {
  vaults: Vault[];
  loading: boolean;
  error: string;
  keeper: Address | null;
  templateId: bigint | null;
  refresh: () => Promise<void>;
  remember: (keeper: Address, templateId: bigint | null) => void;
  checkIn: (id: string) => Promise<void>;
  approve: (id: string) => Promise<void>;
  claim: (id: string) => Promise<void>;
  withdraw: (id: string, token: Address | null, amount: bigint) => Promise<void>;
  load: (id: string) => Promise<Vault>;
};

const VaultCtx = createContext<Ctx | null>(null);
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

function readSaved(): { keeper: Address | null; templateId: bigint | null } {
  if (typeof window === 'undefined') return { keeper: null, templateId: null };
  try {
    const keeper = asAddress(localStorage.getItem(KEEPER_KEY) || '');
    const raw = localStorage.getItem(TEMPLATE_KEY) || '';
    const templateId = /^\d+$/.test(raw) && raw !== '0' ? BigInt(raw) : null;
    return { keeper, templateId };
  } catch {
    return { keeper: null, templateId: null };
  }
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { account, wallet } = useWallet();
  const [keeper, setKeeper] = useState<Address | null>(null);
  const [templateId, setTemplateId] = useState<bigint | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = readSaved();
    setKeeper(saved.keeper);
    setTemplateId(saved.templateId);
  }, []);

  const refresh = useCallback(async () => {
    if (!keeper) { setVaults([]); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      setVaults(await readAll(keeper));
    } catch (e) {
      setVaults([]);
      setError(e instanceof Error ? e.message : 'Could not read X Layer.');
    } finally {
      setLoading(false);
    }
  }, [keeper]);

  useEffect(() => { void refresh(); }, [refresh, account]);

  const remember = useCallback((next: Address, template: bigint | null) => {
    setKeeper(next);
    if (template) setTemplateId(template);
    try {
      localStorage.setItem(KEEPER_KEY, next);
      if (template) localStorage.setItem(TEMPLATE_KEY, template.toString());
    } catch { /* the gate is on chain either way */ }
  }, []);

  const requireWallet = useCallback(() => {
    if (!account || !wallet || !keeper) throw new Error('Connect the wallet that owns this gate.');
    return { account, wallet, keeper };
  }, [account, wallet, keeper]);

  const wait = async (hash: `0x${string}`) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('The transaction failed.');
    await refresh();
  };

  const api = useMemo<Ctx>(() => ({
    vaults, loading, error, keeper, templateId, refresh, remember,
    checkIn: async id => {
      const w = requireWallet();
      await wait(await w.wallet.writeContract({
        address: w.keeper, abi: keeperAbi, functionName: 'checkIn', args: [BigInt(id)], account: w.account, chain: xlayer,
      }));
    },
    approve: async id => {
      const w = requireWallet();
      await wait(await w.wallet.writeContract({
        address: w.keeper, abi: keeperAbi, functionName: 'approve', args: [BigInt(id)], account: w.account, chain: xlayer,
      }));
    },
    claim: async id => {
      const w = requireWallet();
      const vault = vaults.find(v => v.id === id) || await readVault(w.keeper, BigInt(id));
      const { value } = claimValue(vault);
      await wait(await w.wallet.writeContract({
        address: w.keeper, abi: keeperAbi, functionName: 'claim', args: [BigInt(id), EXEC_FEE], value, account: w.account, chain: xlayer,
      }));
    },
    withdraw: async (id, token, amount) => {
      const w = requireWallet();
      await wait(await w.wallet.writeContract({
        address: w.keeper, abi: keeperAbi, functionName: 'withdraw',
        args: [BigInt(id), token ?? ZERO, w.account, amount, EXEC_FEE],
        value: EXEC_FEE, account: w.account, chain: xlayer,
      }));
    },
    load: async id => {
      if (!keeper) throw new Error('No Evergate contract on this browser yet.');
      return readVault(keeper, BigInt(id));
    },
  }), [vaults, loading, error, keeper, templateId, refresh, remember, requireWallet]);

  return <VaultCtx.Provider value={api}>{children}</VaultCtx.Provider>;
}

export function useVault() {
  const c = useContext(VaultCtx);
  if (!c) throw new Error('useVault outside provider');
  return c;
}

export function owns(v: Vault, account: string) {
  return v.ownerAddr === account.toLowerCase();
}

export function guards(v: Vault, account: string) {
  return v.guardians.some(g => g.addr.toLowerCase() === account.toLowerCase());
}

export function inherits(v: Vault, account: string) {
  return v.heirs.some(h => h.addr.toLowerCase() === account.toLowerCase());
}
