// Leaderboard scoring — shared by the client preview and the server-authoritative
// run so both agree on exactly one formula.
//
// The score rewards risk-adjusted, robust performance, never raw return alone:
// an overfit bot that only wins in one regime has a low robustness multiplier
// and cannot dominate the board. This is the anti-"buy a better result" rule
// from the plan made concrete.

import type { Metrics } from "./types.ts";

export function leaderboardScore(metrics: Metrics, robustnessScore: number): number {
  const robustnessMultiplier = 0.5 + 0.5 * robustnessScore;
  return Number((metrics.totalReturn * 100 * robustnessMultiplier).toFixed(2));
}
