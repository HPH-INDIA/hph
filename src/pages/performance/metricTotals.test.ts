import test from "node:test";
import assert from "node:assert/strict";
import { metricTotals } from "./metricTotals";
const row = (charts:number, minutes:number, capacity:string, days:number) => ({kaironCharts:charts,manualCharts:charts,adjustedCpd:capacity,adjustedRecordedDays:days,targetMinutes:minutes,adjustedTarget:capacity,kaironCpd:"999",manualCpd:"999",targetCpd:"999",kaironEfficiencyPercent:"120",manualEfficiencyPercent:"120"});
test("totals sum raw counts and combine denominators, not individual CPDs or percentages", () => {
  const total=metricTotals([row(100,480,"50",2),row(20,2400,"150",6)]);
  assert.equal(total.kaironCharts,120); assert.equal(total.manualCharts,120);
  assert.equal(total.adjustedCpd,"200"); assert.equal(total.adjustedDailyAverage,25);
  assert.equal(Number(total.kaironCpd),20); assert.equal(Number(total.kaironEfficiencyPercent),60);
});
test("totals recompute for filtered rows and retain zero distinctly from missing", () => {
  assert.equal(metricTotals([row(20,2400,"150",6)]).kaironCharts,20);
  const zero=metricTotals([row(0,480,"0",1)]);
  assert.equal(zero.adjustedDailyAverage,0); assert.equal(zero.kaironCpd,"0"); assert.equal(zero.kaironEfficiencyPercent,null);
  assert.equal(metricTotals([null]).adjustedCpd,null);
});
test("unavailable daily hours do not invent rates or discard chart totals", () => {
  const missing={...row(5,480,"10",1),targetMinutes:null,adjustedTarget:null};
  const total=metricTotals([missing,row(10,480,"20",1)]);
  assert.equal(total.kaironCharts,15); assert.equal(total.kaironCpd,"10"); assert.equal(total.kaironEfficiencyPercent,"50");
});
