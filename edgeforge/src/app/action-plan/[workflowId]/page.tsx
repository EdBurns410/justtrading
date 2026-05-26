"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { RankingResponse, WorkflowId } from "@/lib/types";
import { loadRanking } from "@/lib/storage";
import { buildActionPlan, type ActionPlan } from "@/lib/action-plan";
import { formatCurrency } from "@/lib/format";

export default function ActionPlanPage() {
  const params = useParams<{ workflowId: string }>();
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const r = loadRanking();
    setRanking(r);
    setHydrated(true);
    if (!r) return;
    const opp = r.rankedOpportunities.find((o) => o.workflowId === params.workflowId);
    if (!opp) {
      setNotFound(true);
      return;
    }
    setPlan(buildActionPlan(opp));
  }, [params.workflowId]);

  if (!hydrated) return null;

  if (!ranking) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-xl font-semibold">Run the intake first</h1>
        <Link href="/intake" className="btn-primary inline-block mt-4">
          Start intake
        </Link>
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-xl font-semibold">Workflow not in your ranking</h1>
        <p className="text-text-secondary mt-2">
          Either you set 0 hours for it in the intake, or it&apos;s not a supported workflow.
        </p>
        <Link href="/results" className="btn-secondary inline-block mt-4">
          Back to results
        </Link>
      </div>
    );
  }

  const opp = ranking.rankedOpportunities.find((o) => o.workflowId === plan.workflowId)!;

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wide">Action plan</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">{plan.workflowName}</h1>
        <p className="text-text-secondary mt-2">
          A {plan.pilotDays}-day pilot scoped so the answer is unambiguous at the end.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Pilot at a glance</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <Stat label="Length" value={`${plan.pilotDays} days`} />
          <Stat label="Primary metric" value={plan.pilotMetric} />
          <Stat
            label="Pilot cost (expected)"
            value={formatCurrency(plan.estimatedPilotCost.expected)}
          />
        </div>
        <div className="text-xs text-text-muted">
          Pilot cost range: {formatCurrency(plan.estimatedPilotCost.low)} —{" "}
          {formatCurrency(plan.estimatedPilotCost.high)}. Includes ~40% of full
          implementation effort plus tool costs for the pilot window.
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Go / no-go criteria (write these down before starting)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          {plan.goNoGoCriteria.map((c) => (
            <li key={c} className="text-text-secondary">
              {c}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="font-semibold">Week one</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
            {plan.weekOne.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
        <div className="card space-y-3">
          <h2 className="font-semibold">Week two (and beyond, if longer)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
            {plan.weekTwo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Vendor candidates</h2>
          <span className="tag tag-blue">{plan.buildVsBuy} recommended</span>
        </div>
        <div className="space-y-3">
          {plan.vendorCandidates.map((v) => (
            <div
              key={v.name}
              className="rounded-lg border border-bg-border p-4 space-y-1"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-text-muted">{v.monthlyCostBand}</div>
              </div>
              <div className="text-sm text-text-secondary">{v.positioning}</div>
              <div className="text-xs text-text-muted">Best for: {v.bestFor}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Vendor list is curated, not paid placement. Verify pricing on each
          vendor&apos;s site before signing.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Risks specific to this workflow</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-text-secondary">
          {plan.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Reminder: your numbers</h2>
        <p className="text-sm text-text-secondary">
          Expected net annual ROI for this workflow:{" "}
          <span className="text-accent-green font-medium">
            {formatCurrency(opp.netAnnualROI.expected)}
          </span>{" "}
          (low {formatCurrency(opp.netAnnualROI.low)}, high{" "}
          {formatCurrency(opp.netAnnualROI.high)}). Confidence: {opp.confidence}.
        </p>
      </section>

      <div className="flex gap-3">
        <Link href="/results" className="btn-secondary">
          Back to results
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
