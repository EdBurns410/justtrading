"use client";

import { useEffect, useMemo, useState } from "react";
import {
  runBacktest,
  computeRobustness,
  leaderboardScore,
  genomeFromSpecies,
  CORE_SPECIES,
  DEFAULT_CONFIG,
  type Genome,
  type Metrics,
} from "@/lib/engine";
import { getChallengeBars, CHALLENGE_DATASET } from "@/lib/engine/data/challenge";
import { loadCollection } from "@/lib/tragon/collection";

const GLYPH: Record<string, string> = {
  fire: "🔥", ice: "❄️", plant: "🌱", storm: "⚡",
  steel: "⚙️", shadow: "🌑", ocean: "🌊", solar: "☀️",
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Entry {
  id: string;
  name: string;
  species: string;
  genome: Genome;
  house: boolean;
}

interface Ranked extends Entry {
  score: number;
  metrics: Metrics;
  verdict: "robust" | "mixed" | "fragile";
  robustness: number;
  verified: boolean;
}

const bars = getChallengeBars();

/** Authoritative score from the server; falls back to the local engine. */
async function scoreGenome(genome: Genome): Promise<{
  score: number;
  metrics: Metrics;
  robustness: number;
  verdict: Ranked["verdict"];
  verified: boolean;
}> {
  try {
    const res = await fetch("/api/leaderboard/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genome }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        score: data.score,
        metrics: data.metrics,
        robustness: data.robustness.score,
        verdict: data.robustness.verdict,
        verified: true,
      };
    }
  } catch {
    /* fall through to local compute */
  }
  const metrics = runBacktest(genome, bars, DEFAULT_CONFIG).metrics;
  const robustness = computeRobustness(genome, bars, DEFAULT_CONFIG);
  return {
    score: leaderboardScore(metrics, robustness.score),
    metrics,
    robustness: robustness.score,
    verdict: robustness.verdict,
    verified: false,
  };
}

export default function LeaderboardPage() {
  const [ranked, setRanked] = useState<Ranked[]>([]);
  const [loading, setLoading] = useState(true);

  const entries: Entry[] = useMemo(() => {
    const house: Entry[] = Object.values(CORE_SPECIES).map((p) => ({
      id: `house-${p.id}`,
      name: `${p.name}`,
      species: String(p.id),
      genome: genomeFromSpecies(String(p.id)),
      house: true,
    }));
    const mine: Entry[] = loadCollection().map((b) => ({
      id: b.id,
      name: b.name,
      species: b.species,
      genome: b.genome,
      house: false,
    }));
    return [...house, ...mine];
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      entries.map(async (e) => ({ ...e, ...(await scoreGenome(e.genome)) })),
    ).then((rows) => {
      if (cancelled) return;
      rows.sort((x, y) => y.score - x.score);
      setRanked(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <p className="text-sm text-text-muted">
          Ranked on {CHALLENGE_DATASET.label}. Score = return × robustness, so
          overfit one-regime bots can&apos;t top the board.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-blue-600/30 bg-blue-600/10 p-2 text-xs text-blue-300">
        Scores are computed by the <strong>server-side authoritative engine</strong>{" "}
        against fixed data and fixed costs — client-reported results are never
        trusted. No pay-to-win: rank cannot be bought.
      </div>

      <div className="card">
        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Running verified backtests…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Bot</th>
                  <th className="table-header">Score</th>
                  <th className="table-header">Return</th>
                  <th className="table-header">Max DD</th>
                  <th className="table-header">Sharpe</th>
                  <th className="table-header">Robustness</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={r.id} className={r.house ? "" : "bg-accent-purple/5"}>
                    <td className="table-cell text-text-muted">{i + 1}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <span>{GLYPH[r.species] ?? "🧬"}</span>
                        <span className="font-medium">{r.name}</span>
                        {r.house ? (
                          <span className="badge-gray">house</span>
                        ) : (
                          <span className="badge-purple">you</span>
                        )}
                        {r.verified && <span className="badge-blue" title="Server-verified">✓</span>}
                      </div>
                    </td>
                    <td className="table-cell font-mono font-semibold">{r.score.toFixed(1)}</td>
                    <td
                      className={`table-cell font-mono ${
                        r.metrics.totalReturn >= 0 ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {pct(r.metrics.totalReturn)}
                    </td>
                    <td className="table-cell font-mono text-text-secondary">
                      {pct(r.metrics.maxDrawdown)}
                    </td>
                    <td className="table-cell font-mono text-text-secondary">
                      {r.metrics.sharpe.toFixed(2)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={
                          r.verdict === "robust"
                            ? "badge-green"
                            : r.verdict === "mixed"
                              ? "badge-yellow"
                              : "badge-red"
                        }
                      >
                        {r.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        Build your own in the <a href="/lab" className="text-accent-purple">Lab</a> and
        breed winners in the <a href="/hatchery" className="text-accent-purple">Hatchery</a>.
      </p>
    </div>
  );
}
