"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import workflowsJson from "@/data/workflows.json";
import type { IntakeAnswers, RevenueBand, RiskTolerance, Workflow, WorkflowId } from "@/lib/types";
import { loadIntake, saveIntake, saveRanking } from "@/lib/storage";

const workflows = (workflowsJson as Workflow[]).filter((w) => w.id !== "_cross_cutting");

const REVENUE_OPTIONS: { value: RevenueBand; label: string }[] = [
  { value: "under_250k", label: "Under $250k" },
  { value: "250k_1m", label: "$250k – $1M" },
  { value: "1m_5m", label: "$1M – $5M" },
  { value: "over_5m", label: "Over $5M" },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string; help: string }[] = [
  {
    value: "low",
    label: "Low",
    help: "Heavy haircut on benchmarks; only the highest-confidence wins surface.",
  },
  {
    value: "medium",
    label: "Medium",
    help: "Realistic mid-case using expected benchmark values.",
  },
  {
    value: "high",
    label: "High",
    help: "Take benchmarks at face value; willing to absorb misses for upside.",
  },
];

const defaultIntake: IntakeAnswers = {
  revenueBand: "250k_1m",
  teamSize: 3,
  fullyLoadedHourlyCost: 75,
  workflowHours: {},
  budgetMonthly: 250,
  riskTolerance: "medium",
  currentTools: "",
};

export default function IntakePage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<IntakeAnswers>(defaultIntake);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadIntake();
    if (saved) setAnswers({ ...defaultIntake, ...saved });
  }, []);

  function updateWorkflowHours(id: WorkflowId, value: string) {
    const n = value === "" ? 0 : Math.max(0, Math.min(80, Number(value)));
    if (Number.isNaN(n)) return;
    setAnswers((prev) => ({
      ...prev,
      workflowHours: { ...prev.workflowHours, [id]: n },
    }));
  }

  const totalHoursLogged = Object.values(answers.workflowHours).reduce(
    (a, b) => a + (Number(b) || 0),
    0,
  );

  async function onSubmit() {
    setError(null);
    if (totalHoursLogged <= 0) {
      setError("Add at least one workflow with hours/week > 0 before continuing.");
      return;
    }
    if (answers.fullyLoadedHourlyCost <= 0) {
      setError("Fully-loaded hourly cost must be greater than 0.");
      return;
    }
    setSubmitting(true);
    saveIntake(answers);
    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!res.ok) throw new Error(`Ranking failed (${res.status})`);
      const data = await res.json();
      saveRanking(data);
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Intake</h1>
        <p className="text-text-secondary mt-2">
          12 questions, ~5 minutes. Your answers stay in your browser.
        </p>
      </div>

      <section className="card space-y-5">
        <h2 className="font-semibold">About your business</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-text-secondary">Annual revenue</span>
            <select
              className="mt-1"
              value={answers.revenueBand}
              onChange={(e) =>
                setAnswers({ ...answers, revenueBand: e.target.value as RevenueBand })
              }
            >
              {REVENUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Team size (including you)</span>
            <input
              type="number"
              min={1}
              max={500}
              className="mt-1"
              value={answers.teamSize}
              onChange={(e) =>
                setAnswers({ ...answers, teamSize: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">
              Fully-loaded hourly cost (USD)
            </span>
            <input
              type="number"
              min={10}
              max={500}
              className="mt-1"
              value={answers.fullyLoadedHourlyCost}
              onChange={(e) =>
                setAnswers({
                  ...answers,
                  fullyLoadedHourlyCost: Math.max(10, Number(e.target.value) || 10),
                })
              }
            />
            <span className="block text-xs text-text-muted mt-1">
              Salary + benefits + overhead, divided by hours worked. Default $75/hr.
            </span>
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Monthly budget for AI tools (USD)</span>
            <input
              type="number"
              min={0}
              max={50000}
              className="mt-1"
              value={answers.budgetMonthly}
              onChange={(e) =>
                setAnswers({ ...answers, budgetMonthly: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
        </div>
      </section>

      <section className="card space-y-5">
        <div>
          <h2 className="font-semibold">Where does the time actually go?</h2>
          <p className="text-sm text-text-secondary mt-1">
            Hours per week your team spends on each workflow. Set 0 if it doesn&apos;t apply.
          </p>
        </div>
        <div className="space-y-3">
          {workflows.map((w) => (
            <div
              key={w.id}
              className="flex items-start gap-4 py-3 border-b border-bg-border last:border-0"
            >
              <div className="flex-1">
                <div className="font-medium">{w.name}</div>
                <div className="text-sm text-text-secondary">{w.description}</div>
              </div>
              <div className="w-24 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={80}
                  step={0.5}
                  placeholder="0"
                  value={
                    answers.workflowHours[w.id as WorkflowId] === undefined
                      ? ""
                      : String(answers.workflowHours[w.id as WorkflowId])
                  }
                  onChange={(e) => updateWorkflowHours(w.id as WorkflowId, e.target.value)}
                />
                <div className="text-xs text-text-muted text-right mt-1">hrs/wk</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-text-secondary">
          Total logged:{" "}
          <span className="font-semibold text-text-primary">{totalHoursLogged} hrs/wk</span>
        </div>
      </section>

      <section className="card space-y-5">
        <h2 className="font-semibold">Risk tolerance</h2>
        <p className="text-sm text-text-secondary">
          We use this to discount benchmark ranges. Conservative is the safer
          number for board reporting.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {RISK_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setAnswers({ ...answers, riskTolerance: o.value })}
              className={
                "text-left p-4 rounded-lg border transition " +
                (answers.riskTolerance === o.value
                  ? "border-accent-blue bg-bg-hover"
                  : "border-bg-border hover:bg-bg-hover")
              }
            >
              <div className="font-semibold">{o.label}</div>
              <div className="text-xs text-text-secondary mt-1">{o.help}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <label className="block">
          <span className="font-semibold">Current tool stack (optional)</span>
          <span className="block text-sm text-text-secondary mt-1">
            What do you use today for support, CRM, content, etc.? Helps us
            recommend compatible vendors.
          </span>
          <textarea
            className="mt-2"
            rows={3}
            placeholder="e.g. HubSpot, Intercom, Notion, QuickBooks"
            value={answers.currentTools}
            onChange={(e) => setAnswers({ ...answers, currentTools: e.target.value })}
          />
        </label>
      </section>

      {error && (
        <div className="card border-accent-red text-accent-red text-sm">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onSubmit} disabled={submitting} className="btn-primary">
          {submitting ? "Ranking…" : "Rank my opportunities"}
        </button>
        <span className="text-sm text-text-muted">
          We&apos;ll run the math locally and show your ranked list.
        </span>
      </div>
    </div>
  );
}
