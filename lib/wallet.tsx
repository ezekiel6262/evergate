'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createWalletClient, custom, type Address, type WalletClient } from 'viem';
import { xlayer } from './chain';

type Injected = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

type WalletApi = {
  account: Address | null;
  wallet: WalletClient | null;
  connecting: boolean;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<WalletApi | null>(null);

function injected(): Injected | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { okxwallet?: Injected; ethereum?: Injected };
  return w.okxwallet || w.ethereum || null;
}

const CHAIN = '0xc4';

async function ensureChain(provider: Injected) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN }] });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 0;
    if (code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN,
        chainName: 'X Layer',
        nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
        rpcUrls: ['https://rpc.xlayer.tech'],
        blockExplorerUrls: ['https://www.oklink.com/xlayer'],
      }],
    });
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const adopt = useCallback(async (provider: Injected, address: Address) => {
    await ensureChain(provider);
    setAccount(address);
    setWallet(createWalletClient({ account: address, chain: xlayer, transport: custom(provider) }));
  }, []);

  const connect = useCallback(async () => {
    const provider = injected();
    if (!provider) {
      setError('Install OKX Wallet, then connect it.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts[0]) throw new Error('The wallet returned no account.');
      await adopt(provider, accounts[0] as Address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setConnecting(false);
    }
  }, [adopt]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setWallet(null);
  }, []);

  useEffect(() => {
    const provider = injected();
    if (!provider) return;
    provider.request({ method: 'eth_accounts' }).then(async accounts => {
      const list = accounts as string[];
      if (list[0]) await adopt(provider, list[0] as Address);
    }).catch(() => {});
    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      if (!list[0]) disconnect();
      else void adopt(provider, list[0] as Address);
    };
    const eth = provider as Injected & { on?: (ev: string, fn: (a: unknown) => void) => void; removeListener?: (ev: string, fn: (a: unknown) => void) => void };
    eth.on?.('accountsChanged', onAccounts);
    return () => eth.removeListener?.('accountsChanged', onAccounts);
  }, [adopt, disconnect]);

  const api = useMemo<WalletApi>(() => ({ account, wallet, connecting, error, connect, disconnect }), [account, wallet, connecting, error, connect, disconnect]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWallet outside provider');
  return c;
}
