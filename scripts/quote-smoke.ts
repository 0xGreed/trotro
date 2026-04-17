import { loadConfig } from '../src/config.js';
import { createSuiContext } from '../src/client.js';
import { buildAdapters } from '../src/aggregators/index.js';
import { buildPairs } from '../src/pairs.js';
import { logger } from '../src/logger.js';

async function main() {
  const cfg = loadConfig();
  const ctx = createSuiContext(cfg);
  const adapters = buildAdapters(ctx);

  const pairs = await buildPairs(cfg);
  const pair = pairs[0];
  if (!pair) throw new Error('no pairs built');
  const notional = pair.notionals[0];
  if (!notional) throw new Error('no notional configured');

  logger.info(
    { from: pair.a.coinType, to: pair.b.coinType, amountIn: notional.toString() },
    'quote smoke',
  );

  for (const adapter of adapters) {
    try {
      const q = await adapter.quote(pair.a.coinType, pair.b.coinType, notional);
      logger.info(
        { adapter: adapter.name, amountOut: q.amountOut.toString() },
        'quote ok',
      );
    } catch (err) {
      logger.error({ adapter: adapter.name, err: String(err) }, 'quote failed');
    }
  }
}

main().catch((err) => {
  logger.error({ err: String(err) }, 'smoke failed');
  process.exit(1);
});
