import Link from "next/link";
import type { RankedOpportunity } from "@/lib/types";
import { formatCurrency, formatHours, formatPercent } from "@/lib/format";
import { Citation } from "./Citation";

export function OpportunityCard({
  opp,
  rank,
  isTop,
}: {
  opp: RankedOpportunity;
  rank: number;
  isTop: boolean;
}) {
  const confidenceTag =
    opp.confidence === "high"
      ? "tag tag-green"
      : opp.confidence === "medium"
        ? "tag tag-yellow"
        : "tag tag-red";

  return (
    <div className="card space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>#{rank + 1}</span>
            {isTop && <span className="tag tag-blue">Top pick</span>}
            <span className={confidenceTag}>{opp.confidence} confidence</span>
          </div>
          <h3 className="text-xl font-semibold mt-1">{opp.workflowName}</h3>
          <p className="text-sm text-text-secondary mt-1">{opp.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-text-muted uppercase tracking-wide">Expected net</div>
          <div className="text-2xl font-semibold text-accent-green">
            {formatCurrency(opp.netAnnualROI.expected)}
          </div>
          <div className="text-xs text-text-muted">/year</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Stat label="Hours saved/yr" value={formatHours(opp.hoursSavedAnnual.expected)} />
        <Stat label="Labor savings/yr" value={formatCurrency(opp.laborSavingsAnnual.expected)} />
        <Stat label="Year-1 cost" value={formatCurrency(opp.toolAndImplementationCostAnnual.expected)} />
        <Stat label="Payback" value={`${opp.paybackMonths} mo`} />
      </div>

      <RangeBar opp={opp} />

      {opp.warnings.length > 0 && (
        <div className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 p-3 text-sm space-y-1">
          <div className="text-accent-yellow font-medium text-xs uppercase tracking-wide">
            What could go wrong
          </div>
          <ul className="list-disc list-inside text-text-secondary">
            {opp.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
          Benchmarks used ({opp.benchmarksUsed.length})
        </summary>
        <div className="mt-3 space-y-2">
          {opp.benchmarksUsed.map((b) => (
            <Citation key={b.id} b={b} />
          ))}
        </div>
      </details>

      {isTop && (
        <div>
          <Link href={`/action-plan/${opp.workflowId}`} className="btn-primary inline-block">
            Open action plan
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function RangeBar({ opp }: { opp: RankedOpportunity }) {
  const min = Math.min(opp.netAnnualROI.low, 0);
  const max = Math.max(opp.netAnnualROI.high, 0);
  const span = max - min || 1;
  const leftPct = ((opp.netAnnualROI.low - min) / span) * 100;
  const rightPct = ((opp.netAnnualROI.high - min) / span) * 100;
  const expectedPct = ((opp.netAnnualROI.expected - min) / span) * 100;
  const zeroPct = ((0 - min) / span) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
        <span>{formatCurrency(opp.netAnnualROI.low)}</span>
        <span className="text-text-muted">net annual ROI range</span>
        <span>{formatCurrency(opp.netAnnualROI.high)}</span>
      </div>
      <div className="relative h-6 bg-bg-primary rounded-md overflow-hidden border border-bg-border">
        <div
          className="absolute h-full bg-accent-blue/30"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-text-primary"
          style={{ left: `${expectedPct}%` }}
        />
        {zeroPct > 0 && zeroPct < 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-accent-red/60"
            style={{ left: `${zeroPct}%` }}
            title="$0 net"
          />
        )}
      </div>
    </div>
  );
}
