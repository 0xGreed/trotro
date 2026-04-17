import { loadConfig } from '../src/config.js';
import { createSuiContext } from '../src/client.js';
import { logger } from '../src/logger.js';

async function main() {
  const cfg = loadConfig();
  const ctx = createSuiContext(cfg);
  logger.info({ sender: ctx.sender, grpcUrl: cfg.grpcUrl }, 'gRPC smoke: fetching reference gas price');
  const gas = await ctx.client.core.getReferenceGasPrice();
  logger.info({ referenceGasPrice: gas.referenceGasPrice }, 'gRPC ok');

  logger.info('gRPC smoke: retrying with bogus x-token');
  const bad = createSuiContext({ ...cfg, grpcToken: 'obviously-invalid' });
  try {
    const also = await bad.client.core.getReferenceGasPrice();
    logger.warn({ also }, 'auth NOT enforced: bad token still worked');
    process.exitCode = 2;
  } catch (err) {
    logger.info({ err: String(err) }, 'auth enforced: bad token rejected');
  }
}

main().catch((err) => {
  logger.error({ err: String(err) }, 'smoke failed');
  process.exit(1);
});
