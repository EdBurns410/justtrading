"use client";

import { useEffect, useState } from "react";
import { apiFetch, BotRecord } from "@/lib/api";
import { StageBadge } from "@/components/StageBadge";

export default function BotsPage() {
  const [bots, setBots] = useState<BotRecord[]>([]);

  useEffect(() => {
    apiFetch<BotRecord[]>("/bots").then(setBots).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Strategy Bots</h2>
        <p className="text-sm text-text-muted">All registered bots and their lifecycle stage</p>
      </div>

      {/* Pipeline View */}
      <div className="mb-8 grid grid-cols-5 gap-3">
        {["research", "backtest", "paper_live", "shadow", "live"].map((stage) => {
          const count = bots.filter((b) => b.stage === stage).length;
          return (
            <div key={stage} className="card text-center">
              <StageBadge stage={stage} />
              <p className="stat-value mt-2">{count}</p>
              <p className="stat-label">bots</p>
            </div>
          );
        })}
      </div>

      {/* Bot List */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Bot ID</th>
              <th className="table-header">Name</th>
              <th className="table-header">Type</th>
              <th className="table-header">Version</th>
              <th className="table-header">Stage</th>
              <th className="table-header">Instruments</th>
              <th className="table-header">Kill Switch</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 && (
              <tr>
                <td colSpan={7} className="table-cell text-center text-text-muted">
                  No bots registered yet.
                </td>
              </tr>
            )}
            {bots.map((bot) => (
              <tr key={bot.id} className="hover:bg-bg-hover">
                <td className="table-cell font-mono text-accent-blue">{bot.bot_id}</td>
                <td className="table-cell">{bot.name}</td>
                <td className="table-cell text-text-secondary">{bot.strategy_type}</td>
                <td className="table-cell font-mono text-text-secondary">{bot.version}</td>
                <td className="table-cell">
                  <StageBadge stage={bot.stage} />
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-1">
                    {bot.allowed_instruments.map((inst) => (
                      <span key={inst} className="badge-blue font-mono text-xs">
                        {inst}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="table-cell">
                  <span className={bot.kill_switch_active ? "badge-red" : "badge-green"}>
                    {bot.kill_switch_active ? "ACTIVE" : "Off"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
