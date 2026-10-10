import type {
  DailyEfficiency,
  EfficiencySummary,
  LeadPerformanceSection,
  ManagerDashboardSummary,
  ManagerPerformanceMember,
  ManagerPerformanceTeam,
  PeriodGoalSummary,
} from "@/api/types";

const numericTotal = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
const knownTotal = (values: Array<number | null | undefined>) => {
  const known = values.filter((value): value is number => value != null);
  return known.length ? numericTotal(known) : null;
};
// Saved capacities use hundredths; add integer hundredths before formatting.
const decimalTotal = (values: string[]) => (numericTotal(values.map((value) => Math.round(Number(value) * 100))) / 100).toFixed(2);
const knownDecimalTotal = (values: Array<string | null | undefined>) => {
  const known = values.filter((value): value is string => value != null);
  return known.length ? decimalTotal(known) : null;
};
const optionalNumberTotal = (values: Array<number | undefined>) => values.every((value) => value !== undefined) ? numericTotal(values as number[]) : undefined;
const optionalDecimalTotal = (values: Array<string | undefined>) => values.every((value) => value !== undefined) ? decimalTotal(values as string[]) : undefined;
const roundRate = (value: number) => (Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1);

/** Match backend lead_dashboard._rates: ratios of combined counts/capacity,
 * never an average of displayed rates or already-capped percentages. */
function rates(row: Pick<DailyEfficiency, "kaironCharts" | "manualCharts" | "adjustedTarget" | "targetMinutes">) {
  const target = row.adjustedTarget == null ? null : Number(row.adjustedTarget);
  const minutes = row.targetMinutes;
  const efficiency = (actual: number) => target != null && target > 0 ? roundRate(Math.min(120, actual * 100 / target)) : null;
  const cpd = (actual: number | null) => actual != null && minutes != null && minutes > 0 ? String(actual * 480 / minutes) : null;
  return {
    kaironEfficiencyPercent: efficiency(row.kaironCharts),
    manualEfficiencyPercent: efficiency(row.manualCharts),
    kaironCpd: cpd(row.kaironCharts),
    manualCpd: cpd(row.manualCharts),
    targetCpd: cpd(target),
  };
}

function combineDaily(sources: DailyEfficiency[][]): DailyEfficiency[] {
  const byDay = new Map<string, DailyEfficiency[]>();
  for (const rows of sources) for (const row of rows) byDay.set(row.date, [...(byDay.get(row.date) ?? []), row]);
  return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, rows]) => {
    const stages = new Set(rows.map((row) => row.stage));
    const row = {
      date,
      stage: stages.size === 1 ? rows[0].stage : "Mixed stages",
      dailyTarget: knownTotal(rows.map((item) => item.dailyTarget)),
      kaironCharts: numericTotal(rows.map((item) => item.kaironCharts)),
      manualCharts: numericTotal(rows.map((item) => item.manualCharts)),
      insideMinutes: knownTotal(rows.map((item) => item.insideMinutes)),
      downtimeMinutes: numericTotal(rows.map((item) => item.downtimeMinutes)),
      idleMinutes: numericTotal(rows.map((item) => item.idleMinutes)),
      leaveMinutes: numericTotal(rows.map((item) => item.leaveMinutes)),
      meetingMinutes: numericTotal(rows.map((item) => item.meetingMinutes)),
      excludedMinutes: numericTotal(rows.map((item) => item.excludedMinutes)),
      productiveMinutes: knownTotal(rows.map((item) => item.productiveMinutes)),
      targetMinutes: knownTotal(rows.map((item) => item.targetMinutes)),
      adjustedTarget: knownDecimalTotal(rows.map((item) => item.adjustedTarget)),
      adjustedCpd: knownDecimalTotal(rows.map((item) => item.adjustedCpd)),
      manualStatus: rows.length === 1 ? rows[0].manualStatus : null,
    };
    return { ...row, ...rates(row) };
  });
}

function combineEfficiency(sources: EfficiencySummary[], from: string, to: string): EfficiencySummary {
  const row = {
    from,
    to,
    kaironCharts: numericTotal(sources.map((item) => item.kaironCharts)),
    manualCharts: numericTotal(sources.map((item) => item.manualCharts)),
    adjustedTarget: decimalTotal(sources.map((item) => item.adjustedTarget)),
    adjustedCpd: knownDecimalTotal(sources.map((item) => item.adjustedCpd)),
    insideMinutes: numericTotal(sources.map((item) => item.insideMinutes)),
    loginDays: numericTotal(sources.map((item) => item.loginDays)),
    productiveMinutes: numericTotal(sources.map((item) => item.productiveMinutes)),
    targetMinutes: numericTotal(sources.map((item) => item.targetMinutes)),
    calculatedDays: numericTotal(sources.map((item) => item.calculatedDays)),
    daily: combineDaily(sources.map((item) => item.daily)),
  };
  return { ...row, ...rates(row) };
}

function combineGoal(goals: PeriodGoalSummary[], fallback: PeriodGoalSummary): PeriodGoalSummary {
  // Calendar metadata describes the shared reporting window, not a person.
  // The backend repeats it on every team; it must not be summed.
  const reference = goals[0] ?? fallback;
  return {
    ...reference,
    scope: "team",
    userCount: numericTotal(goals.map((goal) => goal.userCount)),
    users: goals.every((goal) => Array.isArray(goal.users)) ? goals.flatMap((goal) => goal.users ?? []) : undefined,
    completedCharts: numericTotal(goals.map((goal) => goal.completedCharts)),
    manualCharts: optionalNumberTotal(goals.map((goal) => goal.manualCharts)),
    targetCharts: numericTotal(goals.map((goal) => goal.targetCharts)),
    difference: numericTotal(goals.map((goal) => goal.difference)),
    adjustedTargetCharts: optionalDecimalTotal(goals.map((goal) => goal.adjustedTargetCharts)),
    adjustedDifference: optionalDecimalTotal(goals.map((goal) => goal.adjustedDifference)),
    eligibleDays: numericTotal(goals.map((goal) => goal.eligibleDays)),
    leaveDaysExcluded: numericTotal(goals.map((goal) => goal.leaveDaysExcluded)),
  };
}

function combineSection(sections: LeadPerformanceSection[], fallback: LeadPerformanceSection): LeadPerformanceSection {
  if (sections.length === 1) return sections[0];
  return {
    goal: combineGoal(sections.map((section) => section.goal), fallback.goal),
    efficiency: combineEfficiency(sections.map((section) => section.efficiency), fallback.efficiency.from, fallback.efficiency.to),
  };
}

function selectedMembers(data: ManagerDashboardSummary, teams: ManagerPerformanceTeam[]): ManagerPerformanceMember[] {
  const goals = teams.flatMap((team) => [team.qa.goal, team.coders.goal]);
  if (goals.every((goal) => Array.isArray(goal.users) && goal.users.length === goal.userCount)) {
    const ids = new Set(goals.flatMap((goal) => goal.users?.map((member) => member.userId) ?? []));
    return data.members.filter((member) => ids.has(member.userId));
  }
  // Compatibility with older responses without goal.users. Unassigned coders
  // may report directly to a manager, so a non-null leadId is not sufficient.
  const leads = new Set(teams.flatMap((team) => team.lead ? [team.lead.userId] : []));
  const allLeads = new Set([...data.leadOptions.map((lead) => lead.userId), ...data.teams.flatMap((team) => team.lead ? [team.lead.userId] : [])]);
  const hasUnassigned = teams.some((team) => team.lead === null);
  return data.members.filter((member) => member.roleType === "lead" ? leads.has(member.userId)
    : (member.leadId != null && leads.has(member.leadId)) || (hasUnassigned && (member.leadId == null || !allLeads.has(member.leadId))));
}

/** Exact team-key selection: [] means none. Options retain the server's scope.
 * The all-team and single-team paths keep authoritative response objects. */
export function selectManagerTeams(data: ManagerDashboardSummary, selectedKeys: readonly string[]): ManagerDashboardSummary {
  const keys = new Set(selectedKeys);
  const teams = data.teams.filter((team) => keys.has(team.key));
  if (teams.length === data.teams.length) return data;
  const qa = combineSection(teams.map((team) => team.qa), data.qa);
  const coders = combineSection(teams.map((team) => team.coders), data.coders);
  const { daily, ...overall } = combineEfficiency([qa.efficiency, coders.efficiency], data.from, data.to);
  void daily;
  return { ...data, teams, qa, coders, overall, members: selectedMembers(data, teams) };
}


/** Combine selected coders without repeating each coder's lead/QA records. */
export function selectManagerCoders(base: ManagerDashboardSummary, details: ManagerDashboardSummary[]): ManagerDashboardSummary {
  const members = [...new Map(details.flatMap(item => item.members.filter(member => member.roleType === "employee")).map(member => [member.userId, member])).values()];
  return { ...base, coders: combineSection(details.map(item => item.coders), base.coders),
    members: [...base.members.filter(member => member.roleType === "lead"), ...members] };
}
