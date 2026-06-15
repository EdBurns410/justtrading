import { test } from "node:test";
import assert from "node:assert/strict";
import { maxDrawdown, computeMetrics } from "../metrics.ts";
import type { EquityPoint, Trade } from "../types.ts";

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

const pt = (ts: number, value: number): EquityPoint => ({ ts, value });

test("maxDrawdown: worst peak-to-trough decline", () => {
  approx(maxDrawdown([pt(0, 100), pt(1, 120), pt(2, 90), pt(3, 150)]), -0.25);
  approx(maxDrawdown([pt(0, 100), pt(1, 110), pt(2, 120)]), 0);
});

function trade(pnl: number): Trade {
  return {
    side: "long",
    entryTs: 0,
    exitTs: 1,
    entryPrice: 1,
    exitPrice: 1,
    units: 1,
    fees: 0,
    pnl,
    reason: "stop",
    barsHeld: 1,
  };
}

test("profitFactor and winRate from the trade log", () => {
  const curve = [pt(0, 1000), pt(86400, 1050)];
  const m = computeMetrics(curve, [trade(100), trade(-50)], 1000, "1d");
  approx(m.profitFactor, 2); // 100 / 50
  approx(m.winRate, 0.5);
  approx(m.totalReturn, 0.05);
});

test("profitFactor caps at a finite value when there are no losing trades", () => {
  const curve = [pt(0, 1000), pt(86400, 1200)];
  const m = computeMetrics(curve, [trade(200)], 1000, "1d");
  assert.ok(Number.isFinite(m.profitFactor));
  assert.ok(m.profitFactor >= 999);
});
