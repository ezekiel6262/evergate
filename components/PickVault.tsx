'use client';
import { useState } from 'react';
import { guards, inherits, owns, useVault, Vault } from '@/lib/store';
import { useWallet } from '@/lib/wallet';

export function PickVault({ role, none, children }: {
  role: 'owner' | 'guardian' | 'heir';
  none: string;
  children: (vault: Vault) => React.ReactNode;
}) {
  const { account, connect, connecting, error: walletError } = useWallet();
  const { vaults, loading, error, keeper } = useVault();
  const [pick, setPick] = useState(0);

  if (!account) {
    return (
      <div className="empty">
        <h1>Connect your wallet</h1>
        <p>This page reads the account you connect on X Layer.</p>
        <button className="btn" onClick={connect} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect wallet'}</button>
        {walletError && <p className="warn-line">{walletError}</p>}
      </div>
    );
  }
  if (!keeper) {
    return (
      <div className="empty">
        <h1>No gate contract yet</h1>
        <p>{none}</p>
        <a className="btn" href="#setup">Set up a gate</a>
      </div>
    );
  }
  if (loading) return <p>Reading X Layer…</p>;
  if (error) return <p>{error}</p>;

  const list = vaults.filter(v => role === 'owner' ? owns(v, account) : role === 'guardian' ? guards(v, account) : inherits(v, account));
  if (!list.length) {
    return (
      <div className="empty">
        <h1>{none}</h1>
        {role === 'owner' && <a className="btn" href="#setup">Set up a gate</a>}
      </div>
    );
  }
  const vault = list[Math.min(pick, list.length - 1)];
  return (
    <>
      {list.length > 1 && (
        <div className="picks">
          {list.map((v, i) => (
            <button key={v.id} className={v.id === vault.id ? 'on' : ''} onClick={() => setPick(i)}>Gate {v.id}</button>
          ))}
        </div>
      )}
      {children(vault)}
    </>
  );
}
