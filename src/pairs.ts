import type { Config, PairConfig, CoinSpec } from './config.js';
import { loadLoanableCoins, type LoanableCoin } from './scallop-coins.js';
import { fetchUsdPrices } from './prices.js';
import { logger } from './logger.js';

function usdToAtomic(usd: number, price: number, decimals: number): bigint {
  if (price <= 0 || !Number.isFinite(price)) return 0n;
  const amount = usd / price;
  const atomic = amount * 10 ** decimals;
  if (!Number.isFinite(atomic) || atomic <= 0) return 0n;
  return BigInt(Math.floor(atomic));
}

export async function buildPairs(cfg: Config): Promise<PairConfig[]> {
  const loanable = await loadLoanableCoins(cfg);
  if (loanable.length === 0) throw new Error('no loanable coins returned by Scallop');

  const bCandidates: CoinSpec[] = [
    ...loanable.map((c) => ({
      coinType: c.coinType,
      decimals: c.decimals,
      symbol: c.symbol,
    })),
    ...cfg.extraBCoins,
  ];

  // Pull USD prices for all coins involved so we can size notionals.
  const allTypes = Array.from(
    new Set([...loanable.map((c) => c.coinType), ...bCandidates.map((c) => c.coinType)]),
  );
  const prices = await fetchUsdPrices(allTypes);

  const loanableIndex = new Map<string, LoanableCoin>();
  for (const c of loanable) loanableIndex.set(c.coinType, c);

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
