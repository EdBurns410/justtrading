"use client";

import { useEffect, useState } from "react";
import { apiFetch, DashboardStats, RecentTrade } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { messages, connected } = useWebSocket(
    `${typeof window !== "undefined" ? (window.location.protocol === "https:" ? "wss:" : "ws:") : "ws:"}//localhost:8000/api/ws/feed`
  );

  useEffect(() => {
    apiFetch<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch((e) => setError(e.message));

    apiFetch<RecentTrade[]>("/dashboard/recent-trades")
      .then(setTrades)
      .catch(() => {});

    const interval = setInterval(() => {
      apiFetch<DashboardStats>("/dashboard/stats").then(setStats).catch(() => {});
      apiFetch<RecentTrade[]>("/dashboard/recent-trades").then(setTrades).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Trading Dashboard</h2>
          <p className="text-sm text-text-muted">Real-time overview of your trading platform</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-accent-green" : "bg-accent-red"}`} />
          <span className="text-xs text-text-muted">
            {connected ? "Live Feed Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-yellow-600/30 bg-yellow-600/10 p-3 text-sm text-yellow-400">
          Backend not reachable: {error}. Start the backend server to see live data.
        </div>
      )}

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard label="Total Events" value={stats?.total_events ?? "-"} variant="blue" />
        <StatCard label="Active Bots" value={stats?.active_bots ?? "-"} />
        <StatCard
          label="Total P&L"
          value={stats ? `$${stats.total_pnl.toFixed(2)}` : "-"}
          variant={stats && stats.total_pnl >= 0 ? "green" : "red"}
        />
        <StatCard
          label="Win Rate"
          value={stats ? `${stats.win_rate.toFixed(1)}%` : "-"}
          variant={stats && stats.win_rate >= 50 ? "green" : "default"}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Trades */}
        <div className="card">
          <h3 className="mb-3 font-semibold">Recent Trades</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Instrument</th>
                  <th className="table-header">Direction</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Bot</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-cell text-center text-text-muted">
                      No trades yet
                    </td>
                  </tr>
                )}
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-bg-hover">
                    <td className="table-cell font-mono">{t.instrument}</td>
                    <td className="table-cell">
                      <span className={t.direction === "LONG" ? "text-accent-green" : "text-accent-red"}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="table-cell font-mono">{t.fill_price?.toFixed(5) ?? "-"}</td>
                    <td className="table-cell">
                      <span
                        className={
                          t.status === "filled" ? "badge-green" : t.status === "rejected" ? "badge-red" : "badge-yellow"
                        }
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="table-cell text-text-secondary">{t.bot_id ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Event Feed */}
        <div className="card">
          <h3 className="mb-3 font-semibold">Live Event Feed</h3>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-text-muted">Waiting for events...</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="rounded border border-gray-800 bg-bg-secondary p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="badge-blue">{msg.type}</span>
                  <span className="text-xs text-text-muted">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {msg.data && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {(msg.data as Record<string, unknown>).title as string || JSON.stringify(msg.data).slice(0, 100)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Latency & Performance */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Live Bots" value={stats?.live_bots ?? 0} variant="green" />
        <StatCard label="Total Decisions" value={stats?.total_decisions ?? 0} />
        <StatCard label="Total Trades" value={stats?.total_trades ?? 0} />
        <StatCard label="Outcomes Recorded" value={stats?.total_outcomes ?? 0} />
      </div>
    </div>
  );
}
