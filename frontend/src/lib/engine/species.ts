// The eight core eggs as preset genomes, plus cross-breeding and mutation —
// the genetics behind the "hatch, breed, evolve" loop. A bot IS a genome; a
// cross-breed is parameter inheritance from two parents; a mutation perturbs
// the numbers.

import type {
  EntryConfig,
  ExitConfig,
  FilterConfig,
  Genome,
  Mutation,
  RiskConfig,
  Species,
  Timeframe,
} from "./types.ts";

export interface SpeciesPreset {
  id: Species;
  name: string;
  archetype: string;
  blurb: string;
  timeframe: Timeframe;
  entry: EntryConfig;
  filters: FilterConfig[];
  risk: RiskConfig;
  exits: ExitConfig;
}

export const CORE_SPECIES: Record<string, SpeciesPreset> = {
  fire: {
    id: "fire",
    name: "Fire",
    archetype: "Aggressive breakout",
    blurb: "High risk, high reward. Thrives in trending momentum.",
    timeframe: "4h",
    entry: { type: "breakout", params: { lookback: 20 } },
    filters: [{ type: "volume", minMultiple: 1.5, period: 20 }],
    risk: { style: "aggressive", positionSizePct: 25, maxConcurrent: 1 },
    exits: {
      stopLossPct: 8,
      takeProfitPct: 24,
      trailing: true,
      timeExitBars: null,
      scaleOut: false,
    },
  },
  ice: {
    id: "ice",
    name: "Ice",
    archetype: "Capital preserver",
    blurb: "Defensive. Tight conditions, cautious sizing, low turnover.",
    timeframe: "1d",
    entry: { type: "trendFollow", params: { shortPeriod: 20, longPeriod: 50 } },
    filters: [{ type: "trend", period: 200 }],
    risk: { style: "cautious", positionSizePct: 8, maxConcurrent: 1 },
    exits: {
      stopLossPct: 3,
      takeProfitPct: 9,
      trailing: false,
      timeExitBars: null,
      scaleOut: false,
    },
  },
  plant: {
    id: "plant",
    name: "Plant",
    archetype: "Slow compounder",
    blurb: "Trend-following, large-cap bias, low turnover.",
    timeframe: "1d",
    entry: { type: "trendFollow", params: { shortPeriod: 50, longPeriod: 100 } },
    filters: [{ type: "trend", period: 200 }],
    risk: { style: "balanced", positionSizePct: 12, maxConcurrent: 1 },
    exits: {
      stopLossPct: 10,
      takeProfitPct: null,
      trailing: true,
      timeExitBars: null,
      scaleOut: false,
    },
  },
  storm: {
    id: "storm",
    name: "Storm",
    archetype: "Volatility hunter",
    blurb: "Momentum / news-spike entries on fast-moving markets.",
    timeframe: "1h",
    entry: { type: "newsSpike", params: { volMult: 2.5, rangePct: 3, volPeriod: 20 } },
    filters: [{ type: "volatility", period: 14, minPct: 1.0, maxPct: 100 }],
    risk: { style: "aggressive", positionSizePct: 20, maxConcurrent: 1 },
    exits: {
      stopLossPct: 6,
      takeProfitPct: 12,
      trailing: false,
      timeExitBars: 12,
      scaleOut: false,
    },
  },
  steel: {
    id: "steel",
    name: "Steel",
    archetype: "Balanced trend-follower",
    blurb: "Moving-average trend follow with trailing exits.",
    timeframe: "4h",
    entry: { type: "trendFollow", params: { shortPeriod: 20, longPeriod: 50 } },
    filters: [{ type: "trend", period: 100 }],
    risk: { style: "balanced", positionSizePct: 15, maxConcurrent: 1 },
    exits: {
      stopLossPct: 7,
      takeProfitPct: null,
      trailing: true,
      timeExitBars: null,
      scaleOut: false,
    },
  },
  shadow: {
    id: "shadow",
    name: "Shadow",
    archetype: "Contrarian",
    blurb: "Mean-reversion. Fades oversold extremes.",
    timeframe: "4h",
    entry: { type: "meanReversion", params: { rsiPeriod: 14, threshold: 35 } },
    filters: [{ type: "trend", period: 200 }],
    risk: { style: "balanced", positionSizePct: 12, maxConcurrent: 1 },
    exits: {
      stopLossPct: 5,
      takeProfitPct: 8,
      trailing: false,
      timeExitBars: 20,
      scaleOut: false,
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    archetype: "Range / cycle",
    blurb: "Oscillator range trading, scale out at range bounds.",
    timeframe: "4h",
    entry: { type: "meanReversion", params: { rsiPeriod: 10, threshold: 38 } },
    filters: [{ type: "volatility", period: 14, minPct: 0, maxPct: 6 }],
    risk: { style: "cautious", positionSizePct: 10, maxConcurrent: 1 },
    exits: {
      stopLossPct: 4,
      takeProfitPct: 6,
      trailing: false,
      timeExitBars: 15,
      scaleOut: true,
    },
  },
  solar: {
    id: "solar",
    name: "Solar",
    archetype: "Large-cap momentum",
    blurb: "Momentum entries with a trend filter, large-cap universe.",
    timeframe: "1d",
    entry: { type: "breakout", params: { lookback: 40 } },
    filters: [{ type: "trend", period: 100 }],
    risk: { style: "balanced", positionSizePct: 15, maxConcurrent: 1 },
    exits: {
      stopLossPct: 9,
      takeProfitPct: null,
      trailing: true,
      timeExitBars: null,
      scaleOut: false,
    },
  },
};

/** The four species exposed in the MVP builder (plan: start simple). */
export const MVP_SPECIES: Species[] = ["fire", "ice", "steel", "shadow"];

const DEFAULT_UNIVERSE = ["BTC", "ETH"];

/** Build a fresh, generation-1 genome from a core species preset. */
export function genomeFromSpecies(
  species: Species,
  universe: string[] = DEFAULT_UNIVERSE,
): Genome {
  const preset = CORE_SPECIES[species];
  if (!preset) throw new Error(`Unknown species: ${species}`);
  return {
    species: preset.id,
    parents: null,
    generation: 1,
    universe: [...universe],
    timeframe: preset.timeframe,
    entry: { type: preset.entry.type, params: { ...preset.entry.params } },
    filters: preset.filters.map((f) => ({ ...f })),
    risk: { ...preset.risk },
    exits: { ...preset.exits },
    mutations: [],
  };
}

/** Named cross-breeds from the hatch map (Fire + Storm = Inferno, etc.). */
export const CROSSBREEDS: Record<string, { parents: [string, string]; name: string }> = {
  inferno: { parents: ["fire", "storm"], name: "Inferno" },
  forge: { parents: ["fire", "steel"], name: "Forge" },
  bloomlight: { parents: ["plant", "solar"], name: "Bloomlight" },
  glaciertide: { parents: ["ice", "ocean"], name: "Glacier Tide" },
  eclipse: { parents: ["shadow", "storm"], name: "Eclipse" },
  evergreen: { parents: ["plant", "steel"], name: "Evergreen" },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Cross-breed two genomes. Numeric exit/risk params are interpolated; the entry
 * logic is inherited from parent A and its filters from parent B, so the child
 * is a genuine blend rather than a copy. `childSpecies` tags the new species.
 */
export function crossbreed(
  a: Genome,
  b: Genome,
  childSpecies: Species,
  parentIds: [string, string],
  t = 0.5,
): Genome {
  return {
    species: childSpecies,
    parents: parentIds,
    generation: Math.max(a.generation, b.generation) + 1,
    universe: Array.from(new Set([...a.universe, ...b.universe])),
    timeframe: a.timeframe,
    entry: { type: a.entry.type, params: { ...a.entry.params } },
    filters: b.filters.map((f) => ({ ...f })),
    risk: {
      style: a.risk.style,
      positionSizePct: round2(lerp(a.risk.positionSizePct, b.risk.positionSizePct, t)),
      maxConcurrent: Math.max(a.risk.maxConcurrent, b.risk.maxConcurrent),
    },
    exits: {
      stopLossPct: round2(lerp(a.exits.stopLossPct, b.exits.stopLossPct, t)),
      takeProfitPct: blendNullable(a.exits.takeProfitPct, b.exits.takeProfitPct, t),
      trailing: a.exits.trailing || b.exits.trailing,
      timeExitBars: a.exits.timeExitBars ?? b.exits.timeExitBars,
      scaleOut: a.exits.scaleOut || b.exits.scaleOut,
    },
    mutations: Array.from(new Set([...a.mutations, ...b.mutations])),
  };
}

function blendNullable(a: number | null, b: number | null, t: number): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return round2(lerp(a, b, t));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const MUTATION_LABELS: Record<Mutation, string> = {
  precision: "Precision — tighter, more selective entries",
  patience: "Patience — holds longer, trades less",
  adaptability: "Adaptability — wider volatility tolerance",
  protection: "Protection — wider stops, smaller size",
  speed: "Speed — quicker exits",
};

export function mutationLabel(m: Mutation): string {
  return MUTATION_LABELS[m] ?? m;
}

/**
 * Apply a perk to a genome, returning a new genome. Perks are small, bounded
 * modifiers — never a free win, always a trade-off.
 */
export function applyMutation(g: Genome, m: Mutation): Genome {
  const next: Genome = structuredCloneGenome(g);
  if (!next.mutations.includes(m)) next.mutations.push(m);

  switch (m) {
    case "precision":
      // Demand a stronger breakout / a deeper RSI extreme.
      if (next.entry.params.lookback != null)
        next.entry.params.lookback = Math.round(next.entry.params.lookback * 1.25);
      if (next.entry.params.threshold != null)
        next.entry.params.threshold = round2(next.entry.params.threshold * 0.85);
      break;
    case "patience":
      if (next.exits.timeExitBars != null)
        next.exits.timeExitBars = Math.round(next.exits.timeExitBars * 1.5);
      else next.exits.timeExitBars = null;
      next.exits.trailing = true;
      break;
    case "adaptability":
      next.filters = next.filters.map((f) =>
        f.type === "volatility"
          ? { ...f, maxPct: round2((f.maxPct as number) * 1.5) }
          : f,
      );
      break;
    case "protection":
      next.exits.stopLossPct = round2(next.exits.stopLossPct * 1.3);
      next.risk.positionSizePct = round2(next.risk.positionSizePct * 0.8);
      break;
    case "speed":
      next.exits.timeExitBars =
        next.exits.timeExitBars != null
          ? Math.max(1, Math.round(next.exits.timeExitBars * 0.6))
          : 8;
      break;
  }
  return next;
}

function structuredCloneGenome(g: Genome): Genome {
  return {
    ...g,
    universe: [...g.universe],
    entry: { type: g.entry.type, params: { ...g.entry.params } },
    filters: g.filters.map((f) => ({ ...f })),
    risk: { ...g.risk },
    exits: { ...g.exits },
    mutations: [...g.mutations],
  };
}
