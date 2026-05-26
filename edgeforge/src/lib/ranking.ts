import type {
  BenchmarkCard,
  IntakeAnswers,
  RankedOpportunity,
  RankingResponse,
  RiskTolerance,
  Workflow,
  WorkflowId,
} from "./types";
import {
  benchmarks,
  getBenchmarksForWorkflow,
  getCrossCuttingBenchmarks,
  getWorkflow,
  isStale,
  workflows,
} from "./data";

const RISK_HAIRCUT: Record<RiskTolerance, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1.0,
};

const COST_RISK_MULTIPLIER: Record<RiskTolerance, number> = {
  low: 0.8,
  medium: 1.0,
  high: 1.3,
};

const WEEKS_PER_YEAR = 52;

// The "automation rate" benchmark per workflow — the headline % that
// estimates how much of the workflow's hours collapse with agentic AI.
// We pick one canonical benchmark per workflow as the driver.
const AUTOMATION_BENCHMARK_BY_WORKFLOW: Record<WorkflowId, string> = {
  customer_support: "cs_deflection_l1",
  sales_ops: "sales_lead_enrichment", // converted to % below
  content_marketing: "content_repurpose_speed", // converted to % below
  bookkeeping: "bookkeeping_close_speed",
  recruiting: "recruiting_screen_speed", // converted to % below
  inbound_qualification: "inbound_demo_conv", // proxy
  knowledge_ops: "knowledge_ttr",
  data_entry: "data_entry_throughput",
};

// For workflows whose canonical benchmark is in absolute units rather
// than %, we coerce to a fractional automation rate via these assumed
// baselines. Documented inline so a reviewer can challenge them.
function coerceToFraction(benchmark: BenchmarkCard, workflowId: WorkflowId): {
  low: number;
  expected: number;
  high: number;
} {
  if (benchmark.unit === "%") {
    return {
      low: benchmark.rangeLow,
      expected: benchmark.rangeExpected,
      high: benchmark.rangeHigh,
    };
  }
  if (benchmark.unit === "% of baseline") {
    return {
      low: 1 - benchmark.rangeHigh,
      expected: 1 - benchmark.rangeExpected,
      high: 1 - benchmark.rangeLow,
    };
  }
  if (benchmark.unit === "minutes" && workflowId === "sales_ops") {
    // Baseline assumed 15 min/lead; saving X min/lead → X/15 of the time.
    const base = 15;
    return {
      low: benchmark.rangeLow / base,
      expected: benchmark.rangeExpected / base,
      high: benchmark.rangeHigh / base,
    };
  }
  if (benchmark.unit === "minutes" && workflowId === "recruiting") {
    // Baseline assumed 12 min/resume; remaining min/resume after AI.
    const base = 12;
    return {
      low: 1 - benchmark.rangeHigh / base,
      expected: 1 - benchmark.rangeExpected / base,
      high: 1 - benchmark.rangeLow / base,
    };
  }
  if (benchmark.unit === "hours" && workflowId === "content_marketing") {
    // Baseline assumed 8 hours; new time after AI in hours.
    const base = 8;
    return {
      low: 1 - benchmark.rangeHigh / base,
      expected: 1 - benchmark.rangeExpected / base,
      high: 1 - benchmark.rangeLow / base,
    };
  }
  // Fallback — treat as already a fraction
  return {
    low: benchmark.rangeLow,
    expected: benchmark.rangeExpected,
    high: benchmark.rangeHigh,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round0(x: number): number {
  return Math.round(x);
}

function confidenceFor(
  benchmarksUsed: BenchmarkCard[],
  hoursPerWeek: number,
  workflowId: WorkflowId,
): "low" | "medium" | "high" {
  if (benchmarksUsed.some((b) => isStale(b))) return "low";
  if (hoursPerWeek < 2) return "low";
  // Workflows with the noisiest benchmarks
  const noisy: WorkflowId[] = ["sales_ops", "recruiting", "content_marketing"];
  if (noisy.includes(workflowId)) return "medium";
  if (hoursPerWeek >= 8) return "high";
  return "medium";
}

function warningsFor(
  workflowId: WorkflowId,
  intake: IntakeAnswers,
  benchmarksUsed: BenchmarkCard[],
): string[] {
  const out: string[] = [];
  if (benchmarksUsed.some((b) => isStale(b))) {
    out.push("One or more benchmarks for this workflow are older than 180 days and may be stale.");
  }
  if (workflowId === "customer_support" && intake.riskTolerance === "high") {
    out.push("High-risk deployments can drop CSAT. Always keep a one-click 'talk to a human' path.");
  }
  if (workflowId === "recruiting") {
    out.push("Bias and compliance risk are real for AI-assisted hiring. Keep a human reviewer and document your rubric.");
  }
  if (workflowId === "bookkeeping") {
    out.push("Wrong categorizations are worse than no categorizations. Reconcile the first 90 days by hand.");
  }
  if (workflowId === "content_marketing" && intake.riskTolerance === "high") {
    out.push("Unedited AI content typically lands at 60-80% of human quality. Plan for editorial time.");
  }
  return out;
}

export function rank(intake: IntakeAnswers): RankingResponse {
  const out: RankedOpportunity[] = [];
  for (const [workflowIdRaw, hoursRaw] of Object.entries(intake.workflowHours)) {
    const workflowId = workflowIdRaw as WorkflowId;
    const hours = Number(hoursRaw) || 0;
    if (hours <= 0) continue;

    let workflow: Workflow;
    try {
      workflow = getWorkflow(workflowId);
    } catch {
      continue;
    }

    const driverId = AUTOMATION_BENCHMARK_BY_WORKFLOW[workflowId];
    const driver = benchmarks.find((b) => b.id === driverId);
    if (!driver) continue;

    const rawRate = coerceToFraction(driver, workflowId);
    const haircut = RISK_HAIRCUT[intake.riskTolerance];

    const automationRate = {
      low: clamp01(rawRate.low * haircut),
      expected: clamp01(rawRate.expected * haircut),
      high: clamp01(rawRate.high * haircut),
    };

    const annualHours = hours * WEEKS_PER_YEAR;
    const hoursSavedAnnual = {
      low: annualHours * automationRate.low,
      expected: annualHours * automationRate.expected,
      high: annualHours * automationRate.high,
    };

    const labor = intake.fullyLoadedHourlyCost;
    const laborSavingsAnnual = {
      low: hoursSavedAnnual.low * labor,
      expected: hoursSavedAnnual.expected * labor,
      high: hoursSavedAnnual.high * labor,
    };

    const costMult = COST_RISK_MULTIPLIER[intake.riskTolerance];
    const implYear1 = {
      low: workflow.implementationCostLow * costMult + workflow.monthlyToolCostLow * 12,
      expected:
        workflow.implementationCostExpected * costMult + workflow.monthlyToolCostExpected * 12,
      high: workflow.implementationCostHigh * costMult + workflow.monthlyToolCostHigh * 12,
    };

    const netAnnualROI = {
      low: laborSavingsAnnual.low - implYear1.high,
      expected: laborSavingsAnnual.expected - implYear1.expected,
      high: laborSavingsAnnual.high - implYear1.low,
    };

    const monthlyExpectedSavings = laborSavingsAnnual.expected / 12;
    const paybackMonths =
      monthlyExpectedSavings > 0
        ? Math.min(36, implYear1.expected / monthlyExpectedSavings)
        : 36;

    const benchmarksUsed = getBenchmarksForWorkflow(workflowId);

    out.push({
      workflowId,
      workflowName: workflow.name,
      description: workflow.description,
      hoursPerWeekReported: hours,
      automationRate,
      hoursSavedAnnual: {
        low: round0(hoursSavedAnnual.low),
        expected: round0(hoursSavedAnnual.expected),
        high: round0(hoursSavedAnnual.high),
      },
      laborSavingsAnnual: {
        low: round0(laborSavingsAnnual.low),
        expected: round0(laborSavingsAnnual.expected),
        high: round0(laborSavingsAnnual.high),
      },
      toolAndImplementationCostAnnual: {
        low: round0(implYear1.low),
        expected: round0(implYear1.expected),
        high: round0(implYear1.high),
      },
      netAnnualROI: {
        low: round0(netAnnualROI.low),
        expected: round0(netAnnualROI.expected),
        high: round0(netAnnualROI.high),
      },
      paybackMonths: Number(paybackMonths.toFixed(1)),
      confidence: confidenceFor(benchmarksUsed, hours, workflowId),
      benchmarksUsed,
      warnings: warningsFor(workflowId, intake, benchmarksUsed),
    });
  }

  out.sort((a, b) => b.netAnnualROI.expected - a.netAnnualROI.expected);

  return {
    rankedOpportunities: out,
    crossCuttingWarnings: getCrossCuttingBenchmarks(),
    computedAt: new Date().toISOString(),
  };
}

export function listWorkflows(): Workflow[] {
  return workflows.filter((w) => w.id !== "_cross_cutting");
}
