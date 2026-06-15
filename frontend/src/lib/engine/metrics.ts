// Performance metrics computed from the equity curve and trade log.

import type { EquityPoint, Metrics, Trade, Timeframe } from "./types.ts";

const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

const PERIODS_PER_YEAR: Record<Timeframe, number> = {
  "1h": 365.25 * 24,
  "4h": 365.25 * 6,
  "1d": 365.25,
};

export function maxDrawdown(curve: EquityPoint[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const p of curve) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) {
      const dd = p.value / peak - 1;
      if (dd < worst) worst = dd;
    }
  }
  return worst; // <= 0
}

/** Annualised Sharpe from per-bar equity returns. Risk-free rate assumed 0. */
export function sharpe(curve: EquityPoint[], timeframe: Timeframe): number {
  if (curve.length < 3) return 0;
  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].value;
    if (prev > 0) rets.push(curve[i].value / prev - 1);
  }
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (mean / sd) * Math.sqrt(PERIODS_PER_YEAR[timeframe]);
}

export function computeMetrics(
  curve: EquityPoint[],
  trades: Trade[],
  initialCapital: number,
  timeframe: Timeframe,
): Metrics {
  const finalEquity = curve.length ? curve[curve.length - 1].value : initialCapital;
  const totalReturn = initialCapital > 0 ? finalEquity / initialCapital - 1 : 0;

  let cagr = 0;
  if (curve.length >= 2 && initialCapital > 0 && finalEquity > 0) {
    const years = (curve[curve.length - 1].ts - curve[0].ts) / SECONDS_PER_YEAR;
    if (years > 0) cagr = (finalEquity / initialCapital) ** (1 / years) - 1;
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const winRate = trades.length ? wins.length / trades.length : 0;

  const grossProfit = trades
    .filter((t) => t.pnl > 0)
    .reduce((a, t) => a + t.pnl, 0);
  const grossLoss = trades
    .filter((t) => t.pnl < 0)
    .reduce((a, t) => a - t.pnl, 0); // positive magnitude
  // Cap at a large finite number so the value is JSON-serialisable.
  const profitFactor =
    grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;

  return {
    totalReturn,
    cagr,
    maxDrawdown: maxDrawdown(curve),
    winRate,
    profitFactor,
    sharpe: sharpe(curve, timeframe),
    trades: trades.length,
  };
}
