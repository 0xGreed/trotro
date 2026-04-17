import { Scallop } from '@scallop-io/sui-scallop-sdk';
import type { Config } from './config.js';
import { getScallop } from './scallop.js';

export type LoanableCoin = {
  coinType: string;
  decimals: number;
  scallopName: string;
  symbol: string;
  coinPrice: number;
  supplyCoin: number;
};

let cache: LoanableCoin[] | null = null;

export async function loadLoanableCoins(cfg: Config): Promise<LoanableCoin[]> {
  if (cache) return cache;
  const { scallop } = await getScallop(cfg);
  const query = await scallop.createScallopQuery();
  const { pools } = await query.getMarketPools();
  const out: LoanableCoin[] = [];
  for (const pool of Object.values(pools)) {
    if (!pool) continue;
    out.push({
      coinType: pool.coinType,
      decimals: pool.coinDecimal,
      scallopName: pool.coinName,
      symbol: pool.symbol,
      coinPrice: pool.coinPrice,
      supplyCoin: pool.supplyCoin ?? 0,
    });
  }
  cache = out;
  return out;
}

export function resetLoanableCoinsCache() {
  cache = null;
}
