import assert from "node:assert/strict";
import test from "node:test";
import { leadCoderDay, loadLeadCoderPerformance, managerCoderDay, managerCoderDayQuery, type CoderPerformanceMember } from "./coderPerformance";
import type { DailyEfficiency, EfficiencySummary, LeadDashboardSummary, ManagerPerformanceMember } from "./types";

const from = "2026-09-01", to = "2026-09-30";
const metrics = { manualCharts: 5, kaironCharts: 7, adjustedCpd: "15.00", manualCpd: "10.0", kaironCpd: "14.0", targetCpd: "30.0", manualEfficiencyPercent: "33.3", kaironEfficiencyPercent: "46.7" };
const member = (userId: number): CoderPerformanceMember => ({ userId, name: `Coder ${userId}`, isActive: true, efficiency: metrics });
function response(userId: number, overrides: Partial<LeadDashboardSummary> = {}) {
  return { from, to, selectedCoderId: userId, coders: { goal: { userCount: 1 }, efficiency: { ...metrics, daily: [] } }, ...overrides };
}

test("lead details preserve roster order and request each authorized coder for the exact reporting window", async () => {
  const coders = [member(3), member(1), member(2)];
  const calls: URL[] = [];
  let active = 0, peak = 0;
  const result = await loadLeadCoderPerformance({ from, to, coders: [...coders, ...coders] }, async ({ url }) => {
    const parsed = new URL(url, "https://example.test"); calls.push(parsed);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, Number(parsed.searchParams.get("coderId"))));
    active--;
    return { data: response(Number(parsed.searchParams.get("coderId"))) };
  });
  assert.ok("data" in result);
  assert.deepEqual(result.data.map((row) => row.userId), [3, 1, 2]);
  assert.ok(result.data.every((row) => row.efficiency?.adjustedCpd === "15.00"));
  assert.equal(calls.length, 3);
  assert.ok(peak <= 3);
  for (const url of calls) {
    assert.equal(url.pathname, "/dashboards/lead");
    assert.equal(url.searchParams.get("from"), from);
    assert.equal(url.searchParams.get("to"), to);
    assert.equal(url.searchParams.has("month"), false);
  }
});

test("many coders are loaded with at most three concurrent requests", async () => {
  let active = 0, peak = 0;
  const result = await loadLeadCoderPerformance({ from, to, coders: Array.from({ length: 10 }, (_, i) => member(i + 1)) }, async ({ url }) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 1)); active--;
    return { data: response(Number(new URL(url, "https://example.test").searchParams.get("coderId"))) };
  });
  assert.ok("data" in result && result.data.length === 10);
  assert.equal(peak, 3);
});

test("a failed request does not present an incomplete roster as complete", async () => {
  const error = { status: 403, message: "Not in your team", data: undefined };
  const result = await loadLeadCoderPerformance({ from, to, coders: [member(1), member(2)] }, async ({ url }) => url.endsWith("coderId=2") ? { error } : { data: response(1) });
  assert.deepEqual(result, { error });
});

test("mismatched coder identity or period is rejected; cancelled requests do not start", async () => {
  for (const data of [response(9), response(1, { from: "2026-08-01" }), { ...response(1), coders: {} }]) {
    const result = await loadLeadCoderPerformance({ from, to, coders: [member(1)] }, () => ({ data }));
    assert.ok("error" in result);
  }
  const controller = new AbortController(); controller.abort();
  const result = await loadLeadCoderPerformance({ from, to, coders: [member(1)] }, () => { throw new Error("Must not query"); }, controller.signal);
  assert.ok("error" in result);
});

test("lead daily breakdown uses that exact date, preserves true zeros, and includes coders without records", () => {
  const rows = [
    { ...member(1), daily: [{ ...metrics, date: "2026-09-02", manualCharts: 0 } as DailyEfficiency] },
    { ...member(2), daily: [{ ...metrics, date: "2026-09-01" } as DailyEfficiency] },
    { ...member(3), isActive: false, daily: [] },
  ];
  const result = leadCoderDay(rows, "2026-09-02");
  assert.equal(result.length, 3);
  assert.equal(result[0].efficiency?.manualCharts, 0);
  assert.equal(result[0].efficiency?.adjustedCpd, "15.00");
  assert.equal(result[1].efficiency, null);
  assert.equal(result[2].efficiency, null);
  assert.equal(rows[0].efficiency?.manualCharts, 5);
});

test("manager daily request replaces all period fields while preserving team, coder, cohort, and program", () => {
  assert.deepEqual(managerCoderDayQuery({ from, to, year: 2026, month: "2026-09", date: "2026-09-01", leadId: 4, coderId: 7, cohortId: 2, program: "PVP" }, "2026-09-15"), {
    date: "2026-09-15", leadId: 4, coderId: 7, cohortId: 2, program: "PVP",
  });
});

test("manager day results exclude QA and outside users, and retain zero-production and absent coders", () => {
  const day = (userId: number, roleType: "lead" | "employee", calculatedDays: number): ManagerPerformanceMember => ({
    ...member(userId), empId: `ID${userId}`, leadId: 8, roleType,
    efficiency: { ...metrics, manualCharts: 0, kaironCharts: 0, calculatedDays, loginDays: 0 } as EfficiencySummary,
  });
  const result = managerCoderDay([member(1), member(2), member(3)], [day(1, "employee", 1), day(2, "lead", 1), day(9, "employee", 1)]);
  assert.deepEqual(result.map((row) => row.userId), [1, 2, 3]);
  assert.equal(result[0].efficiency?.adjustedCpd, "15.00");
  assert.equal(result[0].efficiency?.manualCharts, 0);
  assert.equal(result[1].efficiency, null);
  assert.equal(result[2].efficiency, null);
});
