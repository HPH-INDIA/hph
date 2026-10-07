import assert from "node:assert/strict";
import { test } from "node:test";
import type { DailyEfficiency } from "../../api/types";
import { buildReportChartRows, chartGeometry } from "./reportChartData";

function day(date: string, overrides: Partial<DailyEfficiency> = {}): DailyEfficiency {
  return { date, stage: "M3", dailyTarget: 20, manualCharts: 12, kaironCharts: 9,
    insideMinutes: 480, downtimeMinutes: 60, idleMinutes: 0, leaveMinutes: 0,
    meetingMinutes: 0, excludedMinutes: 60, productiveMinutes: 420, targetMinutes: 420,
    adjustedTarget: "17.5", adjustedCpd: "17.5", manualEfficiencyPercent: null,
    kaironEfficiencyPercent: null, manualCpd: "13.7", kaironCpd: "10.3", targetCpd: "20",
    manualStatus: "approved", ...overrides };
}

test("one shared domain retains missing weekdays and real weekend records, sorted and bounded", () => {
  const rows = buildReportChartRows([[day("2026-10-05"), day("2026-09-12"), day("2026-09-10"), day("2026-10-06")]], "2026-09-10", "2026-10-05", "day");
  assert.equal(rows[0].date, "2026-09-10");
  assert.equal(rows.at(-1)?.date, "2026-10-05");
  assert.equal(rows.find((row) => row.date === "2026-09-11")?.manual, null);
  assert.equal(rows.find((row) => row.date === "2026-09-12")?.manual, 12);
  assert.equal(rows.some((row) => row.date === "2026-09-13"), false);
  assert.equal(rows[0].manualCpd, 12 * 480 / 420);
});
test("saved adjusted CPD and production adjusted target remain distinct, including zero", () => {
  const rows = buildReportChartRows([[day("2026-09-10", { adjustedCpd: "20", adjustedTarget: "17.5" }), day("2026-09-11", { adjustedCpd: "0", targetMinutes: 0 })]], "2026-09-10", "2026-09-11", "day");
  assert.equal(rows[0].adjustedCpd, 20);
  assert.equal(rows[0].adjusted, 17.5);
  assert.equal(rows[1].adjustedCpd, 0);
  assert.equal(rows[1].manualCpd, null);
});
test("team CPD uses capacity-weighted actuals and per-coder target averages", () => {
  const rows = buildReportChartRows([[day("2026-09-10")], [day("2026-09-10", { targetMinutes: 240, dailyTarget: 30, adjustedCpd: "15", manualCharts: 20 })]], "2026-09-10", "2026-09-10", "day");
  assert.equal(rows[0].target, 50);
  assert.equal(rows[0].targetCpd, 25);
  assert.equal(rows[0].adjustedCpd, 16.25);
  assert.equal(rows[0].manualCpd, 32 * 480 / 660);
  assert.equal(rows[0].idle, 0);
  assert.equal(rows[0].downtime, 2);
});
test("weeks and months aggregate counts and hours but do not sum CPD rates", () => {
  const source = [[day("2026-09-10"), day("2026-09-11", { targetMinutes: 240, manualCharts: 20 })]];
  for (const interval of ["week", "month"] as const) {
    const [row] = buildReportChartRows(source, "2026-09-10", "2026-09-11", interval);
    assert.equal(row.manual, 32);
    assert.equal(row.targetCpd, 20);
    assert.equal(row.downtime, 2);
    assert.equal(row.manualCpd, 32 * 480 / 660);
  }
});
test("missing target and capacity stay unavailable, empty dates never invent CPD", () => {
  const [row] = buildReportChartRows([[day("2026-09-10", { dailyTarget: null, adjustedCpd: null, adjustedTarget: null, targetMinutes: null })]], "2026-09-10", "2026-09-10", "day");
  assert.equal(row.targetCpd, null);
  assert.equal(row.adjustedCpd, null);
  assert.equal(row.manualCpd, null);
  assert.equal(buildReportChartRows([], "2026-09-12", "2026-09-13", "day").length, 0);
});
test("wide and narrow charts expose identical date slots at every scroll offset", () => {
  for (const widths of [[1240, 612, 612], [390, 390, 390], [1111, 417, 683]]) {
    const geometry = chartGeometry(widths, 80);
    for (const start of [0, 0.001, 1 / 58, 12.345, geometry.maxStart]) {
      geometry.charts.forEach((chart, i) => {
        assert.ok(Math.abs((chart.width - widths[i]) / chart.step - geometry.maxStart) < 1e-9);
        assert.ok(Math.abs(start * chart.step / chart.step - start) < 1e-9);
        const first = geometry.charts[0];
        assert.ok(Math.abs((chart.left + chart.step / 2) / widths[i] - (first.left + first.step / 2) / widths[0]) < 1e-9);
      });
    }
  }
  assert.equal(chartGeometry([400, 400, 400], 1).maxStart, 0);
});
