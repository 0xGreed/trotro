import { Aftermath } from 'aftermath-ts-sdk';
import type { Router } from 'aftermath-ts-sdk';
import type { SwapAdapter, Quote, AppendSwapArgs, AppendSwapResult } from './types.js';
import type { SuiContext } from '../client.js';

export class AftermathAdapter implements SwapAdapter {
  readonly name = 'aftermath';
  private readonly sdk: Aftermath;
  private router: Router | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(_ctx: SuiContext) {
    this.sdk = new Aftermath('MAINNET');
  }

  private async ensureReady(): Promise<Router> {
    if (this.router) return this.router;
    if (!this.initPromise) this.initPromise = this.sdk.init();
    await this.initPromise;
    this.router = this.sdk.Router();
    return this.router;
  }

  async quote(fromType: string, toType: string, amountIn: bigint): Promise<Quote> {
    const router = await this.ensureReady();
    const route = await router.getCompleteTradeRouteGivenAmountIn({
      coinInType: fromType,
      coinOutType: toType,
      coinInAmount: amountIn,
    });
    return {
      adapter: this.name,
      fromType,
      toType,
      amountIn,
      amountOut: route.coinOut.amount,
      raw: route,
    };
  }

  async appendSwap(args: AppendSwapArgs): Promise<AppendSwapResult> {
    const router = await this.ensureReady();
    const completeRoute = args.quote.raw as Awaited<
      ReturnType<Router['getCompleteTradeRouteGivenAmountIn']>
    >;
    // Aftermath returns a NEW Transaction (not a mutation of args.tx). All
    // subsequent commands must be appended to `tx` — not `args.tx`.
    const { tx, coinOutId } = await router.addTransactionForCompleteTradeRoute({
      tx: args.tx,
      completeRoute,
      slippage: args.slippageBps / 10_000,
      walletAddress: args.sender,
      coinInId: args.coinIn,
    });
    if (!coinOutId) throw new Error('aftermath: addTransactionForCompleteTradeRoute returned no coinOutId');
    return { coinOut: coinOutId, tx };
  }
}
