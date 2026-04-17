// 7K's ESM build ships imports without file extensions, which Node's native
// ESM loader rejects. Use the CJS subpath instead.
import { getQuote, buildTx } from '@7kprotocol/sdk-ts/cjs';
import type { TransactionObjectArgument } from '@mysten/sui/transactions';
import type { SwapAdapter, Quote, AppendSwapArgs } from './types.js';
import type { SuiContext } from '../client.js';

export class SevenKAdapter implements SwapAdapter {
  readonly name = '7k';

  constructor(_ctx: SuiContext) {
    // 7K's `setSuiClient` expects the legacy SuiClient; we skip it because
    // quote + buildTx go through REST under the hood. If 7K ever starts
    // requiring the client for extendTx flows, wire a legacy SuiClient here.
  }

  async quote(fromType: string, toType: string, amountIn: bigint): Promise<Quote> {
    const q = await getQuote({
      tokenIn: fromType,
      tokenOut: toType,
      amountIn: amountIn.toString(),
    });
    if (!q?.returnAmountWithDecimal) throw new Error('7k: no route');
    return {
      adapter: this.name,
      fromType,
      toType,
      amountIn,
      amountOut: BigInt(q.returnAmountWithDecimal),
      raw: q,
    };
  }

  async appendSwap(args: AppendSwapArgs): Promise<TransactionObjectArgument> {
    const result = await buildTx({
      quoteResponse: args.quote.raw as Parameters<typeof buildTx>[0]['quoteResponse'],
      accountAddress: args.sender,
      slippage: args.slippageBps / 10_000,
      commission: { partner: args.sender, commissionBps: 0 },
      extendTx: { tx: args.tx, coinIn: args.coinIn },
    });
    if (!result.coinOut) throw new Error('7k: buildTx returned no coinOut');
    return result.coinOut;
  }
}
