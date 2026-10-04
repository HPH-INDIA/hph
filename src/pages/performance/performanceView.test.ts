import assert from "node:assert/strict";
import test from "node:test";

import type { DailyEfficiency } from "@/api/types";

import { dailyCsv, filterDays, numberLabel, shiftMonth } from "./performanceView";

function day(date: string, efficiency: string | null, overrides: Partial<DailyEfficiency> = {}): DailyEfficiency {
  return {
    date, stage: "Steady State", dailyTarget: 30, manualCharts: 0, kaironCharts: 0,
    insideMinutes: null, downtimeMinutes: 0, idleMinutes: 0, leaveMinutes: 0,
    meetingMinutes: 0, excludedMinutes: 0, productiveMinutes: null, targetMinutes: null,
    adjustedTarget: "29.10", adjustedCpd: "30.00", manualEfficiencyPercent: efficiency,
    kaironEfficiencyPercent: "120.0", manualCpd: null, kaironCpd: null, targetCpd: null,
    manualStatus: null, ...overrides,
  };
}

test("filters use manual efficiency, include zero, and keep unavailable separate", () => {
  const rows = [day("2026-09-01", "0"), day("2026-09-02", "99.9"), day("2026-09-03", "100"), day("2026-09-04", null)];
  assert.deepEqual(filterDays(rows, "below", "", false).map((row) => row.date), ["2026-09-02", "2026-09-01"]);
  assert.deepEqual(filterDays(rows, "achieved", "", false).map((row) => row.date), ["2026-09-03"]);
  assert.deepEqual(filterDays(rows, "unavailable", "", false).map((row) => row.date), ["2026-09-04"]);
});

test("date and stage search combines with filters; sorting leaves source records untouched", () => {
  const rows = [day("2026-09-02", "90"), day("2026-09-01", "110", { stage: "Nesting" })];
  assert.equal(filterDays(rows, "all", "01 Sep", false)[0].stage, "Nesting");
  assert.equal(filterDays(rows, "all", " NESTING ", false).length, 1);
  assert.equal(filterDays(rows, "below", "nesting", false).length, 0);
  assert.equal(filterDays(rows, "all", "2026-09-02", true).length, 1);
  assert.equal(filterDays(rows, "all", "", true)[0].date, "2026-09-01");
  assert.equal(rows[0].date, "2026-09-02");
});

test("export uses the saved adjusted CPD, keeps zero distinct from missing, and escapes CSV cells", () => {
  const csv = dailyCsv([day("2026-09-01", null, { stage: 'Nesting, "Week 1"', adjustedCpd: "0.00" })]);
  assert.equal(csv.split("\r\n")[1], '"2026-09-01","Nesting, ""Week 1""","0","0","0.00","","","","","120.0"');
  assert.ok(!csv.includes("29.10"));
  assert.ok(dailyCsv([day("2026-09-01", "100", { stage: "=1+1" })]).includes('"\'=1+1"'));
  assert.equal(numberLabel(0, 2), "0.00");
  assert.equal(numberLabel(null, 2), "—");
});

test("month navigation crosses year boundaries without day rollover", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2025-12", 1), "2026-01");
});
