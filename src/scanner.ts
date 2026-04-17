import type { PairConfig } from './config.js';
import type { SwapAdapter, Quote } from './aggregators/types.js';
import { logger } from './logger.js';

export type Opportunity = {
  pair: PairConfig;
  notional: bigint;
  leg1Quote: Quote;
  leg2Quote: Quote;
  profit: bigint;
  profitBps: number;
};

async function bestQuote(
  adapters: SwapAdapter[],
  from: string,
  to: string,
  amountIn: bigint,
): Promise<Quote | null> {
  const results = await Promise.allSettled(
    adapters.map((a) => a.quote(from, to, amountIn)),
  );
  let best: Quote | null = null;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (!best || r.value.amountOut > best.amountOut) best = r.value;
    } else {
      logger.debug({ err: String(r.reason) }, 'quote failed');
    }
  }
  return best;
}

export async function scanPair(
  adapters: SwapAdapter[],
  pair: PairConfig,
): Promise<Opportunity | null> {
  let best: Opportunity | null = null;
  for (const notional of pair.notionals) {
    const leg1 = await bestQuote(adapters, pair.a.coinType, pair.b.coinType, notional);
    if (!leg1) continue;
    const leg2 = await bestQuote(adapters, pair.b.coinType, pair.a.coinType, leg1.amountOut);
    if (!leg2) continue;
    const profit = leg2.amountOut - notional;
    const profitBps = Number((profit * 10_000n) / notional);
    logger.debug(
      {
        pair: `${pair.a.coinType}/${pair.b.coinType}`,
        notional: notional.toString(),
        leg1: leg1.adapter,
        leg2: leg2.adapter,
        profit: profit.toString(),
        profitBps,
      },
      'scan result',
    );
    if (profit > 0n && (!best || profit > best.profit)) {
      best = { pair, notional, leg1Quote: leg1, leg2Quote: leg2, profit, profitBps };
    }
  }
  return best;
}
