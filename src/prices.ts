import { Aftermath } from 'aftermath-ts-sdk';

type PricesApi = ReturnType<Aftermath['Prices']>;

let sdk: Aftermath | null = null;
let prices: PricesApi | null = null;
let initPromise: Promise<void> | null = null;

async function ensureReady(): Promise<PricesApi> {
  if (prices) return prices;
  if (!sdk) sdk = new Aftermath('MAINNET');
  if (!initPromise) initPromise = sdk.init();
  await initPromise;
  prices = sdk.Prices();
  return prices;
}

export async function fetchUsdPrices(coinTypes: string[]): Promise<Record<string, number>> {
  if (coinTypes.length === 0) return {};
  const p = await ensureReady();
  const unique = Array.from(new Set(coinTypes));
  return p.getCoinsToPrice({ coins: unique });
}
