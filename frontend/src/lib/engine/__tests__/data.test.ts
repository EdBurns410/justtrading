import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOHLCV } from "../data/synthetic.ts";
import { getChallengeBars, CHALLENGE_DATASET } from "../data/challenge.ts";
import { computeRobustness } from "../robustness.ts";
import { genomeFromSpecies } from "../species.ts";

const SPEC = {
  seed: 7,
  startPrice: 100,
  startTs: 0,
  intervalSec: 3600,
  regimes: [{ drift: 0.001, vol: 0.02, bars: 50 }],
};

test("synthetic data is deterministic and OHLC-valid", () => {
  const a = generateOHLCV(SPEC);
  const b = generateOHLCV(SPEC);
  assert.deepEqual(a, b);
  for (const bar of a) {
    assert.ok(bar.high >= Math.max(bar.open, bar.close), "high bounds body");
    assert.ok(bar.low <= Math.min(bar.open, bar.close), "low bounds body");
    assert.ok(bar.low > 0, "price positive");
    assert.ok(bar.volume > 0, "volume positive");
  }
});

test("challenge dataset matches its declared shape and is stable", () => {
  const bars = getChallengeBars();
  assert.equal(bars.length, CHALLENGE_DATASET.bars);
  assert.deepEqual(getChallengeBars(), bars); // memoised, identical
});

test("robustness report is well-formed over the challenge dataset", () => {
  const bars = getChallengeBars();
  const report = computeRobustness(genomeFromSpecies("steel"), bars);
  assert.ok(report.score >= 0 && report.score <= 1);
  assert.ok(report.positiveRate >= 0 && report.positiveRate <= 1);
  assert.ok(["robust", "mixed", "fragile"].includes(report.verdict));
  assert.equal(report.segments.length, 4);
});
