// The fixed challenge dataset that backs the MVP leaderboard.
//
// One asset, one timeframe, one date range — the same for every player, every
// run. Mirrors the `datasets` table (asset, timeframe, date_range, source).
// The bars are generated deterministically so client preview and server-
// verified runs operate on identical data.

import type { Bar, Timeframe } from "../types.ts";
import { generateOHLCV, TIMEFRAME_SECONDS } from "./synthetic.ts";

export interface DatasetMeta {
  id: string;
  asset: string;
  timeframe: Timeframe;
  bars: number;
  source: "synthetic" | "ccxt";
  label: string;
}

// 2024-01-01T00:00:00Z, ~720 4h bars ≈ 120 days of mixed regimes:
// bull → sharp correction → choppy range → recovery. A genome that only wins in
// one of these regimes will be exposed by the robustness check.
const CHALLENGE_SPEC = {
  seed: 20240101,
  startPrice: 42000,
  startTs: 1704067200,
  intervalSec: TIMEFRAME_SECONDS["4h"],
  regimes: [
    { drift: 0.0025, vol: 0.022, bars: 180 }, // steady bull
    { drift: -0.01, vol: 0.05, bars: 90 }, // sharp correction
    { drift: 0.0, vol: 0.026, bars: 270 }, // choppy range
    { drift: 0.004, vol: 0.03, bars: 180 }, // volatile recovery
  ],
};

export const CHALLENGE_DATASET: DatasetMeta = {
  id: "btc-4h-2024h1",
  asset: "BTC",
  timeframe: "4h",
  bars: 720,
  source: "synthetic",
  label: "BTC · 4h · 2024 H1 (mixed regimes)",
};

let cached: Bar[] | null = null;

/** Returns the challenge bars. Memoised; deterministic across processes. */
export function getChallengeBars(): Bar[] {
  if (cached) return cached;
  cached = generateOHLCV(CHALLENGE_SPEC);
  return cached;
}
