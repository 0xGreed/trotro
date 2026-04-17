import 'dotenv/config';

export type CoinSpec = {
  coinType: string;
  decimals: number;
  symbol?: string;
  scallopName?: string;
};

export type PairConfig = {
  a: CoinSpec & { scallopName: string };
  b: CoinSpec;
  notionals: bigint[];
};

export type Config = {
  grpcUrl: string;
  grpcToken: string;
  privateKey: string;
  scallopAddressId: string;
  dryRun: boolean;
  profitBpsMin: number;
  prefilterBps: number;
  slippageBps: number;
  pollIntervalMs: number;
  usdNotionals: number[];
  minPairPriceUsd: number;
  topLoanable: number;
  extraBCoins: CoinSpec[];
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseNumberList(s: string | undefined, fallback: number[]): number[] {
  if (!s) return fallback;
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
}

export function loadConfig(): Config {
  return {
    grpcUrl: requireEnv('GRPC_URL'),
    grpcToken: requireEnv('GRPC_X_TOKEN'),
    privateKey: requireEnv('PRIVATE_KEY'),
    scallopAddressId: requireEnv('SCALLOP_ADDRESS_ID'),
    dryRun: (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false',
    profitBpsMin: Number(process.env.PROFIT_BPS_MIN ?? 50),
    prefilterBps: Number(process.env.PREFILTER_BPS ?? 10),
    slippageBps: Number(process.env.SLIPPAGE_BPS ?? 30),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
    usdNotionals: parseNumberList(process.env.USD_NOTIONALS, [100, 1000, 10_000]),
    minPairPriceUsd: Number(process.env.MIN_PAIR_PRICE_USD ?? 0.0001),
    topLoanable: Number(process.env.TOP_LOANABLE ?? 10),
    extraBCoins: [],
  };
}
