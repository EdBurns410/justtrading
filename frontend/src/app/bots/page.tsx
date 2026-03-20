"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, BotRecord, BotDetailRecord } from "@/lib/api";
import { StageBadge } from "@/components/StageBadge";

const VALID_INSTRUMENTS = [
  "EUR_USD", "GBP_USD", "USD_JPY", "AUD_USD", "USD_CHF",
  "EUR_GBP", "EUR_JPY", "GBP_JPY", "AUD_JPY", "NZD_USD",
  "USD_CAD", "EUR_AUD", "EUR_CHF",
  "XAU_USD", "XAG_USD",
  "BCO_USD", "WTICO_USD",
];

const STRATEGY_TYPES = [
  { value: "macro_fx", label: "Macro FX — Trades macro releases & central bank events" },
  { value: "sentiment", label: "Sentiment — News sentiment-driven signals" },
  { value: "technical", label: "Technical — Price action & technical indicators" },
  { value: "custom", label: "Custom — User-defined strategy logic" },
];

interface CreateBotForm {
  bot_id: string;
  name: string;
  strategy_type: string;
  version: string;
  allowed_instruments: string[];
  confidence_threshold: number;
  max_spread_pips: number;
  max_slippage_pips: number;
  max_concurrent_exposure: number;
}

const EMPTY_FORM: CreateBotForm = {
  bot_id: "",
  name: "",
  strategy_type: "macro_fx",
  version: "1.0.0",
  allowed_instruments: [],
  confidence_threshold: 0.7,
  max_spread_pips: 3.0,
  max_slippage_pips: 2.0,
  max_concurrent_exposure: 2,
};

export default function BotsPage() {
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateBotForm>({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingKillSwitch, setTogglingKillSwitch] = useState<string | null>(null);

  const loadBots = useCallback(() => {
    apiFetch<BotRecord[]>("/bots").then(setBots).catch(() => {});
  }, []);

  useEffect(() => { loadBots(); }, [loadBots]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.allowed_instruments.length === 0) {
      setError("Select at least one instrument");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await apiFetch("/manage/bots", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      loadBots();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create bot");
    }
    setCreating(false);
  }

  async function toggleKillSwitch(botId: string, currentState: boolean) {
    setTogglingKillSwitch(botId);
    try {
      await apiFetch(`/bots/${botId}/kill-switch?active=${!currentState}`, {
        method: "POST",
      });
      loadBots();
    } catch {}
    setTogglingKillSwitch(null);
  }

  async function deleteBot(botId: string) {
    if (!confirm(`Delete bot "${botId}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/manage/bots/${botId}`, { method: "DELETE" });
      loadBots();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete bot");
    }
  }

  function toggleInstrument(inst: string) {
    setForm((f) => ({
      ...f,
      allowed_instruments: f.allowed_instruments.includes(inst)
        ? f.allowed_instruments.filter((i) => i !== inst)
        : [...f.allowed_instruments, inst],
    }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Strategy Bots</h2>
          <p className="text-sm text-text-muted">All registered bots and their lifecycle stage</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80"
        >
          {showCreate ? "Cancel" : "+ Create Bot"}
        </button>
      </div>

      {/* Create Bot Form */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="mb-4 text-lg font-semibold">Create New Bot</h3>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Bot ID</label>
                <input
                  value={form.bot_id}
                  onChange={(e) => setForm({ ...form, bot_id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                  required
                  placeholder="my_macro_bot"
                  className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
                />
                <p className="mt-1 text-xs text-text-muted">Lowercase letters, numbers, underscores only</p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Display Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="My Macro Bot"
                  className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">Strategy Type</label>
              <select
                value={form.strategy_type}
                onChange={(e) => setForm({ ...form, strategy_type: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
              >
                {STRATEGY_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-text-secondary">
                Instruments ({form.allowed_instruments.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {VALID_INSTRUMENTS.map((inst) => {
                  const selected = form.allowed_instruments.includes(inst);
                  return (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => toggleInstrument(inst)}
                      className={`rounded-full px-3 py-1 text-xs font-mono transition-colors ${
                        selected
                          ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/50"
                          : "bg-bg-secondary text-text-muted border border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {inst}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Confidence Threshold</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={form.confidence_threshold}
                  onChange={(e) => setForm({ ...form, confidence_threshold: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Max Spread (pips)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.max_spread_pips}
                  onChange={(e) => setForm({ ...form, max_spread_pips: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Max Slippage (pips)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.max_slippage_pips}
                  onChange={(e) => setForm({ ...form, max_slippage_pips: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Max Concurrent Exposure</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.max_concurrent_exposure}
                  onChange={(e) => setForm({ ...form, max_concurrent_exposure: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-accent-green px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-green/80 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Bot"}
            </button>
          </form>
        </div>
      )}

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
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 && (
              <tr>
                <td colSpan={8} className="table-cell text-center text-text-muted">
                  No bots registered yet. Create one above to get started.
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
                  <button
                    onClick={() => toggleKillSwitch(bot.bot_id, bot.kill_switch_active)}
                    disabled={togglingKillSwitch === bot.bot_id}
                    className={`${bot.kill_switch_active ? "badge-red" : "badge-green"} cursor-pointer hover:opacity-80`}
                  >
                    {bot.kill_switch_active ? "ACTIVE" : "Off"}
                  </button>
                </td>
                <td className="table-cell">
                  {(bot.stage === "research" || bot.stage === "retired") && (
                    <button
                      onClick={() => deleteBot(bot.bot_id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
