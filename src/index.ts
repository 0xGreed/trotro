import { loadConfig } from './config.js';
import { createSuiContext } from './client.js';
import { buildAdapters } from './aggregators/index.js';
import { runLoop } from './runner.js';
import { logger } from './logger.js';

async function main() {
  const cfg = loadConfig();
  const ctx = createSuiContext(cfg);
  const adapters = buildAdapters(ctx);
  await runLoop(cfg, ctx, adapters);
}

main().catch((err) => {
  logger.error({ err: String(err), stack: (err as Error)?.stack }, 'fatal');
  process.exit(1);
});
