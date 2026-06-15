"use client";

import { useMemo } from "react";
import type { EquityPoint } from "@/lib/engine";

interface Props {
  curve: EquityPoint[];
  initialCapital: number;
  height?: number;
}

/**
 * Lightweight inline-SVG equity curve. No charting dependency — keeps the
 * client preview instant and the bundle small. A dashed baseline marks the
 * starting capital so wins/losses read at a glance.
 */
export function EquityChart({ curve, initialCapital, height = 220 }: Props) {
  const { path, baselineY, min, max, last } = useMemo(() => {
    if (curve.length < 2) {
      return { path: "", baselineY: 0, min: 0, max: 0, last: initialCapital };
    }
    const values = curve.map((p) => p.value);
    const lo = Math.min(...values, initialCapital);
    const hi = Math.max(...values, initialCapital);
    const span = hi - lo || 1;
    const W = 1000;
    const H = height;
    const x = (i: number) => (i / (curve.length - 1)) * W;
    const y = (v: number) => H - ((v - lo) / span) * H;

    const d = curve
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join(" ");

    return {
      path: d,
      baselineY: y(initialCapital),
      min: lo,
      max: hi,
      last: values[values.length - 1],
    };
  }, [curve, initialCapital, height]);

  const up = last >= initialCapital;
  const stroke = up ? "#10b981" : "#ef4444";

  if (!path) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-text-muted">
        Not enough data to chart.
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 1000 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2="1000"
          y1={baselineY}
          y2={baselineY}
          stroke="#6b7280"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path d={`${path} L1000,${height} L0,${height} Z`} fill="url(#equityFill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-text-muted">
        <span>min ${min.toFixed(0)}</span>
        <span>start ${initialCapital.toFixed(0)}</span>
        <span>max ${max.toFixed(0)}</span>
      </div>
    </div>
  );
}
