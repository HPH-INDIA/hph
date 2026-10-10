import assert from "node:assert/strict";
import test from "node:test";
import type { DailyEfficiency, EfficiencySummary, LeadPerformanceSection, ManagerDashboardSummary, ManagerPerformanceMember, ManagerPerformanceTeam } from "../../api/types";
import { selectManagerTeams, selectManagerCoders } from "./managerTeamSelection";

const from = "2026-09-01";
const to = "2026-09-30";
function day(date: string, overrides: Partial<DailyEfficiency> = {}): DailyEfficiency {
  return { date, stage: "M3", dailyTarget: 20, kaironCharts: 50, manualCharts: 100,
    insideMinutes: 480, downtimeMinutes: 10, idleMinutes: 5, leaveMinutes: 0, meetingMinutes: 5, excludedMinutes: 20,
    productiveMinutes: 460, targetMinutes: 480, adjustedTarget: "10.00", adjustedCpd: "9.75",
    kaironCpd: "50.0", manualCpd: "100.0", targetCpd: "10.0", kaironEfficiencyPercent: "120.0", manualEfficiencyPercent: "120.0", manualStatus: "approved", ...overrides };
}
function efficiency(manualCharts = 100, kaironCharts = 50, adjustedTarget = "10.00", targetMinutes = 480, daily: DailyEfficiency[] = []): EfficiencySummary {
  return { from, to, kaironCharts, manualCharts, adjustedTarget, adjustedCpd: adjustedTarget, insideMinutes: targetMinutes,
    loginDays: 1, productiveMinutes: targetMinutes, targetMinutes, calculatedDays: 1, daily,
    // Intentionally unusable display rates: the combiner must use raw totals.
    kaironEfficiencyPercent: "120.0", manualEfficiencyPercent: "120.0", kaironCpd: "999.9", manualCpd: "999.9", targetCpd: "999.9" };
}
function section(userId: number | null, summary: EfficiencySummary): LeadPerformanceSection {
  return { efficiency: summary, goal: {
    from, to, month: "2026-09", scope: "team", userCount: userId == null ? 0 : 1,
    users: userId == null ? [] : [{ userId, name: `Person ${userId}`, completedCharts: summary.kaironCharts,
      manualCharts: summary.manualCharts, targetCharts: 300, difference: 300 - summary.kaironCharts, adjustedTargetCharts: "250.25", adjustedDifference: (250.25 - summary.manualCharts).toFixed(2) }],
    completedCharts: userId == null ? 0 : summary.kaironCharts, manualCharts: userId == null ? 0 : summary.manualCharts,
    targetCharts: userId == null ? 0 : 300, adjustedTargetCharts: userId == null ? "0.00" : "250.25",
    difference: userId == null ? 0 : 300 - summary.kaironCharts, adjustedDifference: userId == null ? "0.00" : (250.25 - summary.manualCharts).toFixed(2),
    calendarWorkingDays: 21, holidayCount: 1, eligibleDays: userId == null ? 0 : 20, leaveDaysExcluded: userId == null ? 0 : 1,
  } };
}
function team(id: number | null, coderId: number, summary: EfficiencySummary): ManagerPerformanceTeam {
  return { key: id == null ? "unassigned" : `lead-${id}`, lead: id == null ? null : { userId: id, name: `Lead ${id}`, isActive: true },
    qa: section(id, efficiency(0, 0, "0.00", 0)), coders: section(coderId, summary) };
}
function fixture(): ManagerDashboardSummary {
  const first = team(100, 101, efficiency(100, 50, "10.00", 480, [day("2026-09-01"), day("2026-09-03", { targetMinutes: null, adjustedTarget: null, adjustedCpd: null, insideMinutes: null, productiveMinutes: null })]));
  const second = team(200, 201, efficiency(20, 100, "100.00", 2400, [day("2026-09-01", { manualCharts: 20, kaironCharts: 100, targetMinutes: 2400, adjustedTarget: "100.00", adjustedCpd: "99.25", dailyTarget: 100, stage: "M4" }), day("2026-09-02", { manualStatus: "pending" })]));
  const third = team(300, 301, efficiency(10, 20, "25.00", 960));
  const unassigned = team(null, 401, efficiency(7, 8, "15.00", 480));
  const teams = [first, second, third, unassigned];
  const members: ManagerPerformanceMember[] = teams.flatMap((item) => {
    const result: ManagerPerformanceMember[] = [{ userId: item.coders.goal.users![0].userId, name: "Coder", empId: null, roleType: "employee", leadId: item.lead?.userId ?? 999, isActive: true, efficiency: item.coders.efficiency }];
    if (item.lead) result.push({ ...item.lead, empId: null, roleType: "lead", leadId: item.lead.userId, efficiency: item.qa.efficiency });
    return result;
  });
  return { from, to, teams, members, leadOptions: teams.flatMap((item) => item.lead ? [item.lead] : []), coderOptions: [], cohortOptions: [],
    qa: section(null, efficiency(0, 0, "0.00", 0)), coders: section(null, efficiency()), overall: efficiency() };
}

test("multiple selected teams sum raw denominators, never average capped percentages or CPDs", () => {
  const data = fixture();
  const result = selectManagerTeams(data, ["lead-100", "lead-200"]);
  assert.equal(result.coders.efficiency.manualCharts, 120);
  assert.equal(result.coders.efficiency.kaironCharts, 150);
  assert.equal(result.coders.efficiency.targetMinutes, 2880);
  assert.equal(result.coders.efficiency.adjustedTarget, "110.00");
  assert.equal(result.coders.efficiency.manualEfficiencyPercent, "109.1");
  assert.equal(result.coders.efficiency.kaironEfficiencyPercent, "120.0");
  assert.equal(Number(result.coders.efficiency.manualCpd), 20.0);
  assert.equal(Number(result.coders.efficiency.kaironCpd), 25.0);
  assert.equal(Number(result.coders.efficiency.targetCpd), 110 / 6);
  assert.equal("daily" in result.overall, false);
  assert.equal(Number(result.overall.manualCpd), 20.0);
  assert.deepEqual(result.members.map((member) => member.userId), [101, 100, 201, 200]);
});

test("daily groups preserve dates, additive saved capacity, mixed stages and nullable inputs", () => {
  const result = selectManagerTeams(fixture(), ["lead-100", "lead-200"]);
  const [third, second, first] = result.coders.efficiency.daily;
  assert.deepEqual(result.coders.efficiency.daily.map((row) => row.date), ["2026-09-03", "2026-09-02", "2026-09-01"]);
  assert.equal(first.stage, "Mixed stages");
  assert.equal(first.manualStatus, null);
  assert.equal(first.adjustedCpd, "109.00");
  assert.equal(first.dailyTarget, 120);
  assert.equal(Number(first.manualCpd), 20.0);
  assert.equal(first.manualEfficiencyPercent, "109.1");
  assert.equal(Number(first.targetCpd), 110 / 6);
  assert.equal(second.manualStatus, "pending");
  assert.equal(third.targetMinutes, null);
  assert.equal(third.insideMinutes, null);
  assert.equal(third.productiveMinutes, null);
  assert.equal(third.adjustedTarget, null);
  assert.equal(third.adjustedCpd, null);
  assert.equal(third.manualCpd, null);
  assert.equal(third.kaironEfficiencyPercent, null);
});

test("goal per-person fields add while shared calendar metadata stays unchanged", () => {
  const goal = selectManagerTeams(fixture(), ["lead-100", "lead-200"]).coders.goal;
  assert.equal(goal.userCount, 2);
  assert.equal(goal.targetCharts, 600);
  assert.equal(goal.adjustedTargetCharts, "500.50");
  assert.equal(goal.adjustedDifference, "380.50");
  assert.equal(goal.difference, 450);
  assert.equal(goal.eligibleDays, 40);
  assert.equal(goal.leaveDaysExcluded, 2);
  assert.equal(goal.calendarWorkingDays, 21);
  assert.equal(goal.holidayCount, 1);
  assert.equal(goal.from, from);
  assert.equal(goal.to, to);
  assert.deepEqual(goal.users?.map((member) => member.userId), [101, 201]);
});

test("all and single team selection retain authoritative response identities; keys cannot duplicate totals", () => {
  const data = fixture();
  assert.equal(selectManagerTeams(data, data.teams.map((item) => item.key)), data);
  const selected = selectManagerTeams(data, ["lead-100", "lead-100", "unknown"]);
  assert.equal(selected.qa, data.teams[0].qa);
  assert.equal(selected.coders, data.teams[0].coders);
  assert.equal(selected.teams.length, 1);
  assert.equal(selected.leadOptions, data.leadOptions);
  assert.equal(selected.coderOptions, data.coderOptions);
  assert.equal(selected.cohortOptions, data.cohortOptions);
});

test("clearing all teams produces zero counts with unavailable rates and retains period metadata", () => {
  const data = fixture();
  const result = selectManagerTeams(data, []);
  assert.deepEqual(result.teams, []);
  assert.deepEqual(result.members, []);
  assert.equal(result.coders.goal.userCount, 0);
  assert.equal(result.qa.goal.userCount, 0);
  assert.equal(result.coders.goal.eligibleDays, 0);
  assert.equal(result.coders.goal.holidayCount, 1);
  assert.equal(result.coders.goal.adjustedTargetCharts, "0.00");
  assert.deepEqual(result.coders.efficiency.daily, []);
  assert.equal(result.overall.kaironCharts, 0);
  assert.equal(result.overall.targetMinutes, 0);
  assert.equal(result.overall.manualEfficiencyPercent, null);
  assert.equal(result.overall.manualCpd, null);
  assert.equal(result.overall.targetCpd, null);
  assert.equal(result.overall.adjustedCpd, null);
  assert.equal(selectManagerTeams({ ...result, teams: [] }, []).teams.length, 0);
});

test("unassigned selection includes coders reporting to the manager and excludes QA", () => {
  const data = fixture();
  const result = selectManagerTeams(data, ["unassigned"]);
  assert.equal(result.qa.goal.userCount, 0);
  assert.equal(result.coders.goal.userCount, 1);
  assert.deepEqual(result.members.map((member) => member.userId), [401]);
  // Older responses can omit the optional users list; leadId=999 is still unassigned.
  data.teams[3].coders.goal.users = undefined;
  assert.deepEqual(selectManagerTeams(data, ["unassigned"]).members.map((member) => member.userId), [401]);
});

test("missing optional goal capacities remain unavailable; known saved efficiency capacity still sums", () => {
  const data = fixture();
  data.teams[1].coders.goal.adjustedTargetCharts = undefined;
  data.teams[1].coders.goal.manualCharts = undefined;
  data.teams[1].coders.efficiency.adjustedCpd = null;
  const result = selectManagerTeams(data, ["lead-100", "lead-200"]);
  assert.equal(result.coders.goal.adjustedTargetCharts, undefined);
  assert.equal(result.coders.goal.manualCharts, undefined);
  assert.equal(result.coders.efficiency.adjustedCpd, "10.00");
});


test("multiple selected coders combine totals and daily rates without duplicating QA", () => {
  const base = fixture();
  const result = selectManagerCoders(base, [selectManagerTeams(base, ["lead-100"]), selectManagerTeams(base, ["lead-200"])]);
  assert.deepEqual(result.members.filter(member => member.roleType === "employee").map(member => member.userId), [101,201]);
  assert.equal(result.coders.goal.userCount,2);
  assert.equal(result.coders.efficiency.kaironCharts,150);
  assert.equal(result.coders.efficiency.manualCharts,120);
  assert.equal(Number(result.coders.efficiency.kaironCpd),25);
  assert.equal(result.qa,base.qa);
  assert.equal(result.coders.efficiency.daily.find(day => day.date === "2026-09-01")?.kaironCharts,150);
  const empty = selectManagerCoders(base,[]);
  assert.equal(empty.coders.goal.userCount,0);
  assert.equal(empty.coders.efficiency.kaironCharts,0);
});
