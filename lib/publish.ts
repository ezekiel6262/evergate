import { decodeEventLog, formatUnits, type Address, type Hash, type Hex, type TransactionReceipt, type WalletClient } from 'viem';
import { compile, compileTemplate, compileWrapper, encode } from './netlist';
import { tapeoutCalldata, TAPEOUT_FEE_WEI } from './tapeout';
import {
  BEM_UNIT_LIMIT, FACTORY, OPENER, bemToken, circuitsAbi, erc20Abi, explain, factoryAbi, keeperAbi, openerAbi, publicClient, shortAddr, transistorsAbi, xlayer,
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
const CPU_NAME = 'Evergate';
const CPU_SYMBOL = 'GATE';
const CPU_STORY = 'A rule that outlives its owner.';
const CPU_SUPPLY = 10_000n;

/** How many mint calls the shared rule needs, and how many parts those calls buy. */
export function sharedRuleParts(): { calls: number; units: bigint } {
  const built = compile(compileTemplate());
  return {
    calls: (built.topNand > 0 ? 1 : 0) + (built.topLatch > 0 ? 1 : 0),
    units: BigInt(built.topNand + built.topLatch),
  };
}

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

async function bemLabel(amount: bigint) {
  const token = await bemToken();
  const decimals = Number(await publicClient.readContract({
    address: token, abi: erc20Abi, functionName: 'decimals',
  }).catch(() => 8));
  return `${formatUnits(amount, decimals)} BEM`;
}

/** Sets the BEM allowance to `needed` when it is short. Sends nothing when it already covers the fee. */
async function approveBem(wallet: WalletClient, account: Address, spender: Address, needed: bigint) {
  if (needed === 0n) return;
  const token = await bemToken();
  const current = await publicClient.readContract({
    address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender],
  });
  if (current >= needed) return;
  const balance = await publicClient.readContract({
    address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account],
  });
  if (balance < needed) {
    throw new Error(`This step needs ${await bemLabel(needed)}. Your wallet holds ${await bemLabel(balance)}.`);
  }
  await write(wallet, account, wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, needed],
    account,
    chain: xlayer,
  }));
}

async function createProcessor(wallet: WalletClient, account: Address) {
  const receipt = await write(wallet, account, wallet.writeContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'createCPU',
    args: [CPU_NAME, CPU_SYMBOL, CPU_STORY, CPU_SUPPLY, 0n],
    value: 0n,
    account,
    chain: xlayer,
  }));
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== FACTORY.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'CPUCreated' && ev.args.creator.toLowerCase() === account.toLowerCase()) {
        return { circuits: ev.args.circuits, transistors: ev.args.transistors };
      }
    } catch { /* not this event */ }
  }
  throw new Error('The processor was created, but its address was not in the receipt.');
}

async function transistorsOf(processor: Address, hinted: Address | null) {
  try {
    return await publicClient.readContract({ address: processor, abi: circuitsAbi, functionName: 'transistors' });
  } catch {
    if (hinted) return hinted;
    throw new Error('The processor did not name its parts contract.');
  }
}

async function partId(transistors: Address, name: 'NAND' | 'LATCH', fallback: bigint) {
  try {
    return await publicClient.readContract({ address: transistors, abi: transistorsAbi, functionName: name });
  } catch {
    return fallback;
  }
}

async function partJobs(transistors: Address, account: Address, nand: number, latch: number) {
  const nandId = await partId(transistors, 'NAND', 0n);
  const latchId = await partId(transistors, 'LATCH', 1n);
  const jobs: { id: bigint; amount: bigint }[] = [];
  for (const [id, need] of [[nandId, BigInt(nand)], [latchId, BigInt(latch)]] as const) {
    if (need === 0n) continue;
    const balance = await publicClient.readContract({
      address: transistors, abi: transistorsAbi, functionName: 'balanceOf', args: [account, id],
    });
    if (balance < need) jobs.push({ id, amount: need - balance });
  }
  return jobs;
}

async function mintParts(wallet: WalletClient, account: Address, transistors: Address, nand: number, latch: number) {
  const jobs = await partJobs(transistors, account, nand, latch);
  if (jobs.length === 0) return;
  const protocolFee = await publicClient.readContract({ address: transistors, abi: transistorsAbi, functionName: 'protocolFee' });
  const mintPrice = await publicClient.readContract({ address: transistors, abi: transistorsAbi, functionName: 'mintPrice' });
  const pricedInBem = protocolFee < BEM_UNIT_LIMIT && mintPrice < BEM_UNIT_LIMIT;
  if (pricedInBem) {
    let cost = 0n;
    for (const job of jobs) cost += protocolFee + mintPrice * job.amount;
    await approveBem(wallet, account, transistors, cost);
  }
  for (const job of jobs) {
    const value = pricedInBem ? 0n : mintPrice * job.amount + protocolFee;
    await write(wallet, account, wallet.writeContract({
      address: transistors,
      abi: transistorsAbi,
      functionName: 'mint',
      args: [job.id, job.amount],
      value,
      account,
      chain: xlayer,
    }));
  }
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
  let keeper = draft.keeper;
  let templateId = draft.templateId;
  let circuitId = draft.circuitId;
  let processor = draft.processor;
  let made: Address | null = null;

  try {
    if (keeper) {
      const bound = await publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'circuits' });
      if (processor && bound.toLowerCase() !== processor.toLowerCase()) {
        throw new Error('That Evergate contract uses a different processor.');
      }
      processor = bound;
    }

    const creating = !processor;
    if (creating && (templateId || circuitId)) {
      throw new Error('Enter the processor that already holds this rule.');
    }

    let nand = 0;
    let latch = 0;
    if (!circuitId && !templateId) {
      const built = compile(compileTemplate());
      nand = built.topNand;
      latch = built.topLatch;
    }

    let deployFee = 0n;
    let needApprove = false;
    if (creating) {
      deployFee = await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'deployFee' });
      if (deployFee > 0n) {
        const token = await bemToken();
        const allowance = await publicClient.readContract({
          address: token, abi: erc20Abi, functionName: 'allowance', args: [account, FACTORY],
        });
        needApprove = allowance < deployFee;
      }
    }

    let needParts = false;
    if (nand > 0 || latch > 0) {
      if (creating) needParts = true;
      else if (processor) {
        const transistors = await transistorsOf(processor, null);
        needParts = (await partJobs(transistors, account, nand, latch)).length > 0;
      }
    }

    const labels = [
      ...(needApprove ? ['Approving the processor fee'] : []),
      ...(creating ? ['Creating your processor'] : []),
      ...(!keeper ? ['Publishing the Evergate contract'] : []),
      ...(needParts ? ['Getting the parts for the rule'] : []),
      ...(!circuitId && !templateId ? ['Publishing the shared rule'] : []),
      ...(!circuitId ? ['Publishing your rule'] : []),
      'Letting the contract hold the rule',
      'Opening the gate',
      ...sends.map(s => `Sending ${s.sym} into the gate`),
    ];
    let step = 0;
    const advance = () => report(labels, step, onStep);
    advance();

    if (needApprove) {
      await approveBem(wallet, account, FACTORY, deployFee);
      step++;
      advance();
    }

    let hinted: Address | null = null;
    if (creating) {
      const created = await createProcessor(wallet, account);
      processor = created.circuits;
      hinted = created.transistors;
      made = created.circuits;
      step++;
      advance();
    }
    if (!processor) throw new Error('Enter the processor that will publish this rule.');

    if (!keeper) {
      if (!creating) await ownedProcessor(processor, account);
      if (!KEEPER_BYTECODE) throw new Error('The Evergate contract is not bundled in this build. Paste its address, or compile it first.');
      const hash = await wallet.deployContract({
        abi: keeperAbi,
        bytecode: KEEPER_BYTECODE,
        args: [processor, OPENER],
        account,
        chain: xlayer,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error('The contract was sent, but no address came back.');
      keeper = receipt.contractAddress;
      step++;
      advance();
    } else if (!creating && !circuitId) {
      await ownedProcessor(processor, account);
    }

    if (needParts) {
      await mintParts(wallet, account, await transistorsOf(processor, hinted), nand, latch);
      step++;
      advance();
    }

    if (!circuitId && !templateId) {
      const net = compileTemplate();
      templateId = await tape(wallet, account, processor, net.nIn, net.nOut, encode(net));
      step++;
      advance();
    }

    if (!circuitId) {
      if (!templateId) throw new Error('The shared rule number is missing.');
      const wrap = compileWrapper(processor, templateId, draft.missesAllowed, draft.quorum);
      circuitId = await tape(wallet, account, processor, wrap.nIn, wrap.nOut, encode(wrap));
      step++;
      advance();
    }

    const bound = await publicClient.readContract({ address: keeper, abi: keeperAbi, functionName: 'circuits' });
    if (bound.toLowerCase() !== processor.toLowerCase()) {
      throw new Error('That Evergate contract uses a different processor.');
    }
    await write(wallet, account, wallet.writeContract({
      address: bound,
      abi: circuitsAbi,
      functionName: 'setApprovalForAll',
      args: [keeper, true],
      account,
      chain: xlayer,
    }));
    step++;
    advance();

    const opened = await publicClient.readContract({
      address: OPENER, abi: openerAbi, functionName: 'isOpened', args: [bound, circuitId],
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
    const msg = explain(error);
    const extra: string[] = [];
    if (made && made !== draft.processor) extra.push(`Your processor is ${made}. Paste it and continue.`);
    if (!draft.keeper && keeper) extra.push(`Your Evergate contract is ${keeper}. Paste it and continue.`);
    if (!draft.templateId && templateId) extra.push(`Your shared rule number is ${templateId.toString()}. Paste it and continue.`);
    if (!draft.circuitId && circuitId) extra.push(`Your rule number is ${circuitId.toString()}. Paste it and continue.`);
    throw new Error(extra.length ? `${msg} ${extra.join(' ')}` : msg);
  }
}
