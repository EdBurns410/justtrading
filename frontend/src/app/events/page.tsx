"use client";

import { useEffect, useState } from "react";
import { apiFetch, EventRecord } from "@/lib/api";

const eventTypeColors: Record<string, string> = {
  macro_release: "badge-blue",
  central_bank: "badge-purple",
  geopolitical: "badge-red",
  commodity_supply: "badge-yellow",
  risk_sentiment: "badge-yellow",
  price_action: "badge-gray",
  other: "badge-gray",
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const params = filter ? `?event_type=${filter}` : "";
    apiFetch<EventRecord[]>(`/events${params}`).then(setEvents).catch(() => {});

    const interval = setInterval(() => {
      const params = filter ? `?event_type=${filter}` : "";
      apiFetch<EventRecord[]>(`/events${params}`).then(setEvents).catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [filter]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Event Feed</h2>
        <p className="text-sm text-text-muted">All ingested market events across data sources</p>
      </div>

      <div className="mb-4 flex gap-2">
        {["", "macro_release", "central_bank", "geopolitical", "commodity_supply"].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filter === type
                ? "bg-accent-blue text-white"
                : "bg-bg-card text-text-secondary hover:bg-bg-hover"
            }`}
          >
            {type || "All"}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Time</th>
              <th className="table-header">Source</th>
              <th className="table-header">Type</th>
              <th className="table-header">Title</th>
              <th className="table-header">Sentiment</th>
              <th className="table-header">Instruments</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="table-cell text-center text-text-muted">
                  No events ingested yet. Start the backend with API keys configured.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-bg-hover">
                <td className="table-cell whitespace-nowrap text-xs font-mono text-text-muted">
                  {new Date(e.ingested_at).toLocaleString()}
                </td>
                <td className="table-cell">
                  <span className="badge-gray">{e.source}</span>
                </td>
                <td className="table-cell">
                  <span className={eventTypeColors[e.event_type] || "badge-gray"}>
                    {e.event_type}
                  </span>
                </td>
                <td className="table-cell max-w-md truncate">{e.title}</td>
                <td className="table-cell font-mono">
                  {e.sentiment_score != null ? (
                    <span
                      className={
                        e.sentiment_score > 0
                          ? "text-accent-green"
                          : e.sentiment_score < 0
                            ? "text-accent-red"
                            : "text-text-muted"
                      }
                    >
                      {e.sentiment_score.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-1">
                    {e.affected_instruments?.map((inst) => (
                      <span key={inst} className="badge-blue font-mono text-xs">
                        {inst}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
