import type { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';

export type Quote = {
  adapter: string;
  fromType: string;
  toType: string;
  amountIn: bigint;
  amountOut: bigint;
  raw: unknown;
};

export type AppendSwapArgs = {
  tx: Transaction;
  sender: string;
  coinIn: TransactionObjectArgument;
  quote: Quote;
  slippageBps: number;
};

export type AppendSwapResult = {
  coinOut: TransactionObjectArgument;
  // Some aggregators (Aftermath) return a fresh Transaction instance that
  // contains the original commands plus the appended swap. Callers MUST use
  // this returned `tx` for all subsequent commands — reusing the old instance
  // will reference commands the aggregator never added.
  tx: Transaction;
};

export interface SwapAdapter {
  readonly name: string;
  quote(fromType: string, toType: string, amountIn: bigint): Promise<Quote>;
  appendSwap(args: AppendSwapArgs): Promise<AppendSwapResult>;
}
