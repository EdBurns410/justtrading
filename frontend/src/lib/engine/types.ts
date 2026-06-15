// Tragon Bots — strategy genome + backtest engine types.
//
// Everything the player sees (eggs, breeding, mutations, legendary tiers) is a
// friendly UI over two things: editing this structured genome, and running it
// through the backtest engine. These types are the contract between the two.

/** A single OHLCV candle. `ts` is a Unix timestamp in seconds. */
export interface Bar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Bar interval. Maps to the DNA-builder "timeframe" step. */
export type Timeframe = "1h" | "4h" | "1d";

/** Core species (the eight eggs) plus cross-breeds get a free-form string id. */
export type Species =
  | "fire"
  | "ice"
  | "plant"
  | "storm"
  | "steel"
  | "shadow"
  | "ocean"
  | "solar"
  | string; // cross-breeds, e.g. "inferno"

export type EntryType =
  | "breakout"
  | "pullback"
  | "meanReversion"
  | "trendFollow"
  | "newsSpike";

export interface EntryConfig {
  type: EntryType;
  params: Record<string, number>;
}

export type FilterType = "rsi" | "volume" | "trend" | "volatility";

export interface FilterConfig {
  type: FilterType;
  // rsi: { min, max }; volume: { minMultiple }; trend: { period };
  // volatility: { period, minPct, maxPct }
  [key: string]: number | string;
}

export type RiskStyle = "cautious" | "balanced" | "aggressive";

export interface RiskConfig {
  style: RiskStyle;
  /** Percentage of current equity committed when opening a position. */
  positionSizePct: number;
  /** Max simultaneous open positions (MVP engine is single-instrument => 1). */
  maxConcurrent: number;
}

export interface ExitConfig {
  stopLossPct: number;
  takeProfitPct: number | null;
  /** When true, the stop trails the peak price by `stopLossPct`. */
  trailing: boolean;
  /** Force-close after N bars in the position. null = disabled. */
  timeExitBars: number | null;
  scaleOut: boolean;
}

/** Small perks (DNA builder step 7) that perturb the numeric genome. */
export type Mutation =
  | "precision" // tighter entries
  | "patience" // longer time-exit / fewer trades
  | "adaptability" // wider volatility tolerance
  | "protection" // wider stops, smaller size
  | "speed"; // faster timeframe bias / quicker exits

/** The full strategy genome. Stored as jsonb on the `bots` row. */
export interface Genome {
  species: Species;
  parents: [string, string] | null;
  generation: number;
  universe: string[];
  timeframe: Timeframe;
  entry: EntryConfig;
  filters: FilterConfig[];
  risk: RiskConfig;
  exits: ExitConfig;
  mutations: Mutation[];
}

/** Cost model. Defaults are deliberately conservative, never flattering. */
export interface CostModel {
  /** Taker fee per side, as a fraction (0.001 = 10 bps). */
  feePct: number;
  /** Adverse slippage applied to every fill, as a fraction. */
  slippagePct: number;
}

export interface BacktestConfig {
  initialCapital: number;
  costs: CostModel;
}

export interface Trade {
  side: "long";
  entryTs: number;
  exitTs: number;
  entryPrice: number;
  exitPrice: number;
  units: number;
  fees: number;
  /** Net profit/loss in account currency, fees included. */
  pnl: number;
  /** Reason the position was closed. */
  reason: "stop" | "takeProfit" | "trailing" | "timeExit" | "endOfData";
  barsHeld: number;
}

export interface EquityPoint {
  ts: number;
  value: number;
}

export interface Metrics {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number; // negative or zero
  winRate: number;
  profitFactor: number;
  sharpe: number;
  trades: number;
}

export interface BacktestResult {
  metrics: Metrics;
  equityCurve: EquityPoint[];
  trades: Trade[];
  /** From out-of-sample testing. null until a walk-forward run is requested. */
  robustnessScore: number | null;
}
