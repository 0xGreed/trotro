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

export interface SwapAdapter {
  readonly name: string;
  quote(fromType: string, toType: string, amountIn: bigint): Promise<Quote>;
  appendSwap(args: AppendSwapArgs): Promise<TransactionObjectArgument>;
}
