import { createPublicClient, defineChain, http, isAddress, type Address, type PublicClient } from 'viem';

export const xlayer = defineChain({
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.xlayer.tech'] } },
  blockExplorers: { default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer' } },
});

/** Brain-wallet opener. open(address,uint256) costs FEE(), read earlier as 0.08 OKB. */
export const OPENER: Address = '0x536add8f30f03b69f6fbf29d425a816a0dc50106';

/** USDT0 on X Layer, the Tether token named by X Layer. */
export const USDT0: Address = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';

/** Value attached to each brain-wallet execute. The account rejects less. */
export const EXEC_FEE = 1_300_000_000_000_000n;

export const KEEPER_KEY = 'evergate.keeper';
export const TEMPLATE_KEY = 'evergate.template';

export const publicClient: PublicClient = createPublicClient({ chain: xlayer, transport: http(xlayer.rpcUrls.default.http[0]) });

export function asAddress(value: string): Address | null {
  const t = value.trim();
  return isAddress(t) ? t : null;
}

export function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function sameAddr(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const openerAbi = [
  { type: 'function', name: 'FEE', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'accountOf', stateMutability: 'view', inputs: [{ name: 'circuits', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'isOpened', stateMutability: 'view', inputs: [{ name: 'circuits', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const circuitsAbi = [
  { type: 'function', name: 'nextId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'tapeout', stateMutability: 'payable', inputs: [{ name: 'netlist', type: 'bytes' }, { name: 'nIn', type: 'uint32' }, { name: 'nOut', type: 'uint32' }], outputs: [] },
] as const;

const heir = [
  { name: 'account', type: 'address' },
  { name: 'bps', type: 'uint16' },
] as const;

const plan = [
  { name: 'circuitId', type: 'uint256' },
  { name: 'interval', type: 'uint64' },
  { name: 'waitPeriod', type: 'uint64' },
  { name: 'n', type: 'uint8' },
  { name: 'k', type: 'uint8' },
  { name: 'guardians', type: 'address[3]' },
  { name: 'heirs', type: 'tuple[]', components: heir },
  { name: 'tokens', type: 'address[]' },
] as const;

export const keeperAbi = [
  { type: 'constructor', stateMutability: 'nonpayable', inputs: [{ name: 'circuits_', type: 'address' }, { name: 'opener_', type: 'address' }] },
  { type: 'function', name: 'nextVaultId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'circuits', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'vaults', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'circuitId', type: 'uint256' },
      { name: 'lastCheckIn', type: 'uint64' },
      { name: 'alertAt', type: 'uint64' },
      { name: 'interval', type: 'uint64' },
      { name: 'waitPeriod', type: 'uint64' },
      { name: 'n', type: 'uint8' },
      { name: 'k', type: 'uint8' },
      { name: 'state', type: 'uint8' },
      { name: 'approvals', type: 'uint8' },
    ],
  },
  { type: 'function', name: 'heirsOf', stateMutability: 'view', inputs: [{ name: 'vaultId', type: 'uint256' }], outputs: [{ type: 'tuple[]', components: heir }] },
  { type: 'function', name: 'tokensOf', stateMutability: 'view', inputs: [{ name: 'vaultId', type: 'uint256' }], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'guardiansOf', stateMutability: 'view', inputs: [{ name: 'vaultId', type: 'uint256' }], outputs: [{ type: 'address[3]' }] },
  { type: 'function', name: 'walletOf', stateMutability: 'view', inputs: [{ name: 'vaultId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'preview', stateMutability: 'view', inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [
      { name: 'missed', type: 'uint256' },
      { name: 'waitElapsed', type: 'bool' },
      { name: 'next', type: 'uint8' },
      { name: 'alert', type: 'bool' },
      { name: 'release', type: 'bool' },
    ],
  },
  { type: 'function', name: 'create', stateMutability: 'payable', inputs: [{ name: 'plan', type: 'tuple', components: plan }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'checkIn', stateMutability: 'nonpayable', inputs: [{ name: 'vaultId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'vaultId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'payable', inputs: [{ name: 'vaultId', type: 'uint256' }, { name: 'execFee', type: 'uint256' }], outputs: [] },
  {
    type: 'function', name: 'withdraw', stateMutability: 'payable',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'execFee', type: 'uint256' },
    ],
    outputs: [],
  },
  { type: 'event', name: 'Created', inputs: [{ name: 'vaultId', type: 'uint256', indexed: true }, { name: 'circuitId', type: 'uint256', indexed: true }, { name: 'owner', type: 'address', indexed: true }] },
  { type: 'error', name: 'Fee', inputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { type: 'error', name: 'Pin', inputs: [] },
  { type: 'error', name: 'NotOwner', inputs: [] },
  { type: 'error', name: 'NotGuardian', inputs: [] },
  { type: 'error', name: 'NotActive', inputs: [] },
  { type: 'error', name: 'NotAlert', inputs: [] },
  { type: 'error', name: 'NotClaimable', inputs: [] },
  { type: 'error', name: 'Released', inputs: [] },
  { type: 'error', name: 'TooLate', inputs: [] },
  { type: 'error', name: 'BadPlan', inputs: [] },
  { type: 'error', name: 'CircuitUsed', inputs: [] },
  { type: 'error', name: 'NoVault', inputs: [] },
] as const;

export function explain(error: unknown) {
  const msg = error && typeof error === 'object' && 'shortMessage' in error && typeof error.shortMessage === 'string'
    ? error.shortMessage
    : error instanceof Error ? error.message : 'The transaction failed.';
  if (/user rejected|user denied|rejected the request/i.test(msg)) return 'The wallet closed the request.';
  return msg;
}
