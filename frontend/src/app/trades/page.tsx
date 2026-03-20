"use client";

import { useEffect, useState } from "react";
import { apiFetch, ExecutionRecord, OutcomeRecord } from "@/lib/api";

export default function TradesPage() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [tab, setTab] = useState<"executions" | "outcomes">("executions");

  useEffect(() => {
    apiFetch<ExecutionRecord[]>("/executions").then(setExecutions).catch(() => {});
    apiFetch<OutcomeRecord[]>("/outcomes").then(setOutcomes).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Trade Audit Trail</h2>
        <p className="text-sm text-text-muted">Full execution and outcome records</p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("executions")}
          className={`rounded-full px-4 py-1 text-sm ${
            tab === "executions" ? "bg-accent-blue text-white" : "bg-bg-card text-text-secondary"
          }`}
        >
          Executions ({executions.length})
        </button>
        <button
          onClick={() => setTab("outcomes")}
          className={`rounded-full px-4 py-1 text-sm ${
            tab === "outcomes" ? "bg-accent-blue text-white" : "bg-bg-card text-text-secondary"
          }`}
        >
          Outcomes ({outcomes.length})
        </button>
      </div>

      {tab === "executions" && (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Time</th>
                <th className="table-header">Instrument</th>
                <th className="table-header">Direction</th>
                <th className="table-header">Size</th>
                <th className="table-header">Fill Price</th>
                <th className="table-header">SL</th>
                <th className="table-header">TP</th>
                <th className="table-header">Slippage</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 && (
                <tr>
                  <td colSpan={9} className="table-cell text-center text-text-muted">
                    No executions yet.
                  </td>
                </tr>
              )}
              {executions.map((e) => (
                <tr key={e.id} className="hover:bg-bg-hover">
                  <td className="table-cell whitespace-nowrap font-mono text-xs text-text-muted">
                    {new Date(e.order_submitted_at).toLocaleString()}
                  </td>
                  <td className="table-cell font-mono">{e.instrument}</td>
                  <td className="table-cell">
                    <span className={e.direction === "LONG" ? "text-accent-green" : "text-accent-red"}>
                      {e.direction}
                    </span>
                  </td>
                  <td className="table-cell font-mono">{e.size}</td>
                  <td className="table-cell font-mono">{e.fill_price?.toFixed(5) ?? "-"}</td>
                  <td className="table-cell font-mono text-accent-red">{e.stop_loss?.toFixed(5) ?? "-"}</td>
                  <td className="table-cell font-mono text-accent-green">{e.take_profit?.toFixed(5) ?? "-"}</td>
                  <td className="table-cell font-mono">{e.slippage?.toFixed(5) ?? "-"}</td>
                  <td className="table-cell">
                    <span
                      className={
                        e.status === "filled" ? "badge-green" : e.status === "rejected" ? "badge-red" : "badge-yellow"
                      }
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "outcomes" && (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">P&L</th>
                <th className="table-header">Pips</th>
                <th className="table-header">MAE</th>
                <th className="table-header">MFE</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Exit Reason</th>
                <th className="table-header">Reaction Time</th>
                <th className="table-header">Exec Latency</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-text-muted">
                    No outcomes recorded yet.
                  </td>
                </tr>
              )}
              {outcomes.map((o) => (
                <tr key={o.id} className="hover:bg-bg-hover">
                  <td className="table-cell font-mono">
                    <span className={o.realised_pnl >= 0 ? "text-accent-green" : "text-accent-red"}>
                      ${o.realised_pnl.toFixed(2)}
                    </span>
                  </td>
                  <td className="table-cell font-mono">{o.realised_pnl_pips?.toFixed(1) ?? "-"}</td>
                  <td className="table-cell font-mono text-accent-red">
                    {o.max_adverse_excursion?.toFixed(2) ?? "-"}
                  </td>
                  <td className="table-cell font-mono text-accent-green">
                    {o.max_favourable_excursion?.toFixed(2) ?? "-"}
                  </td>
                  <td className="table-cell text-text-secondary">
                    {o.time_in_trade_seconds ? `${Math.round(o.time_in_trade_seconds / 60)}m` : "-"}
                  </td>
                  <td className="table-cell">
                    <span className="badge-gray">{o.exit_reason}</span>
                  </td>
                  <td className="table-cell font-mono">
                    {o.reaction_time_seconds ? `${o.reaction_time_seconds.toFixed(1)}s` : "-"}
                  </td>
                  <td className="table-cell font-mono">
                    {o.execution_latency_seconds ? `${o.execution_latency_seconds.toFixed(1)}s` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
