// Tragon Bots backtest engine — public surface.
//
// The same module runs in two places from one codebase:
//   - client-side, for instant preview while a player tweaks a bot;
//   - server-side, for the authoritative, leaderboard-eligible run.

export * from "./types.ts";
export { runBacktest, DEFAULT_CONFIG } from "./engine.ts";
export { computeMetrics, maxDrawdown, sharpe } from "./metrics.ts";
export {
  CORE_SPECIES,
  MVP_SPECIES,
  CROSSBREEDS,
  genomeFromSpecies,
  crossbreed,
  applyMutation,
  mutationLabel,
} from "./species.ts";
export type { SpeciesPreset } from "./species.ts";
export { computeRobustness } from "./robustness.ts";
export type { RobustnessReport, WalkForwardSegment } from "./robustness.ts";
export {
  sma,
  ema,
  rsi,
  atr,
  priorHigh,
  priorLow,
  column,
} from "./indicators.ts";
