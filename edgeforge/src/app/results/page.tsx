"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RankingResponse } from "@/lib/types";
import { loadRanking } from "@/lib/storage";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Citation } from "@/components/Citation";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ResultsPage() {
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRanking(loadRanking());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!ranking) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-xl font-semibold">No ranking yet</h1>
        <p className="text-text-secondary mt-2">
          Run the intake to get your ranked opportunities.
        </p>
        <Link href="/intake" className="btn-primary inline-block mt-4">
          Start intake
        </Link>
      </div>
    );
  }

  const totalExpected = ranking.rankedOpportunities.reduce(
    (a, o) => a + o.netAnnualROI.expected,
    0,
  );

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your ranked opportunities</h1>
          <p className="text-text-secondary mt-2">
            Computed {formatDate(ranking.computedAt)}. Numbers are estimates; verify
            against your data before acting.
          </p>
        </div>
        <div className="card !p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide">
            Combined expected net
          </div>
          <div className="text-2xl font-semibold text-accent-green">
            {formatCurrency(totalExpected)}/yr
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {ranking.rankedOpportunities.map((opp, i) => (
          <OpportunityCard key={opp.workflowId} opp={opp} rank={i} isTop={i === 0} />
        ))}
      </div>

      {ranking.crossCuttingWarnings.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Reality check</h2>
          <p className="text-sm text-text-secondary">
            Before you act on any of the above, the broader market data is sobering:
          </p>
          <div className="space-y-2">
            {ranking.crossCuttingWarnings.map((b) => (
              <Citation key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <Link href="/intake" className="btn-secondary">
          Edit intake
        </Link>
        {ranking.rankedOpportunities[0] && (
          <Link
            href={`/action-plan/${ranking.rankedOpportunities[0].workflowId}`}
            className="btn-primary"
          >
            Open top-pick action plan
          </Link>
        )}
      </div>
    </div>
  );
}
