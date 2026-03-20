"use client";

import { useEffect, useState } from "react";
import { apiFetch, DecisionRecord } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

export default function RiskPage() {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);

  useEffect(() => {
    apiFetch<DecisionRecord[]>("/decisions?limit=100").then(setDecisions).catch(() => {});
  }, []);

  const totalDecisions = decisions.length;
  const passedRisk = decisions.filter((d) => d.all_risk_checks_passed).length;
  const failedRisk = decisions.filter((d) => !d.all_risk_checks_passed).length;
  const skipped = decisions.filter((d) => d.action === "SKIP").length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Risk Monitor</h2>
        <p className="text-sm text-text-muted">Risk check outcomes and decision audit trail</p>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard label="Total Decisions" value={totalDecisions} variant="blue" />
        <StatCard label="Risk Passed" value={passedRisk} variant="green" />
        <StatCard label="Risk Failed" value={failedRisk} variant="red" />
        <StatCard label="Skipped" value={skipped} />
      </div>

      {/* Risk check pass rate bar */}
      <div className="card mb-6">
        <h3 className="mb-2 font-semibold">Risk Check Pass Rate</h3>
        <div className="h-4 overflow-hidden rounded-full bg-bg-secondary">
          <div
            className="h-full rounded-full bg-accent-green transition-all"
            style={{ width: `${totalDecisions ? (passedRisk / totalDecisions) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {totalDecisions ? ((passedRisk / totalDecisions) * 100).toFixed(1) : 0}% of decisions passed all risk checks
        </p>
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold">Recent Decisions</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Time</th>
              <th className="table-header">Bot</th>
              <th className="table-header">Action</th>
              <th className="table-header">Instrument</th>
              <th className="table-header">Confidence</th>
              <th className="table-header">Risk Check</th>
              <th className="table-header">Reason</th>
            </tr>
          </thead>
          <tbody>
            {decisions.length === 0 && (
              <tr>
                <td colSpan={7} className="table-cell text-center text-text-muted">
                  No decisions yet.
                </td>
              </tr>
            )}
            {decisions.map((d) => (
              <tr key={d.id} className="hover:bg-bg-hover">
                <td className="table-cell whitespace-nowrap font-mono text-xs text-text-muted">
                  {new Date(d.decision_at).toLocaleString()}
                </td>
                <td className="table-cell text-accent-blue">{d.bot_id}</td>
                <td className="table-cell">
                  <span
                    className={
                      d.action === "SKIP"
                        ? "badge-gray"
                        : d.action === "LONG" || d.action === "BUY"
                          ? "badge-green"
                          : "badge-red"
                    }
                  >
                    {d.action}
                  </span>
                </td>
                <td className="table-cell font-mono">{d.instrument ?? "-"}</td>
                <td className="table-cell font-mono">
                  {d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : "-"}
                </td>
                <td className="table-cell">
                  <span className={d.all_risk_checks_passed ? "badge-green" : "badge-red"}>
                    {d.all_risk_checks_passed ? "PASSED" : "FAILED"}
                  </span>
                </td>
                <td className="table-cell max-w-xs truncate text-text-secondary">{d.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
