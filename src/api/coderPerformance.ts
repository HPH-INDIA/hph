import type { ApiErrorShape } from "./apiError";
import type { ApiRequestArgs } from "./baseQuery";
import { buildQueryString } from "./queryString";
import type { DailyEfficiency, EfficiencySummary, LeadDashboardSummary, ManagerDashboardQuery, ManagerPerformanceMember } from "./types";

export type CoderMetrics = Pick<EfficiencySummary, "manualCharts" | "kaironCharts" | "adjustedCpd" | "manualCpd" | "kaironCpd" | "targetCpd" | "manualEfficiencyPercent" | "kaironEfficiencyPercent">;
export interface CoderPerformanceMember {
  userId: number;
  name: string;
  isActive: boolean;
  empId?: string | null;
  efficiency: CoderMetrics | null;
  daily?: DailyEfficiency[];
}
export interface LeadCoderPerformanceQuery {
  from: string;
  to: string;
  coders: LeadDashboardSummary["coderOptions"];
}
type QueryResult = { data: unknown; error?: undefined } | { error: ApiErrorShape; data?: undefined };
type Query = (args: ApiRequestArgs) => QueryResult | PromiseLike<QueryResult>;

/** Existing lead endpoints enforce direct-report access. Load each coder once
 * per reporting window, with bounded concurrency; daily expansion reuses it. */
export async function loadLeadCoderPerformance(args: LeadCoderPerformanceQuery, query: Query, signal?: AbortSignal): Promise<{ data: CoderPerformanceMember[] } | { error: ApiErrorShape }> {
  const members: CoderPerformanceMember[] = [];
  let failure: ApiErrorShape | undefined;
  let next = 0;
  const coders = [...new Map(args.coders.map((coder) => [coder.userId, coder])).values()];
  const worker = async () => {
    while (!failure && !signal?.aborted && next < coders.length) {
      const index = next++;
      const coder = coders[index];
      const result = await query({ url: `/dashboards/lead${buildQueryString({ from: args.from, to: args.to, coderId: coder.userId })}` });
      if (result.error) { failure = result.error; return; }
      const data = result.data as LeadDashboardSummary | undefined;
      if (!data || data.selectedCoderId !== coder.userId || data.from !== args.from || data.to !== args.to
        || data.coders?.goal?.userCount !== 1 || !Array.isArray(data.coders?.efficiency?.daily)) {
        failure = { status: 502, message: "Coder details were incomplete. Please try again.", data: undefined };
        return;
      }
      members[index] = { ...coder, efficiency: data.coders.efficiency, daily: data.coders.efficiency.daily };
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, coders.length) }, worker));
  if (signal?.aborted) return { error: { status: 0, message: "Request cancelled.", data: undefined } };
  return failure ? { error: failure } : { data: members };
}

export function leadCoderDay(members: CoderPerformanceMember[], date: string): CoderPerformanceMember[] {
  return members.map((member) => ({ ...member, efficiency: member.daily?.find((day) => day.date === date) ?? null }));
}

/** Keep only scope filters when drilling into one day; never carry a month,
 * range, or year that could override the selected date on the server. */
export function managerCoderDayQuery(scope: ManagerDashboardQuery, date: string): ManagerDashboardQuery {
  return { date, leadId: scope.leadId, coderId: scope.coderId, cohortId: scope.cohortId, program: scope.program };
}

export function managerCoderDay(members: CoderPerformanceMember[], dailyMembers: ManagerPerformanceMember[]): CoderPerformanceMember[] {
  const byId = new Map(dailyMembers.filter((member) => member.roleType === "employee").map((member) => [member.userId, member]));
  return members.map((member) => {
    const day = byId.get(member.userId)?.efficiency;
    return { ...member, efficiency: day && (day.calculatedDays > 0 || day.loginDays > 0 || day.manualCharts > 0 || day.kaironCharts > 0) ? day : null };
  });
}
