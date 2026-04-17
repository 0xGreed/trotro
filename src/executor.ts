import type { Config } from './config.js';
import type { SuiContext } from './client.js';
import type { SwapAdapter } from './aggregators/types.js';
import type { Opportunity } from './scanner.js';
import { getScallop, newTxBlock, borrow, repay } from './scallop.js';
import { logger } from './logger.js';

export type ExecutionResult =
  | { kind: 'skipped'; reason: string }
  | { kind: 'simulated'; simulatedProfit: bigint }
  | { kind: 'executed'; digest: string; simulatedProfit: bigint };

function findAdapter(adapters: SwapAdapter[], name: string): SwapAdapter {
  const a = adapters.find((x) => x.name === name);
  if (!a) throw new Error(`adapter not found: ${name}`);
  return a;
}

export async function execute(
  cfg: Config,
  ctx: SuiContext,
  adapters: SwapAdapter[],
  opp: Opportunity,
): Promise<ExecutionResult> {
  if (opp.profitBps < cfg.profitBpsMin) {
    return { kind: 'skipped', reason: `profit ${opp.profitBps} bps < min ${cfg.profitBpsMin}` };
  }

  const { builder } = await getScallop(cfg);
  const stb = newTxBlock(builder);
  const tx = stb.txBlock;

  const leg1 = findAdapter(adapters, opp.leg1Quote.adapter);
  const leg2 = findAdapter(adapters, opp.leg2Quote.adapter);

  const [borrowed, loan] = borrow(stb, opp.notional, opp.pair.a.scallopName);

  const coinB = await leg1.appendSwap({
    tx,
    sender: ctx.sender,
    coinIn: borrowed,
    quote: opp.leg1Quote,
    slippageBps: cfg.slippageBps,
  });

  const coinA2 = await leg2.appendSwap({
    tx,
    sender: ctx.sender,
    coinIn: coinB,
    quote: opp.leg2Quote,
    slippageBps: cfg.slippageBps,
  });

  const [repayCoin] = tx.splitCoins(coinA2, [tx.pure.u64(opp.notional)]);
  repay(stb, repayCoin, loan, opp.pair.a.scallopName);
  tx.transferObjects([coinA2], tx.pure.address(ctx.sender));

  tx.setSender(ctx.sender);

  const bytes = await tx.build({ client: ctx.client });

  const dry = await ctx.client.core.dryRunTransaction({ transaction: bytes });
  const status = dry.transaction.effects.status;
  if (!status.success) {
    return { kind: 'skipped', reason: `dryRun failed: ${status.error ?? 'unknown'}` };
  }

  logger.info(
    {
      leg1: leg1.name,
      leg2: leg2.name,
      notional: opp.notional.toString(),
      profit: opp.profit.toString(),
      profitBps: opp.profitBps,
    },
    'dry-run profitable arb',
  );

  if (cfg.dryRun) {
    return { kind: 'simulated', simulatedProfit: opp.profit };
  }

  const signed = await ctx.keypair.signTransaction(bytes);
  const res = await ctx.client.core.executeTransaction({
    transaction: bytes,
    signatures: [signed.signature],
  });
  logger.info({ digest: res.transaction.digest }, 'arb submitted');
  return { kind: 'executed', digest: res.transaction.digest, simulatedProfit: opp.profit };
}
