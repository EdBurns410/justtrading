import type { BenchmarkCard } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { isStale } from "@/lib/data";

export function Citation({ b }: { b: BenchmarkCard }) {
  const stale = isStale(b);
  return (
    <div className="text-xs text-text-secondary border-l-2 border-bg-border pl-3 py-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text-primary">{b.metric}</span>
        <span className="text-text-muted">
          {formatRange(b)} {b.unit}
        </span>
        {stale ? (
          <span className="tag tag-red">stale</span>
        ) : (
          <span className="tag tag-green">verified {formatDate(b.lastVerified)}</span>
        )}
      </div>
      <div className="text-text-muted">
        Source:{" "}
        {b.sourceUrl ? (
          <a
            href={b.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-text-secondary"
          >
            {b.source}
          </a>
        ) : (
          b.source
        )}
      </div>
      {b.notes && <div className="text-text-muted italic">{b.notes}</div>}
    </div>
  );
}

function formatRange(b: BenchmarkCard): string {
  const fmt = (n: number) => {
    if (b.unit === "%") return `${(n * 100).toFixed(0)}%`;
    if (b.unit === "% of baseline") return `${(n * 100).toFixed(0)}%`;
    return n.toString();
  };
  return `${fmt(b.rangeLow)} → ${fmt(b.rangeExpected)} → ${fmt(b.rangeHigh)}`;
}
