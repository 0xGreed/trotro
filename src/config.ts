import 'dotenv/config';

export type CoinSpec = {
  coinType: string;
  decimals: number;
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
  slippageBps: number;
  pollIntervalMs: number;
  pairs: PairConfig[];
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) throw new Error(`Missing env: ${name}`);
  return v;
}

const USDC: CoinSpec & { scallopName: string } = {
  coinType: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  decimals: 6,
  scallopName: 'usdc',
};

const SUI: CoinSpec = {
  coinType: '0x2::sui::SUI',
  decimals: 9,
};

const USDT: CoinSpec = {
  coinType: '0x2::usdt::USDT',
  decimals: 6,
};

export function loadConfig(): Config {
  return {
    grpcUrl: requireEnv('GRPC_URL'),
    grpcToken: requireEnv('GRPC_X_TOKEN'),
    privateKey: requireEnv('PRIVATE_KEY'),
    scallopAddressId: requireEnv('SCALLOP_ADDRESS_ID'),
    dryRun: (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false',
    profitBpsMin: Number(process.env.PROFIT_BPS_MIN ?? 5),
    slippageBps: Number(process.env.SLIPPAGE_BPS ?? 30),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
    pairs: [
      {
        a: USDC,
        b: SUI,
        notionals: [100n * 10n ** 6n, 1000n * 10n ** 6n, 10_000n * 10n ** 6n],
      },
      {
        a: USDC,
        b: USDT,
        notionals: [1000n * 10n ** 6n, 10_000n * 10n ** 6n, 100_000n * 10n ** 6n],
      },
    ],
  };
}
