import { test } from "node:test";
import assert from "node:assert/strict";
import {
  genomeFromSpecies,
  crossbreed,
  applyMutation,
  CORE_SPECIES,
} from "../species.ts";

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("all eight core species produce valid generation-1 genomes", () => {
  for (const id of Object.keys(CORE_SPECIES)) {
    const g = genomeFromSpecies(id);
    assert.equal(g.species, id);
    assert.equal(g.generation, 1);
    assert.equal(g.parents, null);
    assert.ok(g.exits.stopLossPct > 0);
    assert.ok(g.risk.positionSizePct > 0);
  }
});

test("crossbreed blends parents and bumps the generation", () => {
  const fire = genomeFromSpecies("fire"); // breakout, size 25
  const storm = genomeFromSpecies("storm"); // newsSpike, size 20
  const child = crossbreed(fire, storm, "inferno", ["a", "b"]);

  assert.equal(child.species, "inferno");
  assert.deepEqual(child.parents, ["a", "b"]);
  assert.equal(child.generation, 2);
  assert.equal(child.entry.type, "breakout"); // inherited from parent A
  approx(child.risk.positionSizePct, 22.5); // lerp(25, 20, 0.5)
});

test("applyMutation is immutable and bounded (protection trades size for safety)", () => {
  const fire = genomeFromSpecies("fire");
  const beforeStop = fire.exits.stopLossPct;
  const beforeSize = fire.risk.positionSizePct;

  const mutated = applyMutation(fire, "protection");

  // original untouched
  approx(fire.exits.stopLossPct, beforeStop);
  approx(fire.risk.positionSizePct, beforeSize);
  // mutated: wider stop, smaller size, perk recorded
  assert.ok(mutated.exits.stopLossPct > beforeStop);
  assert.ok(mutated.risk.positionSizePct < beforeSize);
  assert.ok(mutated.mutations.includes("protection"));
});
