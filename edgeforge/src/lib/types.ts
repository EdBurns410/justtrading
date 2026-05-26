export type WorkflowId =
  | "customer_support"
  | "sales_ops"
  | "content_marketing"
  | "bookkeeping"
  | "recruiting"
  | "inbound_qualification"
  | "knowledge_ops"
  | "data_entry";

export type RiskTolerance = "low" | "medium" | "high";

export type RevenueBand = "under_250k" | "250k_1m" | "1m_5m" | "over_5m";

export interface Workflow {
  id: WorkflowId | "_cross_cutting";
  name: string;
  description: string;
  exampleTasks: string[];
  implementationCostLow: number;
  implementationCostExpected: number;
  implementationCostHigh: number;
  monthlyToolCostLow: number;
  monthlyToolCostExpected: number;
  monthlyToolCostHigh: number;
  pilotDays: number;
  pilotMetric: string;
}

export interface BenchmarkCard {
  id: string;
  workflowId: WorkflowId | "_cross_cutting";
  metric: string;
  unit: string;
  rangeLow: number;
  rangeExpected: number;
  rangeHigh: number;
  source: string;
  sourceUrl: string;
  lastVerified: string;
  notes?: string;
}

export interface IntakeAnswers {
  revenueBand: RevenueBand;
  teamSize: number;
  fullyLoadedHourlyCost: number;
  workflowHours: Partial<Record<WorkflowId, number>>;
  budgetMonthly: number;
  riskTolerance: RiskTolerance;
  currentTools: string;
}

export interface RankedOpportunity {
  workflowId: WorkflowId;
  workflowName: string;
  description: string;
  hoursPerWeekReported: number;
  automationRate: {
    low: number;
    expected: number;
    high: number;
  };
  hoursSavedAnnual: {
    low: number;
    expected: number;
    high: number;
  };
  laborSavingsAnnual: {
    low: number;
    expected: number;
    high: number;
  };
  toolAndImplementationCostAnnual: {
    low: number;
    expected: number;
    high: number;
  };
  netAnnualROI: {
    low: number;
    expected: number;
    high: number;
  };
  paybackMonths: number;
  confidence: "low" | "medium" | "high";
  benchmarksUsed: BenchmarkCard[];
  warnings: string[];
}

export interface RankingResponse {
  rankedOpportunities: RankedOpportunity[];
  crossCuttingWarnings: BenchmarkCard[];
  computedAt: string;
}
