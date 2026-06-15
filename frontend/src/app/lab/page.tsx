"use client";

import { useEffect, useMemo, useState } from "react";
import {
  runBacktest,
  computeRobustness,
  genomeFromSpecies,
  CORE_SPECIES,
  MVP_SPECIES,
  DEFAULT_CONFIG,
  type Genome,
  type Species,
} from "@/lib/engine";
import { getChallengeBars, CHALLENGE_DATASET } from "@/lib/engine/data/challenge";
import { EquityChart } from "@/components/lab/EquityChart";
import {
  loadCollection,
  saveBot as persistBot,
  newId,
  type SavedBot,
} from "@/lib/tragon/collection";

const SPECIES_GLYPH: Record<string, string> = {
  fire: "🔥",
  ice: "❄️",
  steel: "⚙️",
  shadow: "🌑",
};

// The single editable entry parameter exposed per archetype (plan: presets +
// a few sliders for the MVP, not the full seven-step builder yet).
const ENTRY_KNOB: Record<string, { key: string; label: string; min: number; max: number; step: number }> = {
  breakout: { key: "lookback", label: "Breakout lookback (bars)", min: 5, max: 60, step: 1 },
  meanReversion: { key: "threshold", label: "RSI oversold threshold", min: 10, max: 45, step: 1 },
  trendFollow: { key: "shortPeriod", label: "Fast MA period", min: 5, max: 50, step: 1 },
  newsSpike: { key: "volMult", label: "Volume spike multiple", min: 1.5, max: 6, step: 0.5 },
  pullback: { key: "shortPeriod", label: "Pullback MA period", min: 5, max: 40, step: 1 },
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default function LabPage() {
  const [species, setSpecies] = useState<Species>("fire");
  const [positionSizePct, setPositionSizePct] = useState(25);
  const [stopLossPct, setStopLossPct] = useState(8);
  const [tpEnabled, setTpEnabled] = useState(true);
  const [takeProfitPct, setTakeProfitPct] = useState(24);
  const [entryParam, setEntryParam] = useState(20);
  const [collection, setCollection] = useState<SavedBot[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  const preset = CORE_SPECIES[species];
  const knob = ENTRY_KNOB[preset.entry.type];

  // Reset the sliders to the archetype's defaults whenever the egg changes.
  useEffect(() => {
    const base = genomeFromSpecies(species);
    setPositionSizePct(base.risk.positionSizePct);
    setStopLossPct(base.exits.stopLossPct);
    setTpEnabled(base.exits.takeProfitPct != null);
    setTakeProfitPct(base.exits.takeProfitPct ?? 15);
    const k = ENTRY_KNOB[base.entry.type];
    setEntryParam(k ? (base.entry.params[k.key] as number) : 20);
  }, [species]);

  useEffect(() => {
    setCollection(loadCollection());
  }, []);

  const genome: Genome = useMemo(() => {
    const base = genomeFromSpecies(species);
    return {
      ...base,
      risk: { ...base.risk, positionSizePct },
      exits: {
        ...base.exits,
        stopLossPct,
        takeProfitPct: tpEnabled ? takeProfitPct : null,
      },
      entry: knob
        ? { ...base.entry, params: { ...base.entry.params, [knob.key]: entryParam } }
        : base.entry,
    };
  }, [species, positionSizePct, stopLossPct, tpEnabled, takeProfitPct, entryParam, knob]);

  const bars = useMemo(() => getChallengeBars(), []);

  const result = useMemo(() => runBacktest(genome, bars, DEFAULT_CONFIG), [genome, bars]);
  const robustness = useMemo(
    () => computeRobustness(genome, bars, DEFAULT_CONFIG),
    [genome, bars],
  );

  const m = result.metrics;

  function saveBot() {
    const bot: SavedBot = {
      id: newId(String(species)),
      name: `${preset.name} Gen-1`,
      species: String(species),
      generation: 1,
      genome,
      createdAt: Date.now(),
    };
    setCollection(persistBot(bot));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  const verdictBadge =
    robustness.verdict === "robust"
      ? "badge-green"
      : robustness.verdict === "mixed"
        ? "badge-yellow"
        : "badge-red";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Strategy Lab</h2>
          <p className="text-sm text-text-muted">
            Hatch a bot, tune its DNA, and backtest it on {CHALLENGE_DATASET.label}.
          </p>
        </div>
        <div className="text-right text-xs text-text-muted">
          <div>Collection: {collection.length} bots</div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-yellow-600/30 bg-yellow-600/10 p-2 text-xs text-yellow-400">
        Simulation only — not financial advice. Past performance does not predict
        future results.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Builder */}
        <div className="card lg:col-span-1">
          <h3 className="mb-3 font-semibold">1 · Choose an egg</h3>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {MVP_SPECIES.map((s) => {
              const p = CORE_SPECIES[s];
              const active = s === species;
              return (
                <button
                  key={s}
                  onClick={() => setSpecies(s)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-accent-purple bg-accent-purple/10"
                      : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="text-lg">{SPECIES_GLYPH[s]} </div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-text-muted">{p.archetype}</div>
                </button>
              );
            })}
          </div>
          <p className="mb-5 text-xs text-text-secondary">{preset.blurb}</p>

          <h3 className="mb-3 font-semibold">2 · Tune the DNA</h3>
          <div className="space-y-4">
            {knob && (
              <Slider
                label={knob.label}
                value={entryParam}
                min={knob.min}
                max={knob.max}
                step={knob.step}
                onChange={setEntryParam}
                format={(v) => String(v)}
              />
            )}
            <Slider
              label="Position size"
              value={positionSizePct}
              min={2}
              max={100}
              step={1}
              onChange={setPositionSizePct}
              format={(v) => `${v}%`}
            />
            <Slider
              label="Stop loss"
              value={stopLossPct}
              min={1}
              max={25}
              step={0.5}
              onChange={setStopLossPct}
              format={(v) => `${v}%`}
            />
            <div>
              <label className="mb-1 flex items-center justify-between text-sm text-text-secondary">
                <span>Take profit</span>
                <button
                  onClick={() => setTpEnabled((v) => !v)}
                  className={tpEnabled ? "badge-green" : "badge-gray"}
                >
                  {tpEnabled ? "on" : "off"}
                </button>
              </label>
              {tpEnabled && (
                <Slider
                  label=""
                  value={takeProfitPct}
                  min={2}
                  max={60}
                  step={1}
                  onChange={setTakeProfitPct}
                  format={(v) => `${v}%`}
                />
              )}
            </div>
          </div>

          <button
            onClick={saveBot}
            className="mt-6 w-full rounded-lg bg-accent-purple px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-purple/80"
          >
            {justSaved ? "✓ Saved to collection" : "Save bot to collection"}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">3 · Backtest result</h3>
              <span className={m.totalReturn >= 0 ? "badge-green" : "badge-red"}>
                {pct(m.totalReturn)} total return
              </span>
            </div>
            <EquityChart curve={result.equityCurve} initialCapital={DEFAULT_CONFIG.initialCapital} />
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              <Metric label="CAGR" value={pct(m.cagr)} good={m.cagr >= 0} />
              <Metric label="Max DD" value={pct(m.maxDrawdown)} good={m.maxDrawdown > -0.2} />
              <Metric label="Win rate" value={pct(m.winRate)} good={m.winRate >= 0.5} />
              <Metric label="Profit factor" value={m.profitFactor.toFixed(2)} good={m.profitFactor >= 1} />
              <Metric label="Sharpe" value={m.sharpe.toFixed(2)} good={m.sharpe >= 1} />
              <Metric label="Trades" value={String(m.trades)} good={m.trades > 0} />
            </div>
          </div>

          {/* Robustness / overfitting teaching panel */}
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">4 · Robustness check</h3>
              <span className={verdictBadge}>
                {robustness.verdict} · {Math.round(robustness.score * 100)}/100
              </span>
            </div>
            <p className="mb-3 text-xs text-text-muted">
              The same genome is re-tested across four separate slices of history
              (bull, correction, range, recovery). A bot that only wins in one
              regime is <span className="text-yellow-400">overfit</span> — high
              backtest returns that won&apos;t repeat. Consistency beats a single
              flattering number.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {robustness.segments.map((s) => (
                <div key={s.index} className="rounded border border-gray-800 p-2 text-center">
                  <div className="text-xs text-text-muted">Slice {s.index + 1}</div>
                  <div
                    className={`text-sm font-semibold ${
                      s.totalReturn >= 0 ? "text-accent-green" : "text-accent-red"
                    }`}
                  >
                    {pct(s.totalReturn)}
                  </div>
                  <div className="text-[10px] text-text-muted">{s.trades} trades</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trades */}
          <div className="card">
            <h3 className="mb-3 font-semibold">Trade log ({result.trades.length})</h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">#</th>
                    <th className="table-header">Entry</th>
                    <th className="table-header">Exit</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header">Bars</th>
                    <th className="table-header">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-cell text-center text-text-muted">
                        No trades — try loosening the entry or filters.
                      </td>
                    </tr>
                  )}
                  {result.trades.slice(0, 60).map((t, i) => (
                    <tr key={i} className="hover:bg-bg-hover">
                      <td className="table-cell text-text-muted">{i + 1}</td>
                      <td className="table-cell font-mono">{t.entryPrice.toFixed(2)}</td>
                      <td className="table-cell font-mono">{t.exitPrice.toFixed(2)}</td>
                      <td className="table-cell text-text-secondary">{t.reason}</td>
                      <td className="table-cell text-text-muted">{t.barsHeld}</td>
                      <td
                        className={`table-cell font-mono ${
                          t.pnl >= 0 ? "text-accent-green" : "text-accent-red"
                        }`}
                      >
                        {t.pnl >= 0 ? "+" : ""}
                        {t.pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1 flex items-center justify-between text-sm text-text-secondary">
          <span>{label}</span>
          <span className="font-mono text-text-primary">{format(value)}</span>
        </label>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded border border-gray-800 p-2 text-center">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`text-sm font-semibold ${good ? "text-text-primary" : "text-accent-red"}`}>
        {value}
      </div>
    </div>
  );
}
