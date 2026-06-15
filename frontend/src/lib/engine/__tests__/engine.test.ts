import { test } from "node:test";
import assert from "node:assert/strict";
import { runBacktest } from "../engine.ts";
import type { Bar, BacktestConfig, Genome } from "../types.ts";

const approx = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

const bar = (
  ts: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000,
): Bar => ({ ts, open, high, low, close, volume });

// A breakout genome with no fees/slippage so the arithmetic is hand-checkable.
function breakoutGenome(over: Partial<Genome> = {}): Genome {
  return {
    species: "fire",
    parents: null,
    generation: 1,
    universe: ["BTC"],
    timeframe: "4h",
    entry: { type: "breakout", params: { lookback: 2 } },
    filters: [],
    risk: { style: "aggressive", positionSizePct: 100, maxConcurrent: 1 },
    exits: {
      stopLossPct: 10,
      takeProfitPct: 20,
      trailing: false,
      timeExitBars: null,
      scaleOut: false,
    },
    mutations: [],
    ...over,
  };
}

const NO_COST: BacktestConfig = {
  initialCapital: 1000,
  costs: { feePct: 0, slippagePct: 0 },
};

test("take-profit path: signal at bar2, fill at bar3 open, TP at bar4", () => {
  const bars = [
    bar(0, 100, 100, 100, 100),
    bar(1, 100, 100, 100, 100),
    bar(2, 100, 110, 100, 110), // close 110 > prior 2-bar high (100) -> signal
    bar(3, 110, 115, 109, 112), // entry at open 110
    bar(4, 112, 135, 111, 130), // high 135 >= TP 132 -> exit at 132
  ];
  const r = runBacktest(breakoutGenome(), bars, NO_COST);

  assert.equal(r.trades.length, 1);
  const t = r.trades[0];
  assert.equal(t.reason, "takeProfit");
  // No look-ahead: signal fired on bar 2 but the fill is bar 3's open.
  assert.equal(t.entryTs, 3);
  approx(t.entryPrice, 110);
  approx(t.exitPrice, 132);
  approx(t.pnl, 200); // 1000 -> 1200 on a 100% position
  approx(r.metrics.totalReturn, 0.2);
  approx(r.equityCurve[r.equityCurve.length - 1].value, 1200);
  assert.equal(r.equityCurve.length, bars.length);
  assert.equal(r.metrics.winRate, 1);
  approx(r.metrics.maxDrawdown, 0);
});

test("stop-loss path: exit at the stop level, loss realised", () => {
  const bars = [
    bar(0, 100, 100, 100, 100),
    bar(1, 100, 100, 100, 100),
    bar(2, 100, 110, 100, 110), // signal
    bar(3, 110, 112, 109, 111), // entry at 110, stop = 99
    bar(4, 111, 112, 95, 96), // low 95 <= 99 -> stop fills at 99
  ];
  const r = runBacktest(breakoutGenome(), bars, NO_COST);
  assert.equal(r.trades.length, 1);
  const t = r.trades[0];
  assert.equal(t.reason, "stop");
  approx(t.exitPrice, 99);
  // units = 1000/110; pnl = units*(99-110)
  approx(t.pnl, (1000 / 110) * (99 - 110));
  assert.ok(r.metrics.totalReturn < 0);
});

test("fees and slippage always hurt the result", () => {
  const bars = [
    bar(0, 100, 100, 100, 100),
    bar(1, 100, 100, 100, 100),
    bar(2, 100, 110, 100, 110),
    bar(3, 110, 115, 109, 112),
    bar(4, 112, 135, 111, 130),
  ];
  const clean = runBacktest(breakoutGenome(), bars, NO_COST);
  const costly = runBacktest(breakoutGenome(), bars, {
    initialCapital: 1000,
    costs: { feePct: 0.001, slippagePct: 0.0005 },
  });
  assert.ok(
    costly.metrics.totalReturn < clean.metrics.totalReturn,
    "costs must reduce return",
  );
});

test("no entry can be opened on the final bar (no trading beyond data)", () => {
  const bars = [
    bar(0, 100, 100, 100, 100),
    bar(1, 100, 100, 100, 100),
    bar(2, 100, 110, 100, 110), // signal on last bar -> must NOT open
  ];
  const r = runBacktest(breakoutGenome(), bars, NO_COST);
  assert.equal(r.trades.length, 0);
  approx(r.metrics.totalReturn, 0);
});

test("deterministic: identical inputs produce identical output", () => {
  const bars = [
    bar(0, 100, 100, 100, 100),
    bar(1, 100, 100, 100, 100),
    bar(2, 100, 110, 100, 110),
    bar(3, 110, 115, 109, 112),
    bar(4, 112, 135, 111, 130),
  ];
  const a = runBacktest(breakoutGenome(), bars, NO_COST);
  const b = runBacktest(breakoutGenome(), bars, NO_COST);
  assert.deepEqual(a, b);
});

test("empty data is handled without throwing", () => {
  const r = runBacktest(breakoutGenome(), [], NO_COST);
  assert.equal(r.trades.length, 0);
  assert.equal(r.equityCurve.length, 0);
  assert.equal(r.metrics.trades, 0);
});
