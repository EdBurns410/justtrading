// Compiles a genome's entry + filter logic into fast per-bar predicates.
// All series are precomputed once; the predicates only read index i and below.

import type { Bar, Genome, FilterConfig } from "./types.ts";
import {
  sma,
  rsi,
  atr,
  priorHigh,
  column,
} from "./indicators.ts";

export interface CompiledSignals {
  /** True when the genome wants to OPEN a long at bar i. */
  entryAt(i: number): boolean;
  /** True when every filter passes at bar i (entry is gated on this). */
  filtersPassAt(i: number): boolean;
}

function num(
  params: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function compileSignals(genome: Genome, bars: Bar[]): CompiledSignals {
  const close = column(bars, "close");
  const high = column(bars, "high");
  const low = column(bars, "low");
  const open = column(bars, "open");
  const volume = column(bars, "volume");

  // --- entry series ---
  const e = genome.entry;
  let entryAt: (i: number) => boolean;

  switch (e.type) {
    case "breakout": {
      const lookback = num(e.params, "lookback", 20);
      const ph = priorHigh(close, lookback);
      entryAt = (i) => ph[i] != null && close[i] > (ph[i] as number);
      break;
    }
    case "pullback": {
      const shortP = num(e.params, "shortPeriod", 10);
      const longP = num(e.params, "longPeriod", 50);
      const s = sma(close, shortP);
      const l = sma(close, longP);
      entryAt = (i) =>
        s[i] != null &&
        l[i] != null &&
        (s[i] as number) > (l[i] as number) && // uptrend
        close[i] < (s[i] as number); // price pulled below short MA
      break;
    }
    case "meanReversion": {
      const rsiPeriod = num(e.params, "rsiPeriod", 14);
      const threshold = num(e.params, "threshold", 30);
      const r = rsi(close, rsiPeriod);
      entryAt = (i) => r[i] != null && (r[i] as number) < threshold;
      break;
    }
    case "trendFollow": {
      // Trend presence: fast MA above slow MA and price above the slow MA. The
      // engine only opens when flat, so after an exit the bot re-enters while
      // the trend persists — i.e. it rides trends rather than firing once on
      // the exact crossover bar.
      const shortP = num(e.params, "shortPeriod", 20);
      const longP = num(e.params, "longPeriod", 50);
      const s = sma(close, shortP);
      const l = sma(close, longP);
      entryAt = (i) =>
        s[i] != null &&
        l[i] != null &&
        (s[i] as number) > (l[i] as number) &&
        close[i] > (l[i] as number);
      break;
    }
    case "newsSpike": {
      const volMult = num(e.params, "volMult", 3);
      const rangePct = num(e.params, "rangePct", 4);
      const volPeriod = num(e.params, "volPeriod", 20);
      const va = sma(volume, volPeriod);
      entryAt = (i) =>
        va[i] != null &&
        volume[i] >= volMult * (va[i] as number) &&
        (high[i] - low[i]) / close[i] >= rangePct / 100 &&
        close[i] > open[i];
      break;
    }
    default:
      entryAt = () => false;
  }

  // --- filters ---
  const filterPredicates = genome.filters.map((f) =>
    compileFilter(f, close, volume, bars),
  );
  const filtersPassAt = (i: number) =>
    filterPredicates.every((p) => p(i));

  return { entryAt, filtersPassAt };
}

function compileFilter(
  f: FilterConfig,
  close: number[],
  volume: number[],
  bars: Bar[],
): (i: number) => boolean {
  const params = f as unknown as Record<string, unknown>;
  switch (f.type) {
    case "rsi": {
      const period = num(params, "rsiPeriod", 14);
      const min = num(params, "min", 0);
      const max = num(params, "max", 100);
      const r = rsi(close, period);
      return (i) =>
        r[i] != null && (r[i] as number) >= min && (r[i] as number) <= max;
    }
    case "volume": {
      const period = num(params, "period", 20);
      const minMultiple = num(params, "minMultiple", 1);
      const va = sma(volume, period);
      return (i) => va[i] != null && volume[i] >= minMultiple * (va[i] as number);
    }
    case "trend": {
      const period = num(params, "period", 200);
      const s = sma(close, period);
      return (i) => s[i] != null && close[i] > (s[i] as number);
    }
    case "volatility": {
      const period = num(params, "period", 14);
      const minPct = num(params, "minPct", 0);
      const maxPct = num(params, "maxPct", 100);
      const a = atr(bars, period);
      return (i) => {
        if (a[i] == null || close[i] === 0) return false;
        const pct = ((a[i] as number) / close[i]) * 100;
        return pct >= minPct && pct <= maxPct;
      };
    }
    default:
      return () => true;
  }
}
