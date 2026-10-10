import test from "node:test";
import assert from "node:assert/strict";
import { adjustedTargetCpd, averageAdjustedTargets } from "./adjustedTargetMetrics";
import type { CoderMetrics } from "@/api/coderPerformance";

test("period total is not presented as per-day capacity without supporting daily records", () => {
  assert.equal(adjustedTargetCpd({ adjustedCpd: "140.62" } as CoderMetrics), null);
});
test("per-day average includes recorded zero days but excludes missing snapshots", () => {
  const records = [{adjustedCpd:"29.06"},{adjustedCpd:"29.06"},{adjustedCpd:"29.06"},{adjustedCpd:"29.06"},{adjustedCpd:"24.38"}];
  assert.equal(averageAdjustedTargets(records), 140.62 / 5);
  assert.equal(averageAdjustedTargets([{adjustedCpd:"30"},{adjustedCpd:"0"},{adjustedCpd:null},{}]),15);
  assert.equal(averageAdjustedTargets([{adjustedCpd:null}]), null);
});
test("authoritative per-person average is independent of period total", () => {
  assert.equal(adjustedTargetCpd({adjustedCpd:"140.62",adjustedDailyAverage:28.124} as CoderMetrics),28.124);
});
