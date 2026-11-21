import { decodeEventLog, type Address, type Hash, type Hex, type TransactionReceipt, type WalletClient } from 'viem';
import { compileTemplate, compileWrapper, encode } from './netlist';
import { tapeoutCalldata, TAPEOUT_FEE_WEI } from './tapeout';
import {
  OPENER, circuitsAbi, erc20Abi, explain, keeperAbi, openerAbi, publicClient, shortAddr, xlayer,
} from './chain';
import { KEEPER_BYTECODE } from './keeperBytecode';

export type PublishStep = { label: string; status: 'pending' | 'active' | 'done' };

export type PublishDraft = {
  processor: Address | null;
  keeper: Address | null;
  templateId: bigint | null;
  circuitId: bigint | null;
  guardians: [Address, Address, Address];
  heirs: { account: Address; bps: number }[];
  quorum: number;
  intervalDays: number;
  missesAllowed: number;
  waitDays: number;
  sends: { token: Address | null; amount: bigint; sym: string }[];
  tokens: Address[];
};

export type Published = {
  keeper: Address;
  vaultId: bigint;
  wallet: Address;
  templateId: bigint | null;
  circuitId: bigint;
};

const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';

function report(labels: string[], active: number, onStep: (steps: PublishStep[]) => void) {
  onStep(labels.map((label, i) => ({
    label,
    status: i < active ? 'done' : i === active ? 'active' : 'pending',
  })));
}

async function ownedProcessor(processor: Address, account: Address) {
  try {
    const owner = await publicClient.readContract({ address: processor, abi: circuitsAbi, functionName: 'owner' });
    if (owner.toLowerCase() !== account.toLowerCase()) {
      throw new Error(`That processor is owned by ${shortAddr(owner)}. Connect that wallet.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('That processor')) throw error;
  }
}

async function tape(wallet: WalletClient, account: Address, processor: Address, nIn: number, nOut: number, raw: Uint8Array) {
  const expected = await publicClient.readContract({ address: processor, abi: circuitsAbi, functionName: 'nextId' });
  const hash = await wallet.sendTransaction({
    account,
    chain: xlayer,
    to: processor,
    data: tapeoutCalldata(nIn, nOut, raw) as Hex,
    value: TAPEOUT_FEE_WEI,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Publishing the rule failed.');
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== processor.toLowerCase()) continue;
    if (log.topics[1]?.toLowerCase() !== ZERO) continue;
    if (log.topics[3]) return BigInt(log.topics[3]);
  }
  const owner = await publicClient.readContract({ address: processor, abi: circuitsAbi, functionName: 'ownerOf', args: [expected] }).catch(() => null);
  if (owner && owner.toLowerCase() === account.toLowerCase()) return expected;
  throw new Error('The rule was published, but its number was not in the receipt.');
}

async function write(wallet: WalletClient, account: Address, hash: Promise<Hash>) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: await hash });
  if (receipt.status !== 'success') throw new Error('The transaction failed.');
  return receipt;
}

function vaultIdFrom(receipt: TransactionReceipt, keeper: Address, fallback: bigint) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== keeper.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: keeperAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'Created') return ev.args.vaultId;
    } catch { /* not this event */ }
  }
  return fallback;
}

export async function publishGate(
  wallet: WalletClient,
  account: Address,
  draft: PublishDraft,
  onStep: (steps: PublishStep[]) => void,
): Promise<Published> {
  const sends = draft.sends.filter(s => s.amount > 0n);
  const labels = [
    ...(!draft.keeper ? ['Publishing the Evergate contract'] : []),
    ...(!draft.circuitId && !draft.templateId ? ['Publishing the shared rule'] : []),
    ...(!draft.circuitId ? ['Publishing your rule'] : []),
    'Letting the contract hold the rule',
    'Opening the gate',
    ...sends.map(s => `Sending ${s.sym} into the gate`),
  ];
  let step = 0;
  const advance = () => report(labels, step, onStep);
  advance();

  let keeper = draft.keeper;
  let templateId = draft.templateId;
  let circuitId = draft.circuitId;

  try {
    if (!keeper) {
      if (!draft.processor) throw new Error('Enter the processor that will publish this rule.');
      if (!KEEPER_BYTECODE) throw new Error('The Evergate contract is not bundled in this build. Paste its address, or compile it first.');
      await ownedProcessor(draft.processor, account);
      const hash = await wallet.deployContract({
        abi: keeperAbi,
        bytecode: KEEPER_BYTECODE,
        args: [draft.processor, OPENER],
        account,
        chain: xlayer,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('The contract was sent, but no address came back.');
      keeper = receipt.contractAddress;
      step++;
      advance();
    }

    if (!circuitId) {
      if (!draft.processor) throw new Error('Enter the processor that will publish this rule.');
      await ownedProcessor(draft.processor, account);
      if (!templateId) {
        const net = compileTemplate();
        templateId = await tape(wallet, account, draft.processor, net.nIn, net.nOut, encode(net));
        step++;
        advance();
      }
      const wrap = compileWrapper(draft.processor, templateId, draft.missesAllowed, draft.quorum);
      circuitId = await tape(wallet, account, draft.processor, wrap.nIn, wrap.nOut, encode(wrap));
      step++;
      advance();
    }

    const processor = await publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'circuits' });
    await write(wallet, account, wallet.writeContract({
      address: processor,
      abi: circuitsAbi,
      functionName: 'setApprovalForAll',
      args: [keeper, true],
      account,
      chain: xlayer,
    }));
    step++;
    advance();

    const opened = await publicClient.readContract({
      address: OPENER, abi: openerAbi, functionName: 'isOpened', args: [processor, circuitId],
    });
    const fee = opened ? 0n : await publicClient.readContract({ address: OPENER, abi: openerAbi, functionName: 'FEE' });
    const nextId = await publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'nextVaultId' });
    const created = await write(wallet, account, wallet.writeContract({
      address: keeper,
      abi: keeperAbi,
      functionName: 'create',
      args: [{
        circuitId,
        interval: BigInt(draft.intervalDays * 86400),
        waitPeriod: BigInt(draft.waitDays * 86400),
        n: draft.missesAllowed,
        k: draft.quorum,
        guardians: draft.guardians,
        heirs: draft.heirs,
        tokens: draft.tokens,
      }],
      value: fee,
      account,
      chain: xlayer,
    }));
    const vaultId = vaultIdFrom(created, keeper, nextId);
    const gateWallet = await publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'walletOf', args: [vaultId] });
    step++;
    advance();

    for (const send of sends) {
      if (send.token) {
        await write(wallet, account, wallet.writeContract({
          address: send.token,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [gateWallet, send.amount],
          account,
          chain: xlayer,
        }));
      } else {
        const hash = await wallet.sendTransaction({ account, chain: xlayer, to: gateWallet, value: send.amount });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error(`Sending ${send.sym} failed.`);
      }
      step++;
      advance();
    }
    report(labels, labels.length, onStep);
    return { keeper, vaultId, wallet: gateWallet, templateId, circuitId };
  } catch (error) {
    throw new Error(explain(error));
  }
}
