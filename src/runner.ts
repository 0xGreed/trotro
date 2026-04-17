import type { Config } from './config.js';
import type { SuiContext } from './client.js';
import type { SwapAdapter } from './aggregators/types.js';
import { scanPair } from './scanner.js';
import { execute } from './executor.js';
import { logger } from './logger.js';

export async function runLoop(
  cfg: Config,
  ctx: SuiContext,
  adapters: SwapAdapter[],
): Promise<void> {
  logger.info(
    { sender: ctx.sender, dryRun: cfg.dryRun, pairs: cfg.pairs.length, adapters: adapters.map((a) => a.name) },
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
    for (const pair of cfg.pairs) {
      if (stopping) break;
      try {
        const opp = await scanPair(adapters, pair);
        if (!opp) continue;
        if (opp.profitBps < cfg.profitBpsMin) {
          logger.debug({ profitBps: opp.profitBps }, 'below min profit threshold');
          continue;
        }
        const result = await execute(cfg, ctx, adapters, opp);
        logger.info({ result }, 'execution outcome');
      } catch (err) {
        logger.error({ err: String(err) }, 'pair cycle error');
      }
    }
    const elapsed = Date.now() - cycleStart;
    const wait = Math.max(0, cfg.pollIntervalMs - elapsed);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  logger.info('runner exited');
}
