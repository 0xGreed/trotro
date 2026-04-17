import type { SwapAdapter } from './types.js';
import type { SuiContext } from '../client.js';
import { CetusAdapter } from './cetus.js';
import { SevenKAdapter } from './sevenk.js';

export function buildAdapters(ctx: SuiContext): SwapAdapter[] {
  return [new CetusAdapter(ctx), new SevenKAdapter(ctx)];
}

export type { SwapAdapter, Quote, AppendSwapArgs } from './types.js';
