// Authoritative, leaderboard-eligible backtest (build sequence M4).
//
// This is the server-side callsite of the SAME engine the browser uses for
// instant preview. Leaderboard integrity is non-negotiable: users cannot be
// trusted to self-report scores, so this route ignores any client-supplied
// metrics entirely and re-runs the genome against FIXED data with FIXED costs.
//
// It is deliberately stateless for the MVP. Persisting the result into the
// `backtests` / `leaderboard_entries` tables (with `verified = true`) is the
// next wiring step once the Supabase project is provisioned.

import { NextResponse } from "next/server";
import { runBacktest, computeRobustness, DEFAULT_CONFIG, type Genome } from "@/lib/engine";
import { getChallengeBars, CHALLENGE_DATASET } from "@/lib/engine/data/challenge";

export const runtime = "nodejs";

function isValidGenome(g: unknown): g is Genome {
  if (typeof g !== "object" || g === null) return false;
  const x = g as Record<string, unknown>;
  return (
    typeof x.species === "string" &&
    typeof x.timeframe === "string" &&
    typeof x.entry === "object" &&
    x.entry !== null &&
    typeof x.risk === "object" &&
    x.risk !== null &&
    typeof x.exits === "object" &&
    x.exits !== null &&
    Array.isArray(x.filters)
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const genome = (body as { genome?: unknown })?.genome;
  if (!isValidGenome(genome)) {
    return NextResponse.json({ error: "Invalid genome" }, { status: 400 });
  }

  // Fixed dataset, fixed cost model — the client cannot influence either.
  const bars = getChallengeBars();
  const result = runBacktest(genome, bars, DEFAULT_CONFIG);
  const robustness = computeRobustness(genome, bars, DEFAULT_CONFIG);

  // Leaderboard score rewards risk-adjusted, robust performance — never raw
  // return alone — so overfit one-regime bots cannot dominate the board.
  const m = result.metrics;
  const score = Number(
    (m.totalReturn * 100 * (0.5 + 0.5 * robustness.score)).toFixed(2),
  );

  return NextResponse.json({
    verified: true,
    dataset: CHALLENGE_DATASET,
    metrics: m,
    robustness,
    score,
    runAt: new Date().toISOString(),
  });
}
