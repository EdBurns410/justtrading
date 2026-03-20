import { clsx } from "clsx";

const stageStyles: Record<string, string> = {
  research: "badge-gray",
  backtest: "badge-purple",
  paper_live: "badge-blue",
  shadow: "badge-yellow",
  micro_live: "badge-yellow",
  promotion_gate: "badge-yellow",
  live: "badge-green",
  paused: "badge-red",
  retired: "badge-gray",
};

const stageLabels: Record<string, string> = {
  research: "Research",
  backtest: "Backtest",
  paper_live: "Paper Live",
  shadow: "Shadow",
  micro_live: "Micro Live",
  promotion_gate: "Gate",
  live: "LIVE",
  paused: "Paused",
  retired: "Retired",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={clsx(stageStyles[stage] || "badge-gray")}>
      {stageLabels[stage] || stage}
    </span>
  );
}
