// Out-of-sample / walk-forward testing — the overfitting protection, surfaced
// as a teaching feature rather than hidden as a guardrail.
//
// The core loop (mutate, re-test, keep the winner) is a curve-fitting machine.
// A bot that scores brilliantly in-sample but falls apart out-of-sample is
// overfit. This module re-runs the genome across several contiguous slices of
// history and rewards CONSISTENCY, not a single flattering number.

import type { BacktestConfig, Genome, Bar } from "./types.ts";
import { runBacktest, DEFAULT_CONFIG } from "./engine.ts";

export interface WalkForwardSegment {
  index: number;
  startTs: number;
  endTs: number;
  totalReturn: number;
  maxDrawdown: number;
  trades: number;
}

export interface RobustnessReport {
  /** 0 (fragile / overfit) .. 1 (consistent across regimes). */
  score: number;
  segments: WalkForwardSegment[];
  positiveRate: number;
  verdict: "robust" | "mixed" | "fragile";
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Split history into `segments` contiguous windows, backtest each independently,
 * and score how consistently the genome performs. A high raw return that only
 * shows up in one window scores poorly — exactly the signal we want.
 */
export function computeRobustness(
  genome: Genome,
  bars: Bar[],
  config: BacktestConfig = DEFAULT_CONFIG,
  segments = 4,
): RobustnessReport {
  const n = bars.length;
  const k = Math.max(2, Math.min(segments, Math.floor(n / 10) || 2));
  const size = Math.floor(n / k);

  const segs: WalkForwardSegment[] = [];
  const returns: number[] = [];

  for (let s = 0; s < k; s++) {
    const start = s * size;
    const end = s === k - 1 ? n : (s + 1) * size;
    const slice = bars.slice(start, end);
    if (slice.length < 2) continue;
    const r = runBacktest(genome, slice, config);
    segs.push({
      index: s,
      startTs: slice[0].ts,
      endTs: slice[slice.length - 1].ts,
      totalReturn: r.metrics.totalReturn,
      maxDrawdown: r.metrics.maxDrawdown,
      trades: r.metrics.trades,
    });
    returns.push(r.metrics.totalReturn);
  }

  if (returns.length === 0) {
    return { score: 0, segments: [], positiveRate: 0, verdict: "fragile" };
  }

  const positiveRate =
    returns.filter((x) => x > 0).length / returns.length;

  // Consistency: penalise high dispersion of segment returns. Normalise the
  // standard deviation by the spread so the metric is scale-free.
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const sd = Math.sqrt(variance);
  const dispersion = Math.abs(mean) > 1e-9 ? sd / (Math.abs(mean) + sd) : 1;
  const consistency = clamp(1 - dispersion, 0, 1);

  const score = clamp(0.6 * positiveRate + 0.4 * consistency, 0, 1);
  const verdict = score >= 0.66 ? "robust" : score >= 0.4 ? "mixed" : "fragile";

  return { score: round2(score), segments: segs, positiveRate, verdict };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
