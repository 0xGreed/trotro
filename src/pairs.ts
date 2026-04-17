import type { Config, PairConfig, CoinSpec } from './config.js';
import { loadLoanableCoins } from './scallop-coins.js';
import { fetchUsdPrices } from './prices.js';
import { logger } from './logger.js';

const STABLE_SYMBOLS = new Set([
  'USDC', 'USDT', 'WUSDC', 'WUSDT', 'SBUSDT', 'USDY', 'USDSUI', 'FDUSD', 'DAI', 'BUCK', 'AUSD',
]);

function isStable(sym: string | undefined): boolean {
  return !!sym && STABLE_SYMBOLS.has(sym.toUpperCase());
}

function usdToAtomic(usd: number, price: number, decimals: number): bigint {
  if (price <= 0 || !Number.isFinite(price)) return 0n;
  const amount = usd / price;
  const atomic = amount * 10 ** decimals;
  if (!Number.isFinite(atomic) || atomic <= 0) return 0n;
  return BigInt(Math.floor(atomic));
}

export async function buildPairs(cfg: Config): Promise<PairConfig[]> {
  const allLoanable = await loadLoanableCoins(cfg);
  if (allLoanable.length === 0) throw new Error('no loanable coins returned by Scallop');

  // Rank by USD TVL using Aftermath prices (Scallop's coinPrice is often 0).
  const allTypes = Array.from(new Set([
    ...allLoanable.map((c) => c.coinType),
    ...cfg.extraBCoins.map((c) => c.coinType),
  ]));
  const prices = await fetchUsdPrices(allTypes);

  const withTvl = allLoanable.map((c) => {
    const price = prices[c.coinType] ?? c.coinPrice ?? 0;
    return { coin: c, price, tvlUsd: c.supplyCoin * price };
  });
  withTvl.sort((x, y) => y.tvlUsd - x.tvlUsd);
  const kept = cfg.topLoanable > 0 ? withTvl.slice(0, cfg.topLoanable) : withTvl;
  const loanable = kept.map((r) => r.coin);

  logger.info(
    {
      kept: loanable.length,
      total: allLoanable.length,
      topTvl: kept.map((r) => ({ sym: r.coin.symbol, tvl: Math.round(r.tvlUsd) })),
    },
    'loanable coins ranked by TVL',
  );

  const bCandidates: CoinSpec[] = [
    ...loanable.map((c) => ({
      coinType: c.coinType,
      decimals: c.decimals,
      symbol: c.symbol,
    })),
    ...cfg.extraBCoins,
  ];

  const pairs: PairConfig[] = [];
  for (const a of loanable) {
    const aPrice = prices[a.coinType] ?? a.coinPrice;
    if (!aPrice || aPrice < cfg.minPairPriceUsd) {
      logger.debug({ symbol: a.symbol, aPrice }, 'skip loanable coin: no usable price');
      continue;
    }
    const notionals = cfg.usdNotionals
      .map((usd) => usdToAtomic(usd, aPrice, a.decimals))
      .filter((x) => x > 0n);
    if (notionals.length === 0) continue;

    for (const b of bCandidates) {
      if (b.coinType === a.coinType) continue;
      if (isStable(a.symbol) && isStable(b.symbol)) continue;
      const bPrice = prices[b.coinType];
      if (!bPrice || bPrice < cfg.minPairPriceUsd) continue;

      pairs.push({
        a: {
          coinType: a.coinType,
          decimals: a.decimals,
          symbol: a.symbol,
          scallopName: a.scallopName,
        },
        b,
        notionals,
      });
    }
  }

  logger.info(
    { loanable: loanable.length, bCandidates: bCandidates.length, pairs: pairs.length },
    'pair universe built',
  );
  return pairs;
}
