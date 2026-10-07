import assert from "node:assert/strict";
import test from "node:test";
import { chartsToGoal } from "./goalMetrics";

test("uses Kairon completions minus the adjusted goal, preserving a shortfall", () => {
  assert.equal(chartsToGoal(19, "591.56"), -572.56);
  assert.equal(chartsToGoal(309, "5210.42"), -4901.42);
});

test("distinguishes achieved, exceeded, and zero-capacity goals without floating point residue", () => {
  assert.equal(chartsToGoal(30, "30.00"), 0);
  assert.equal(chartsToGoal(31, "29.99"), 1.01);
  assert.equal(chartsToGoal(0, "0.00"), 0);
  assert.equal(chartsToGoal(5, "0.00"), 5);
  assert.equal(chartsToGoal(0, "0.01"), -0.01);
});

test("keeps missing or invalid goal data unavailable instead of fabricating zero", () => {
  for (const target of [undefined, null, "", " ", "invalid", "Infinity"]) {
    assert.equal(chartsToGoal(309, target), null);
  }
  for (const completed of [undefined, null, NaN, Infinity]) {
    assert.equal(chartsToGoal(completed, "5210.42"), null);
  }
});
