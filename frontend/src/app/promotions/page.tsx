"use client";

import { useEffect, useState } from "react";
import { apiFetch, BotRecord } from "@/lib/api";
import { StageBadge } from "@/components/StageBadge";

const STAGES = ["research", "backtest", "paper_live", "shadow", "promotion_gate", "live"];

interface PromotionRecord {
  id: string;
  from_stage: string;
  to_stage: string;
  promoted_at: string;
  all_gates_passed: boolean;
  total_trades: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  max_drawdown_pct: number | null;
}

export default function PromotionsPage() {
  const [bots, setBots] = useState<BotRecord[]>([]);

  useEffect(() => {
    apiFetch<BotRecord[]>("/bots").then(setBots).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Promotion Pipeline</h2>
        <p className="text-sm text-text-muted">
          Strategy lifecycle from research to live. Every bot must clear all gates.
        </p>
      </div>

      {/* Visual Pipeline */}
      <div className="card mb-8">
        <h3 className="mb-4 font-semibold">Pipeline Overview</h3>
        <div className="flex items-center gap-2">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-16 w-28 items-center justify-center rounded-lg border ${
                    bots.some((b) => b.stage === stage)
                      ? "border-accent-blue bg-accent-blue/10"
                      : "border-gray-700 bg-bg-secondary"
                  }`}
                >
                  <div className="text-center">
                    <StageBadge stage={stage} />
                    <p className="mt-1 text-lg font-bold">
                      {bots.filter((b) => b.stage === stage).length}
                    </p>
                  </div>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="mx-1 text-text-muted">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gate Requirements */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card">
          <h4 className="font-semibold text-accent-purple">Backtest Gate</h4>
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            <li>Min 50 trades</li>
            <li>Profit factor &gt; 1.3</li>
            <li>Max drawdown &lt; 15%</li>
            <li>Positive expectancy &gt; $0.50</li>
            <li>Win rate &gt; 35%</li>
          </ul>
        </div>
        <div className="card">
          <h4 className="font-semibold text-accent-yellow">Forward Test Gate</h4>
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            <li>14-day minimum</li>
            <li>Min 10 trades</li>
            <li>Zero risk breaches</li>
            <li>Slippage within 50% band</li>
            <li>Complete rationale logs</li>
          </ul>
        </div>
        <div className="card">
          <h4 className="font-semibold text-accent-green">Live Gate</h4>
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            <li>Approved version hash</li>
            <li>Kill switch configured</li>
            <li>Alerting configured</li>
            <li>Fixed parameter set</li>
            <li>Risk profile attached</li>
          </ul>
        </div>
      </div>

      {/* Bot stages list */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Bot Stages</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Bot</th>
              <th className="table-header">Type</th>
              <th className="table-header">Version</th>
              <th className="table-header">Current Stage</th>
              <th className="table-header">Instruments</th>
              <th className="table-header">Created</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 && (
              <tr>
                <td colSpan={6} className="table-cell text-center text-text-muted">
                  No bots registered yet. Create bots via the API.
                </td>
              </tr>
            )}
            {bots.map((bot) => (
              <tr key={bot.id} className="hover:bg-bg-hover">
                <td className="table-cell font-semibold text-accent-blue">{bot.bot_id}</td>
                <td className="table-cell text-text-secondary">{bot.strategy_type}</td>
                <td className="table-cell font-mono">{bot.version}</td>
                <td className="table-cell">
                  <StageBadge stage={bot.stage} />
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-1">
                    {bot.allowed_instruments.slice(0, 3).map((inst) => (
                      <span key={inst} className="badge-blue font-mono text-xs">
                        {inst}
                      </span>
                    ))}
                    {bot.allowed_instruments.length > 3 && (
                      <span className="badge-gray text-xs">+{bot.allowed_instruments.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="table-cell text-xs text-text-muted">
                  {new Date(bot.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
