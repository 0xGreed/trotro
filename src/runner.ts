import type { Config, PairConfig } from './config.js';
import type { SuiContext } from './client.js';
import type { SwapAdapter } from './aggregators/types.js';
import { scanPair, scanPairAtNotional, type Opportunity } from './scanner.js';
import { execute } from './executor.js';
import { buildPairs } from './pairs.js';
import { logger } from './logger.js';

function pairLabel(p: PairConfig): string {
  return `${p.a.symbol ?? p.a.coinType}/${p.b.symbol ?? p.b.coinType}`;
}

async function processPair(
  cfg: Config,
  ctx: SuiContext,
  adapters: SwapAdapter[],
  pair: PairConfig,
): Promise<void> {
  // Phase 1: cheap prefilter at smallest notional only.
  const smallest = pair.notionals[0];
  if (smallest === undefined) return;
  let prefilter: Opportunity | null;
  try {
    prefilter = await scanPairAtNotional(adapters, pair, smallest);
  } catch (err) {
    logger.debug({ pair: pairLabel(pair), err: String(err) }, 'prefilter error');
    return;
  }
  if (!prefilter || prefilter.profitBps < cfg.prefilterBps) return;

  logger.info(
    {
      pair: pairLabel(pair),
      prefilterBps: prefilter.profitBps,
      leg1: prefilter.leg1Quote.adapter,
      leg2: prefilter.leg2Quote.adapter,
    },
    'prefilter hit; running full sweep',
  );

  // Phase 2: full multi-notional sweep.
  let best: Opportunity | null;
  try {
    best = await scanPair(adapters, pair, pair.notionals);
  } catch (err) {
    logger.error({ pair: pairLabel(pair), err: String(err) }, 'full scan error');
    return;
  }
  if (!best || best.profitBps < cfg.profitBpsMin) return;
  if (best.profitUsd < cfg.minProfitUsd) {
    logger.debug(
      {
        pair: pairLabel(pair),
        profitUsd: best.profitUsd,
        minProfitUsd: cfg.minProfitUsd,
      },
      'skip: profit below USD minimum',
    );
    return;
  }

  try {
    const result = await execute(cfg, ctx, adapters, best);
    logger.info({ pair: pairLabel(pair), result }, 'execution outcome');
  } catch (err) {
    logger.error({ pair: pairLabel(pair), err: String(err) }, 'executor error');
  }
}

export async function runLoop(
  cfg: Config,
  ctx: SuiContext,
  adapters: SwapAdapter[],
): Promise<void> {
  const pairs = await buildPairs(cfg);

  logger.info(
    {
      sender: ctx.sender,
      dryRun: cfg.dryRun,
      pairs: pairs.length,
      adapters: adapters.map((a) => a.name),
    },
    'arbitrage loop starting',
  );

  let stopping = false;
  const onSignal = () => {
    logger.info('shutdown signal received');
    stopping = true;
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  while (!stopping) {
    const cycleStart = Date.now();
    for (const pair of pairs) {
      if (stopping) break;
      await processPair(cfg, ctx, adapters, pair);
    }
    const elapsed = Date.now() - cycleStart;
    logger.debug({ elapsedMs: elapsed, pairs: pairs.length }, 'cycle done');
    const wait = Math.max(0, cfg.pollIntervalMs - elapsed);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  logger.info('runner exited');
}
