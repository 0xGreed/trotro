import { AggregatorClient, type RouterData } from '@cetusprotocol/aggregator-sdk';
import BN from 'bn.js';
import type { TransactionObjectArgument } from '@mysten/sui/transactions';
import type { SwapAdapter, Quote, AppendSwapArgs } from './types.js';
import type { SuiContext } from '../client.js';

export class CetusAdapter implements SwapAdapter {
  readonly name = 'cetus';
  private readonly client: AggregatorClient;

  constructor(ctx: SuiContext) {
    this.client = new AggregatorClient({ signer: ctx.sender });
  }

  async quote(fromType: string, toType: string, amountIn: bigint): Promise<Quote> {
    const routers = await this.client.findRouters({
      from: fromType,
      target: toType,
      amount: new BN(amountIn.toString()),
      byAmountIn: true,
    });
    if (!routers) throw new Error(`cetus: no route ${fromType} -> ${toType}`);
    return {
      adapter: this.name,
      fromType,
      toType,
      amountIn,
      amountOut: BigInt(routers.amountOut.toString()),
      raw: routers,
    };
  }

  async appendSwap(args: AppendSwapArgs): Promise<TransactionObjectArgument> {
    const routers = args.quote.raw as RouterData;
    return this.client.routerSwap({
      routers,
      txb: args.tx,
      inputCoin: args.coinIn,
      slippage: args.slippageBps / 10_000,
    });
  }
}
