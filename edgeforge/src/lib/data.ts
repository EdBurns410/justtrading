import workflowsJson from "@/data/workflows.json";
import benchmarksJson from "@/data/benchmarks.json";
import type { BenchmarkCard, Workflow, WorkflowId } from "./types";

export const workflows: Workflow[] = workflowsJson as Workflow[];
export const benchmarks: BenchmarkCard[] = benchmarksJson as BenchmarkCard[];

export function getWorkflow(id: WorkflowId): Workflow {
  const w = workflows.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown workflow: ${id}`);
  return w;
}

export function getBenchmarksForWorkflow(id: WorkflowId): BenchmarkCard[] {
  return benchmarks.filter((b) => b.workflowId === id);
}

export function getCrossCuttingBenchmarks(): BenchmarkCard[] {
  return benchmarks.filter((b) => b.workflowId === "_cross_cutting");
}

export const STALE_DAYS = 180;

export function isStale(b: BenchmarkCard, now: Date = new Date()): boolean {
  const verified = new Date(b.lastVerified);
  const ageDays = (now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_DAYS;
}
