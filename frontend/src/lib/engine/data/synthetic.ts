// Deterministic synthetic OHLCV generator.
//
// Used for the fixed challenge dataset and for unit tests. Because it is fully
// seeded, the client and the server generate byte-identical bars, so a
// client-side preview and the authoritative server run agree on the same data.
//
// In production this is replaced by real OHLCV ingested via ccxt and cached in
// Supabase (build sequence M1); the engine code does not change.

import type { Bar, Timeframe } from "../types.ts";

/** Small, fast, fully deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box-Muller. Guard against log(0).
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface Regime {
  /** Per-bar log drift. */
  drift: number;
  /** Per-bar log volatility. */
  vol: number;
  /** Number of bars this regime lasts. */
  bars: number;
}

export interface SyntheticSpec {
  seed: number;
  startPrice: number;
  startTs: number;
  intervalSec: number;
  regimes: Regime[];
}

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** Generate a deterministic OHLCV series from a spec. */
export function generateOHLCV(spec: SyntheticSpec): Bar[] {
  const rand = mulberry32(spec.seed);
  const bars: Bar[] = [];
  let prevClose = spec.startPrice;
  let ts = spec.startTs;

  for (const regime of spec.regimes) {
    for (let b = 0; b < regime.bars; b++) {
      const open = prevClose;
      const ret = regime.drift + regime.vol * gaussian(rand);
      const close = Math.max(0.01, open * Math.exp(ret));

      const body = Math.abs(close - open);
      const wick = (body + regime.vol * close) * rand();
      const high = Math.max(open, close) + wick * rand();
      const low = Math.min(open, close) - wick * rand();

      // Volume spikes with the size of the move so news-spike strategies fire.
      const moveRatio = regime.vol > 0 ? Math.abs(ret) / regime.vol : 0;
      const volume = Math.round(
        1000 * (0.5 + rand()) * (1 + 1.5 * moveRatio),
      );

      bars.push({
        ts,
        open: round2(open),
        high: round2(high),
        low: round2(Math.max(0.01, low)),
        close: round2(close),
        volume,
      });

      prevClose = close;
      ts += spec.intervalSec;
    }
  }
  return bars;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
