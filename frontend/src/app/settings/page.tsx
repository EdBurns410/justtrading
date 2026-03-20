"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiKeysMasked } from "@/lib/api";

interface FieldState {
  value: string;
  editing: boolean;
  saved: string; // masked value from server
}

export default function SettingsPage() {
  const [oandaToken, setOandaToken] = useState<FieldState>({ value: "", editing: false, saved: "" });
  const [oandaAccount, setOandaAccount] = useState<FieldState>({ value: "", editing: false, saved: "" });
  const [oandaLive, setOandaLive] = useState(false);
  const [perigonKey, setPerigonKey] = useState<FieldState>({ value: "", editing: false, saved: "" });
  const [finnhubKey, setFinnhubKey] = useState<FieldState>({ value: "", editing: false, saved: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<ApiKeysMasked>("/settings")
      .then((data) => {
        setOandaToken({ value: "", editing: false, saved: data.oanda_api_token });
        setOandaAccount({ value: "", editing: false, saved: data.oanda_account_id });
        setOandaLive(data.oanda_is_live);
        setPerigonKey({ value: "", editing: false, saved: data.perigon_api_key });
        setFinnhubKey({ value: "", editing: false, saved: data.finnhub_api_key });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { oanda_is_live: oandaLive };
      if (oandaToken.editing && oandaToken.value) body.oanda_api_token = oandaToken.value;
      if (oandaAccount.editing && oandaAccount.value) body.oanda_account_id = oandaAccount.value;
      if (perigonKey.editing && perigonKey.value) body.perigon_api_key = perigonKey.value;
      if (finnhubKey.editing && finnhubKey.value) body.finnhub_api_key = finnhubKey.value;

      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });

      // Reload masked values
      const data = await apiFetch<ApiKeysMasked>("/settings");
      setOandaToken({ value: "", editing: false, saved: data.oanda_api_token });
      setOandaAccount({ value: "", editing: false, saved: data.oanda_account_id });
      setOandaLive(data.oanda_is_live);
      setPerigonKey({ value: "", editing: false, saved: data.perigon_api_key });
      setFinnhubKey({ value: "", editing: false, saved: data.finnhub_api_key });

      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save settings" });
    }
    setSaving(false);
  }

  if (!loaded) {
    return <div className="text-text-muted">Loading settings...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-text-muted">Manage your API keys and trading configuration</p>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* OANDA */}
      <div className="card mb-4">
        <h3 className="mb-4 text-lg font-semibold">OANDA (Trading Broker)</h3>
        <p className="mb-4 text-xs text-text-muted">
          Connect your OANDA account for live/practice trading. Get your API token from{" "}
          <span className="text-accent-blue">fxtrade.oanda.com</span>.
        </p>

        <div className="space-y-3">
          <ApiKeyField
            label="API Token"
            field={oandaToken}
            onEdit={() => setOandaToken({ ...oandaToken, editing: true })}
            onChange={(v) => setOandaToken({ ...oandaToken, value: v })}
          />
          <ApiKeyField
            label="Account ID"
            field={oandaAccount}
            onEdit={() => setOandaAccount({ ...oandaAccount, editing: true })}
            onChange={(v) => setOandaAccount({ ...oandaAccount, value: v })}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Live Trading</label>
            <button
              onClick={() => setOandaLive(!oandaLive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                oandaLive ? "bg-red-500" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  oandaLive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            {oandaLive && (
              <span className="badge-red text-xs">LIVE MODE — Real money at risk</span>
            )}
          </div>
        </div>
      </div>

      {/* Perigon */}
      <div className="card mb-4">
        <h3 className="mb-4 text-lg font-semibold">Perigon (News & Events)</h3>
        <p className="mb-4 text-xs text-text-muted">
          Real-time news and economic event data for trading signals.
        </p>
        <ApiKeyField
          label="API Key"
          field={perigonKey}
          onEdit={() => setPerigonKey({ ...perigonKey, editing: true })}
          onChange={(v) => setPerigonKey({ ...perigonKey, value: v })}
        />
      </div>

      {/* Finnhub */}
      <div className="card mb-4">
        <h3 className="mb-4 text-lg font-semibold">Finnhub (Sentiment & Calendar)</h3>
        <p className="mb-4 text-xs text-text-muted">
          Sentiment analysis and economic calendar data.
        </p>
        <ApiKeyField
          label="API Key"
          field={finnhubKey}
          onEdit={() => setFinnhubKey({ ...finnhubKey, editing: true })}
          onChange={(v) => setFinnhubKey({ ...finnhubKey, value: v })}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-accent-blue px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-blue/80 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

function ApiKeyField({
  label,
  field,
  onEdit,
  onChange,
}: {
  label: string;
  field: FieldState;
  onEdit: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-text-secondary">{label}</label>
      <div className="flex gap-2">
        {field.editing ? (
          <input
            type="password"
            value={field.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter new value"
            className="flex-1 rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
          />
        ) : (
          <div className="flex flex-1 items-center rounded-lg border border-gray-700 bg-bg-secondary px-4 py-2">
            <span className="font-mono text-sm text-text-muted">
              {field.saved || "Not configured"}
            </span>
          </div>
        )}
        {!field.editing && (
          <button
            onClick={onEdit}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
