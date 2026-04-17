# trotro

Sui arbitrage bot. Borrows from Scallop with a 0-fee flashloan, swaps A→B on one
aggregator and B→A on another, repays the loan, and pockets the delta — all
inside a single Programmable Transaction Block so the trade is atomic.

## How it works

```
          ┌──────────────── one PTB ────────────────┐
flashloan │  leg1       leg2        repay           │
A  ───────┼──▶  B  ────▶  A'   ────▶  A  ──▶ profit  ──▶ wallet
          └─────────────────────────────────────────┘
```

1. **Pair build** (once at startup, `src/pairs.ts`):
   - Query Scallop for every loanable pool.
   - Fetch USD prices from Aftermath.
   - Rank pools by USD TVL (`supplyCoin × price`), keep top `TOP_LOANABLE`.
   - Drop stable↔stable combos (no spread to arb).
   - Size per-coin notionals from `USD_NOTIONALS`, converted to atomic units via price.

2. **Two-phase scan per cycle** (`src/runner.ts` → `src/scanner.ts`):
   - **Prefilter:** smallest notional only, one round-trip per pair. If
     `profitBps < PREFILTER_BPS`, skip.
   - **Full sweep:** only on pairs that hit, re-quote at every notional to find
     the best size.
   - Each leg queries all three adapters (Cetus, 7K, Aftermath) via
     `Promise.allSettled` and picks the best `amountOut`.

3. **Execute** (`src/executor.ts`):
   - Build PTB: `scallop.borrowFlashLoan` → adapter1.appendSwap → adapter2.appendSwap
     → `splitCoins(coinA_out, [notional])` → `scallop.repayFlashLoan` → transfer
     remainder to sender.
   - `dryRun` via the experimental gRPC `core.dryRunTransaction`.
   - If `DRY_RUN=false` and `profitBps ≥ PROFIT_BPS_MIN`, sign and submit.

## Setup

```
npm install
cp .env.example .env
# edit .env (GRPC_URL, GRPC_X_TOKEN, PRIVATE_KEY at minimum)
```

### Required env

| Var                 | Purpose                                                  |
|---------------------|----------------------------------------------------------|
| `GRPC_URL`          | Sui gRPC endpoint (e.g. Ankr, Chainstack). JSON-RPC is deprecated. |
| `GRPC_X_TOKEN`      | `x-token` auth header for the gRPC provider.             |
| `PRIVATE_KEY`       | `suiprivkey1...` bech32 or hex secret key of the executing wallet. |
| `SCALLOP_ADDRESS_ID`| Scallop mainnet address object ID.                       |

### Tuning knobs

| Var              | Default | Meaning                                                       |
|------------------|---------|---------------------------------------------------------------|
| `DRY_RUN`        | `true`  | If `true`, never submits — only dry-runs.                     |
| `PROFIT_BPS_MIN` | `50`    | 0.5% — execute only if the best opportunity clears this.      |
| `PREFILTER_BPS`  | `10`    | 0.1% — cheap-scan threshold to escalate to full sweep.        |
| `SLIPPAGE_BPS`   | `30`    | Per-leg slippage passed to each aggregator.                   |
| `USD_NOTIONALS`  | `100,1000,10000` | USD-equivalent sizes to sweep per pair.               |
| `TOP_LOANABLE`   | `15`    | Cap pair universe to top-N Scallop pools by USD TVL. `0` disables. |
| `POLL_INTERVAL_MS` | `5000` | Minimum time between cycles.                                 |
| `LOG_LEVEL`      | `info`  | `debug` for per-pair scan logs.                               |

## Running

```
npm run typecheck       # tsc --noEmit
npm run smoke:grpc      # verify gRPC auth + basic reads
npm run smoke:quote     # fetch one quote from each adapter on the top pair
npm start               # run the arbitrage loop
```

`DRY_RUN=true` is the default — the bot will scan, dry-run PTBs, and log the
outcome without broadcasting. Flip to `false` only after verifying profit logs
and chain state on a real run.

## Layout

```
src/
  aggregators/      Cetus, 7K, Aftermath adapters (common SwapAdapter interface)
  client.ts         gRPC transport + keypair + SuiGrpcClient
  config.ts         Env parsing
  executor.ts       PTB assembly, dry-run, sign, submit
  index.ts          Entrypoint
  pairs.ts          Loanable → TVL rank → stable filter → notional sizing
  prices.ts         Aftermath USD price fetch
  runner.ts         Main loop, two-phase scan, SIGINT/SIGTERM shutdown
  scallop.ts        Lazy Scallop SDK init, flashloan borrow/repay helpers
  scallop-coins.ts  getMarketPools wrapper
  scanner.ts        bestQuote, scanPairAtNotional, scanPair
scripts/            smoke:grpc, smoke:quote
```

## Notes

- Pairs are built once per process. Restart to pick up new Scallop pools or
  large price moves that skew notional sizing.
- Profit is computed in coin-A atomic units end-to-end; USD prices only size
  the notional, they never enter the profit calculation.
- The scanner tolerates adapter failures (e.g. 7K 502s) via `Promise.allSettled`
  — a down aggregator silently reduces competition but doesn't break a cycle.
- Scallop flashloans are 0 fee on mainnet; the only on-chain cost is gas +
  aggregator routing fees.
