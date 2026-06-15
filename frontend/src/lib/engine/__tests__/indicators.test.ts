import { test } from "node:test";
import assert from "node:assert/strict";
import { sma, ema, rsi, priorHigh, priorLow, atr } from "../indicators.ts";
import type { Bar } from "../types.ts";

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("sma: nulls until enough data, then trailing average", () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("ema: seeded with sma, then smoothed", () => {
  const out = ema([1, 2, 3, 4], 2);
  assert.equal(out[0], null);
  approx(out[1] as number, 1.5);
  approx(out[2] as number, 2.5);
  approx(out[3] as number, 3.5);
});

test("rsi: monotonic up = 100, flat = 50", () => {
  const up = rsi([1, 2, 3, 4], 2);
  assert.equal(up[0], null);
  assert.equal(up[1], null);
  approx(up[2] as number, 100);
  approx(up[3] as number, 100);

  const flat = rsi([5, 5, 5, 5], 2);
  approx(flat[2] as number, 50);
});

test("priorHigh / priorLow: window strictly before i (no self-compare)", () => {
  assert.deepEqual(priorHigh([10, 12, 11, 9, 15], 2), [null, null, 12, 12, 11]);
  assert.deepEqual(priorLow([10, 12, 11, 9, 15], 2), [null, null, 10, 11, 9]);
});

test("atr: constant 2-wide bars give ATR of 2", () => {
  const bars: Bar[] = [10, 10, 10, 10].map((c, i) => ({
    ts: i,
    open: c,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1,
  }));
  const a = atr(bars, 2);
  approx(a[2] as number, 2);
  approx(a[3] as number, 2);
});
