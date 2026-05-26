import { benchmarks, isStale } from "@/lib/data";
import { Citation } from "@/components/Citation";
import type { BenchmarkCard } from "@/lib/types";

export const dynamic = "force-static";

const WORKFLOW_LABELS: Record<string, string> = {
  customer_support: "Customer support",
  sales_ops: "Sales operations",
  content_marketing: "Content & marketing",
  bookkeeping: "Bookkeeping & finance",
  recruiting: "Recruiting",
  inbound_qualification: "Inbound qualification",
  knowledge_ops: "Knowledge ops",
  data_entry: "Data entry & admin",
  _cross_cutting: "Cross-cutting market reality",
};

export default function BenchmarksPage() {
  const grouped = new Map<string, BenchmarkCard[]>();
  for (const b of benchmarks) {
    const arr = grouped.get(b.workflowId) ?? [];
    arr.push(b);
    grouped.set(b.workflowId, arr);
  }

  const totalCards = benchmarks.length;
  const staleCount = benchmarks.filter((b) => isStale(b)).length;

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Benchmark library</h1>
        <p className="text-text-secondary mt-2">
          {totalCards} cards across {grouped.size - 1} workflows + cross-cutting
          findings. {staleCount} flagged stale (older than 180 days).
        </p>
        <p className="text-sm text-text-muted mt-2">
          Every ROI number on this site cites one of these cards. If a benchmark
          looks wrong to you, that&apos;s the signal we&apos;re looking for — let us know.
        </p>
      </div>

      {Array.from(grouped.entries()).map(([workflowId, cards]) => (
        <section key={workflowId} className="card space-y-4">
          <h2 className="font-semibold">{WORKFLOW_LABELS[workflowId] ?? workflowId}</h2>
          <div className="space-y-3">
            {cards.map((b) => (
              <Citation key={b.id} b={b} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
