# Tragon Bots — engine slice

A gamified strategy-genome lab: hatch a bot, tune its DNA, backtest it honestly,
score its robustness, and (next) climb a server-verified leaderboard.

Under the hood this is **a strategy-genome editor wrapped in a creature
collector, powered by a real backtesting engine**. The eggs, breeding and
mutations are a friendly UI over (1) editing a structured config — the "genome"
— and (2) running it through a deterministic backtest.

This slice builds the part the whole product lives or dies on: **a
deterministic, fair backtest engine (M2)** plus a working **client-side build →
backtest → score loop (M3)**, with the overfitting protection (M6) designed in
from day one.

## What's here

```
frontend/src/lib/engine/
  types.ts          Genome schema + result contract (the two-way contract)
  indicators.ts     SMA, EMA, Wilder RSI, prior-high/low, ATR  (no look-ahead)
  signals.ts        Compiles a genome's entry + filter logic into predicates
  engine.ts         runBacktest() — long-only, fees + slippage, conservative fills
  metrics.ts        totalReturn, CAGR, maxDrawdown, winRate, profitFactor, Sharpe
  species.ts        The 8 core eggs, cross-breeding, and mutation perks
  robustness.ts     Walk-forward out-of-sample scoring (the overfitting feature)
  data/
    synthetic.ts    Deterministic, seeded OHLCV generator
    challenge.ts    The fixed challenge dataset (BTC · 4h · 2024 H1)
  __tests__/        20 hand-checked unit tests, runnable with zero deps

frontend/src/app/lab/page.tsx                 The Strategy Lab (M3 UI)
frontend/src/components/lab/EquityChart.tsx   Dependency-free SVG equity curve
frontend/src/app/api/leaderboard/verify/route.ts  Server-authoritative run (M4)

supabase/migrations/0001_tragon_bots.sql      Full data model + RLS (section 6)
```

## The engine's honesty rules

A backtest that flatters is worse than useless — it teaches bad habits. The
engine bakes in:

- **No look-ahead.** A signal detected at the *close* of bar `i` is executed at
  the *open* of bar `i+1`. Indicators at index `i` depend only on bars `≤ i`.
- **Costs always hurt.** Every fill pays a fee and adverse slippage.
- **Conservative intrabar fills.** If a bar touches both stop and target, the
  stop wins; stop fills account for gap-throughs.
- **Determinism.** Same genome + same bars ⇒ byte-identical result. The
  synthetic dataset is seeded, so the browser preview and the server-verified
  run operate on identical data.

## Hybrid backtesting (one engine, two callsites)

- **Client-side** (`/lab`): instant preview while tuning a bot. Free, fast, no
  server cost.
- **Server-side** (`POST /api/leaderboard/verify`): the **authoritative** run
  for anything that touches the leaderboard. It ignores any client-supplied
  metrics and re-runs the genome against fixed data with fixed costs.

## Overfitting, surfaced as a feature

The core loop (mutate → re-test → keep the winner) is a curve-fitting machine.
`computeRobustness()` re-runs a genome across four contiguous slices of history
(bull, correction, range, recovery) and rewards *consistency*, not a single
flattering number. The Lab shows the verdict (`robust` / `mixed` / `fragile`)
so "this bot is overfit" becomes a teaching moment.

## Run the tests

```bash
cd frontend
npm test          # node --test, zero dependencies (Node ≥ 22)
```

All 20 tests are hand-checked (e.g. a breakout that fills at the next bar's open
and exits at a known take-profit level, verifying the exact P&L).

## Build sequence status

| Milestone | Scope | Status |
|-----------|-------|--------|
| M0 | Scaffold (Next + Supabase auth) | pre-existing in repo |
| M1 | Crypto OHLCV ingestion via ccxt → Supabase | **next** — synthetic stand-in shipped |
| M2 | Genome model + backtest engine (fees/slippage, unit-tested) | **done** |
| M3 | Bot creation UI: pick species, tweak, backtest, see curve, save | **done (client-side)** |
| M4 | Server-authoritative backtest + ranked leaderboard | engine callsite **done**; persistence next |
| M5 | Breeding + mutation + cross-breed species | engine functions **done**; UI next |
| M6 | Out-of-sample / robustness score | **done** |
| M7 | Cosmetics, seasons/tournaments, sharing | later |

## Next steps to finish the MVP

1. **M1 — real data.** Add a `ccxt` ingestion job that writes `market_bars` for
   ~10 crypto assets (1d + 4h) and registers a `datasets` row. The engine reads
   `Bar[]` and does not change. Verify exchange rate limits/terms at build time.
2. **M4 — persist + rank.** On verify, insert a `verified` row into `backtests`
   and upsert `leaderboard_entries`; add a `/leaderboard` page reading the board.
   Apply `supabase/migrations/0001_tragon_bots.sql`.
3. **M3 → server save.** Swap the Lab's `localStorage` collection for the `bots`
   table (RLS already scopes rows to the owner).
4. **M5 — breeding UI.** `crossbreed()` and `applyMutation()` already exist and
   are tested; add the hatchery/breeding screens on top.

## Guardrails locked in (plan section 7)

- **Simulation only.** No real money, no execution, no advice. A prominent
  "simulation only — not financial advice" disclaimer is shown in the Lab.
- **Leaderboard integrity.** Authoritative runs are server-side against fixed
  data; client metrics are never trusted.
- **No pay-to-win.** The score rewards risk-adjusted, robust performance — it
  cannot be bought.
