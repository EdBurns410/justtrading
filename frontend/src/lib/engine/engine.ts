// The deterministic, single-instrument backtest engine — the technical heart of
// Tragon Bots. Long-only for the MVP.
//
// Honesty rules baked in:
//  - No look-ahead: a signal detected at the CLOSE of bar i is executed at the
//    OPEN of bar i+1.
//  - Costs always hurt: every fill pays a fee and adverse slippage.
//  - Conservative intrabar fills: when both stop and target are touched in one
//    bar, the stop wins; stop fills account for gap-throughs.
//
// Same code runs client-side (instant preview while tweaking a bot) and
// server-side (the authoritative, leaderboard-eligible run). One engine, two
// callsites.

import type {
  Bar,
  BacktestConfig,
  BacktestResult,
  EquityPoint,
  Genome,
  Trade,
} from "./types.ts";
import { compileSignals } from "./signals.ts";
import { computeMetrics } from "./metrics.ts";

interface OpenPosition {
  units: number;
  entryPrice: number;
  entryFee: number;
  entryTs: number;
  entryIndex: number;
  peak: number;
}

export const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 1000,
  costs: { feePct: 0.001, slippagePct: 0.0005 },
};

export function runBacktest(
  genome: Genome,
  bars: Bar[],
  config: BacktestConfig = DEFAULT_CONFIG,
): BacktestResult {
  const { initialCapital, costs } = config;
  const equityCurve: EquityPoint[] = [];
  const trades: Trade[] = [];

  if (bars.length === 0) {
    return {
      metrics: computeMetrics([], [], initialCapital, genome.timeframe),
      equityCurve: [],
      trades: [],
      robustnessScore: null,
    };
  }

  const signals = compileSignals(genome, bars);
  const lastIndex = bars.length - 1;

  let cash = initialCapital;
  let position: OpenPosition | null = null;
  let enterNextBar = false;

  const stopPct = genome.exits.stopLossPct / 100;
  const tpPct =
    genome.exits.takeProfitPct != null ? genome.exits.takeProfitPct / 100 : null;
  const trailing = genome.exits.trailing;
  const timeExitBars = genome.exits.timeExitBars;

  // Returns the freshly opened position, or null if it could not be funded.
  // Assignment to `position` happens in the loop so control-flow narrowing works.
  function openAt(i: number): OpenPosition | null {
    const fillPrice = bars[i].open * (1 + costs.slippagePct);
    if (fillPrice <= 0 || cash <= 0) return null;
    const target = cash * (genome.risk.positionSizePct / 100);
    // Never commit more than we can afford including the entry fee.
    const notional = Math.min(target, cash / (1 + costs.feePct));
    if (notional <= 0) return null;
    const units = notional / fillPrice;
    const entryFee = notional * costs.feePct;
    cash -= notional + entryFee;
    return {
      units,
      entryPrice: fillPrice,
      entryFee,
      entryTs: bars[i].ts,
      entryIndex: i,
      peak: fillPrice,
    };
  }

  function closeAt(pos: OpenPosition, i: number, rawPrice: number, reason: Trade["reason"]) {
    const exitPrice = rawPrice * (1 - costs.slippagePct);
    const proceeds = pos.units * exitPrice;
    const exitFee = proceeds * costs.feePct;
    cash += proceeds - exitFee;
    const costBasis = pos.units * pos.entryPrice + pos.entryFee;
    const pnl = proceeds - exitFee - costBasis;
    trades.push({
      side: "long",
      entryTs: pos.entryTs,
      exitTs: bars[i].ts,
      entryPrice: pos.entryPrice,
      exitPrice,
      units: pos.units,
      fees: pos.entryFee + exitFee,
      pnl,
      reason,
      barsHeld: i - pos.entryIndex,
    });
    position = null;
  }

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    // 1. Execute a pending entry at this bar's open.
    if (enterNextBar && position === null) {
      position = openAt(i);
      enterNextBar = false;
    }

    // 2. Manage an open position (intrabar exits, conservative ordering).
    if (position !== null) {
      const pos = position;
      const effStop = (trailing ? pos.peak : pos.entryPrice) * (1 - stopPct);
      const tp = tpPct != null ? pos.entryPrice * (1 + tpPct) : null;

      if (bar.low <= effStop) {
        // Account for a gap straight through the stop level.
        const fill = Math.min(effStop, bar.open);
        closeAt(pos, i, fill, trailing ? "trailing" : "stop");
        position = null;
      } else if (tp != null && bar.high >= tp) {
        closeAt(pos, i, tp, "takeProfit");
        position = null;
      } else if (timeExitBars != null && i - pos.entryIndex >= timeExitBars) {
        closeAt(pos, i, bar.close, "timeExit");
        position = null;
      } else if (i === lastIndex) {
        closeAt(pos, i, bar.close, "endOfData");
        position = null;
      } else if (bar.high > pos.peak) {
        pos.peak = bar.high; // trail the high for next bar
      }
    }

    // 3. Mark-to-market equity at the close.
    const mark = position !== null ? position.units * bar.close : 0;
    equityCurve.push({ ts: bar.ts, value: cash + mark });

    // 4. Look for a fresh entry signal (executes next bar to avoid look-ahead).
    if (position === null && !enterNextBar && i < lastIndex) {
      if (signals.entryAt(i) && signals.filtersPassAt(i)) {
        enterNextBar = true;
      }
    }
  }

  return {
    metrics: computeMetrics(equityCurve, trades, initialCapital, genome.timeframe),
    equityCurve,
    trades,
    robustnessScore: null,
  };
}
