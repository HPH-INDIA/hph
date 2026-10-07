import assert from "node:assert/strict";
import test from "node:test";

import type { DailyEfficiency } from "@/api/types";
import type { CoderPerformanceMember } from "@/api/coderPerformance";

import { dailyCsv, filterDays, memberCsv, numberLabel, shiftMonth } from "./performanceView";

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

test("member export preserves selected row order, raw metrics, zero and missing values", () => {
  const members: CoderPerformanceMember[] = [
    { userId: 2, name: "Zoya", isActive: false, efficiency: {
      manualCharts: 0, kaironCharts: 12, adjustedCpd: "28.13", manualCpd: "0.00", kaironCpd: "12.345",
      targetCpd: "30.00", manualEfficiencyPercent: "0.0", kaironEfficiencyPercent: null,
    } },
    { userId: 1, name: "Alex", isActive: true, efficiency: null },
  ];
  const lines = memberCsv(members).split("\r\n");
  assert.equal(lines[0], '"Coder","Manual charts completed","Kairon charts completed","Adjusted target CPD","Manual CPD","Kairon CPD","Target CPD","Manual efficiency (%)","Kairon efficiency (%)"');
  assert.equal(lines[1], '"Zoya","0","12","28.13","0.00","12.345","30.00","0.0",""');
  assert.equal(lines[2], '"Alex","0","0","","","","","",""');
  const metrics = members[0].efficiency!;
  assert.ok(memberCsv([{ ...members[0], efficiency: { ...metrics, adjustedCpd: "0.00" } }]).includes('"Zoya","0","12","0.00"'));
  assert.equal(memberCsv(members.slice(1)).split("\r\n").length, 2);
  assert.deepEqual(members.map((member) => member.userId), [2, 1]);
});

test("QA export uses lead headers and safely escapes names for spreadsheets", () => {
  const member = (name: string): CoderPerformanceMember => ({ userId: 1, name, isActive: true, efficiency: null });
  const csv = memberCsv([member('Zoë, "QA"\nLead'), member(" =1+1"), member("+SUM(A1)"), member("@name"), member("-name")], "Lead");
  assert.ok(csv.startsWith('"Lead","Manual charts completed"'));
  assert.ok(csv.includes('"Zoë, ""QA""\nLead"'));
  for (const name of [" =1+1", "+SUM(A1)", "@name", "-name"]) assert.ok(csv.includes(`"'${name}"`));
  assert.equal(memberCsv([], "Lead").split("\r\n").length, 1);
});
