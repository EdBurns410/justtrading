import type { RankedOpportunity, Workflow, WorkflowId } from "./types";
import { getWorkflow } from "./data";

export interface VendorCandidate {
  name: string;
  positioning: string;
  monthlyCostBand: string;
  bestFor: string;
}

export interface ActionPlan {
  workflowId: WorkflowId;
  workflowName: string;
  pilotDays: number;
  pilotMetric: string;
  goNoGoCriteria: string[];
  weekOne: string[];
  weekTwo: string[];
  estimatedPilotCost: { low: number; expected: number; high: number };
  vendorCandidates: VendorCandidate[];
  buildVsBuy: "buy" | "build" | "mix";
  risks: string[];
}

const VENDORS_BY_WORKFLOW: Record<WorkflowId, VendorCandidate[]> = {
  customer_support: [
    {
      name: "Intercom Fin",
      positioning: "Mature, well-funded, strong out-of-box resolution",
      monthlyCostBand: "$300-$1500/mo + per-resolution",
      bestFor: "Teams already on Intercom",
    },
    {
      name: "Ada",
      positioning: "Channel-agnostic, strong analytics",
      monthlyCostBand: "$500-$2000/mo",
      bestFor: "Multi-channel support (web, SMS, WhatsApp)",
    },
    {
      name: "Custom (Claude/GPT + your KB)",
      positioning: "Cheap to start, requires engineering time",
      monthlyCostBand: "$100-$400/mo in API + dev time",
      bestFor: "Teams with at least 1 engineer who can ship",
    },
  ],
  sales_ops: [
    {
      name: "Clay",
      positioning: "Best-in-class data enrichment + workflow",
      monthlyCostBand: "$150-$800/mo",
      bestFor: "Outbound-heavy SMBs",
    },
    {
      name: "Apollo",
      positioning: "All-in-one prospecting platform",
      monthlyCostBand: "$50-$500/mo",
      bestFor: "Lower-cost starting point",
    },
    {
      name: "Outreach + Smart Email Assist",
      positioning: "Sequencing-led with AI co-pilot",
      monthlyCostBand: "$100-$300/seat/mo",
      bestFor: "Existing Outreach customers",
    },
  ],
  content_marketing: [
    {
      name: "Jasper",
      positioning: "Marketing-focused, brand-voice training",
      monthlyCostBand: "$50-$500/mo",
      bestFor: "Teams that need brand consistency",
    },
    {
      name: "Claude/GPT + a thin internal workflow",
      positioning: "Most flexible, lowest cost; needs editor",
      monthlyCostBand: "$30-$200/mo in API",
      bestFor: "Founders/operators willing to set up prompts",
    },
    {
      name: "Copy.ai workflows",
      positioning: "Pre-built marketing workflows",
      monthlyCostBand: "$50-$300/mo",
      bestFor: "Teams that want templates over flexibility",
    },
  ],
  bookkeeping: [
    {
      name: "Pilot",
      positioning: "Bookkeeping-as-a-service, increasingly AI-augmented",
      monthlyCostBand: "$300-$1200/mo",
      bestFor: "SMBs that want to outsource the function",
    },
    {
      name: "QuickBooks + Vic.ai or similar",
      positioning: "Keep QBO, add AI categorization on top",
      monthlyCostBand: "$50-$400/mo",
      bestFor: "SMBs on QuickBooks already",
    },
    {
      name: "Puzzle",
      positioning: "AI-native accounting platform",
      monthlyCostBand: "$200-$800/mo",
      bestFor: "Startups starting from scratch",
    },
  ],
  recruiting: [
    {
      name: "Greenhouse + AI screening add-ons",
      positioning: "ATS with built-in AI features",
      monthlyCostBand: "$100-$600/mo",
      bestFor: "Teams already on Greenhouse",
    },
    {
      name: "Paradox (Olivia)",
      positioning: "Conversational AI for high-volume hiring",
      monthlyCostBand: "Custom, mid-market+",
      bestFor: "Hourly/high-volume roles",
    },
    {
      name: "Custom (Claude/GPT + a screening rubric)",
      positioning: "Best for unique role profiles",
      monthlyCostBand: "$50-$200/mo in API",
      bestFor: "Hiring for one specialized role",
    },
  ],
  inbound_qualification: [
    {
      name: "Drift / Qualified",
      positioning: "Conversational marketing leaders",
      monthlyCostBand: "$500-$2500/mo",
      bestFor: "B2B with sales-led motion",
    },
    {
      name: "Chili Piper",
      positioning: "Routing + scheduling, light AI qualification",
      monthlyCostBand: "$30-$60/seat/mo",
      bestFor: "Teams that mainly need fast routing",
    },
    {
      name: "Custom webhook + LLM + Calendly",
      positioning: "Cheap if you have an engineer",
      monthlyCostBand: "$50-$150/mo",
      bestFor: "Engineering-led founder",
    },
  ],
  knowledge_ops: [
    {
      name: "Glean",
      positioning: "Mature enterprise search + Q&A",
      monthlyCostBand: "$40-$100/seat/mo",
      bestFor: "20+ employees with docs in many places",
    },
    {
      name: "Notion AI",
      positioning: "Built-in if you're already on Notion",
      monthlyCostBand: "$10-$25/seat/mo extra",
      bestFor: "Notion-native teams",
    },
    {
      name: "Guru",
      positioning: "Wiki + verification workflow + AI",
      monthlyCostBand: "$15-$30/seat/mo",
      bestFor: "Teams that want explicit verification",
    },
  ],
  data_entry: [
    {
      name: "Zapier (with AI steps)",
      positioning: "Easiest to start, broad app coverage",
      monthlyCostBand: "$20-$300/mo",
      bestFor: "Non-engineers building automations",
    },
    {
      name: "Make.com",
      positioning: "More powerful than Zapier, steeper learning curve",
      monthlyCostBand: "$10-$200/mo",
      bestFor: "Teams comfortable with logic flows",
    },
    {
      name: "n8n (self-hosted)",
      positioning: "Open source, most flexible, needs ops",
      monthlyCostBand: "$0-$50/mo hosting",
      bestFor: "Engineering-led teams",
    },
  ],
};

const BUILD_VS_BUY_BY_WORKFLOW: Record<WorkflowId, "buy" | "build" | "mix"> = {
  customer_support: "buy",
  sales_ops: "buy",
  content_marketing: "mix",
  bookkeeping: "buy",
  recruiting: "mix",
  inbound_qualification: "mix",
  knowledge_ops: "buy",
  data_entry: "mix",
};

function pilotCost(workflow: Workflow): { low: number; expected: number; high: number } {
  const months = Math.ceil(workflow.pilotDays / 30);
  return {
    low: Math.round(workflow.implementationCostLow * 0.4 + workflow.monthlyToolCostLow * months),
    expected: Math.round(
      workflow.implementationCostExpected * 0.4 + workflow.monthlyToolCostExpected * months,
    ),
    high: Math.round(
      workflow.implementationCostHigh * 0.4 + workflow.monthlyToolCostHigh * months,
    ),
  };
}

function weekOneTasksFor(workflowId: WorkflowId, workflow: Workflow): string[] {
  return [
    `Pick a single, narrow slice of ${workflow.name.toLowerCase()} to pilot (one channel, one product line, one team).`,
    `Define one metric (suggested: ${workflow.pilotMetric}) and write down the current baseline number.`,
    `Set a go/no-go threshold before you start. Write it down.`,
    `Choose one vendor from the candidates below and sign up for a trial. Block 2 hours to set it up.`,
    `Tell your team what you're testing and why. Make the human escalation path obvious.`,
  ];
}

function weekTwoTasksFor(workflowId: WorkflowId, workflow: Workflow): string[] {
  return [
    `Run the workflow with AI assistance for ${workflow.pilotDays} days.`,
    `Track ${workflow.pilotMetric} daily. Log surprises and failure modes.`,
    `At the end of the pilot, compare to baseline and your go/no-go threshold.`,
    `If GO: scope a full rollout plan and a 90-day review checkpoint.`,
    `If NO-GO: write a one-pager on what you learned and shelve. Move to the #2 opportunity.`,
  ];
}

function risksFor(workflowId: WorkflowId): string[] {
  const base = [
    "Vendor lock-in: prefer tools that export your data and prompts.",
    "Quiet failures: AI can be wrong without flagging. Sample-check outputs daily for the first 2 weeks.",
  ];
  const extras: Record<WorkflowId, string[]> = {
    customer_support: [
      "A bad bot tanks CSAT faster than no bot. Have a 'talk to a human' button on every screen.",
    ],
    sales_ops: [
      "AI-personalized cold outreach at scale gets flagged as spam quickly. Cap daily send volume.",
    ],
    content_marketing: [
      "Search engines and social platforms are increasingly penalizing low-effort AI content.",
    ],
    bookkeeping: [
      "Misclassified transactions compound. Reconcile the first 3 months by hand before trusting auto-categorization.",
    ],
    recruiting: [
      "EEOC and state laws (NYC, IL, CO) restrict automated employment decisions. Document your process.",
    ],
    inbound_qualification: [
      "Over-qualifying friction can kill the conversion lift. Keep the qualifier to 3 questions max.",
    ],
    knowledge_ops: [
      "Stale docs lead to confident wrong answers. Have an owner for each doc and a refresh cadence.",
    ],
    data_entry: [
      "Edge cases break workflows silently. Always have an error queue a human reviews weekly.",
    ],
  };
  return [...base, ...extras[workflowId]];
}

export function buildActionPlan(opp: RankedOpportunity): ActionPlan {
  const workflow = getWorkflow(opp.workflowId);
  return {
    workflowId: opp.workflowId,
    workflowName: workflow.name,
    pilotDays: workflow.pilotDays,
    pilotMetric: workflow.pilotMetric,
    goNoGoCriteria: [
      `Hit at least the LOW end of the projected ROI range ($${opp.netAnnualROI.low.toLocaleString()} net annual) on a pro-rated basis during the pilot.`,
      `${workflow.pilotMetric} moves in the projected direction by at least 50% of the expected magnitude.`,
      `No more than 2 incidents that required a human to step in and fix output quality.`,
    ],
    weekOne: weekOneTasksFor(opp.workflowId, workflow),
    weekTwo: weekTwoTasksFor(opp.workflowId, workflow),
    estimatedPilotCost: pilotCost(workflow),
    vendorCandidates: VENDORS_BY_WORKFLOW[opp.workflowId],
    buildVsBuy: BUILD_VS_BUY_BY_WORKFLOW[opp.workflowId],
    risks: risksFor(opp.workflowId),
  };
}
