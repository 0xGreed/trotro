import { Scallop, type ScallopBuilder, type ScallopTxBlock } from '@scallop-io/sui-scallop-sdk';
import type { TransactionObjectArgument } from '@mysten/sui/transactions';
import type { Config } from './config.js';

let cached: { scallop: Scallop; builder: ScallopBuilder } | null = null;

export async function getScallop(cfg: Config): Promise<{ scallop: Scallop; builder: ScallopBuilder }> {
  if (cached) return cached;
  const scallop = new Scallop({
    addressId: cfg.scallopAddressId,
    secretKey: cfg.privateKey,
    networkType: 'mainnet',
  });
  const builder = await scallop.createScallopBuilder();
  cached = { scallop, builder };
  return cached;
}

export function newTxBlock(builder: ScallopBuilder): ScallopTxBlock {
  return builder.createTxBlock();
}

export function borrow(
  stb: ScallopTxBlock,
  amount: bigint,
  scallopCoinName: string,
) {
  // Scallop's `borrowFlashLoan` wants `number | SuiTxArg`; our notionals fit
  // safely in JS number range (< 2^53) for realistic flashloan sizes.
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`flashloan amount exceeds MAX_SAFE_INTEGER: ${amount}`);
  }
  return stb.borrowFlashLoan(Number(amount), scallopCoinName);
}

export function repay(
  stb: ScallopTxBlock,
  coin: TransactionObjectArgument,
  loan: TransactionObjectArgument,
  scallopCoinName: string,
): void {
  stb.repayFlashLoan(coin, loan, scallopCoinName);
}
