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

export async function scanPairAtNotional(
  adapters: SwapAdapter[],
  pair: PairConfig,
  notional: bigint,
): Promise<Opportunity | null> {
  const leg1 = await bestQuote(adapters, pair.a.coinType, pair.b.coinType, notional);
  if (!leg1) return null;
  const leg2 = await bestQuote(adapters, pair.b.coinType, pair.a.coinType, leg1.amountOut);
  if (!leg2) return null;
  const profit = leg2.amountOut - notional;
  const profitBps = Number((profit * 10_000n) / notional);
  return { pair, notional, leg1Quote: leg1, leg2Quote: leg2, profit, profitBps };
}

export async function scanPair(
  adapters: SwapAdapter[],
  pair: PairConfig,
  notionals: bigint[] = pair.notionals,
): Promise<Opportunity | null> {
  let best: Opportunity | null = null;
  for (const notional of notionals) {
    const opp = await scanPairAtNotional(adapters, pair, notional);
    if (!opp) continue;
    logger.debug(
      {
        pair: `${pair.a.symbol ?? pair.a.coinType}/${pair.b.symbol ?? pair.b.coinType}`,
        notional: notional.toString(),
        leg1: opp.leg1Quote.adapter,
        leg2: opp.leg2Quote.adapter,
        profit: opp.profit.toString(),
        profitBps: opp.profitBps,
      },
      'scan result',
    );
    if (opp.profit > 0n && (!best || opp.profit > best.profit)) {
      best = opp;
    }
  }
  return best;
}
