import type { ApiErrorShape } from "./apiError";
import type { ApiRequestArgs } from "./baseQuery";
import { buildQueryString } from "./queryString";
import type {
  AdminUser,
  ManualDailyRecord,
  ManualTeamRange,
  ManualTeamRangeEntry,
  ManualTeamRangeGroup,
  ManualTeamUser,
  PaginatedResult,
  RoleTypeCode,
} from "./types";

export interface ManualTeamRangeQuery {
  fromDate: string;
  toDate: string;
  viewerId: number;
  viewerRole: RoleTypeCode | null;
}

type QueryResult = { data: unknown; error?: undefined } | { error: ApiErrorShape; data?: undefined };
export type ManualTeamRangeQueryCallback = (args: ApiRequestArgs) => QueryResult | PromiseLike<QueryResult>;
type TeamRangeResult = { data: ManualTeamRange; error?: undefined } | { error: ApiErrorShape; data?: undefined };

const PAGE_SIZE = 100;
const UPDATE_REQUIRED = "The team report is not available for your account on this server yet. Ask an administrator to update the backend.";
const INCOMPLETE_ROSTER = "The server could not provide a complete team roster. Update the backend to show all team members.";
const INCOMPLETE_RECORDS = "Team records changed or were incomplete while loading. Try again. If this continues, update the backend.";

function reportError(message: string, status = 404): TeamRangeResult {
  return { error: { status, message, data: undefined } };
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validInterval(args: ManualTeamRangeQuery) {
  return isCalendarDate(args.fromDate) && isCalendarDate(args.toDate) && args.fromDate <= args.toDate;
}

function isProfile(value: unknown): value is AdminUser {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<AdminUser>;
  return Number.isInteger(profile.id)
    && typeof profile.first_name === "string"
    && typeof profile.last_name === "string"
    && typeof profile.emp_id === "string"
    && typeof profile.is_active === "boolean"
    && (profile.project_id === null || Number.isInteger(profile.project_id))
    && (profile.reports_to_id === null || Number.isInteger(profile.reports_to_id))
    && (profile.last_working_day === null || isCalendarDate(profile.last_working_day))
    && ["super_admin", "admin", "manager", "lead", "employee"].includes(profile.role?.roleType ?? "");
}

function canReadFullRoster(viewer: AdminUser) {
  const permissions = viewer.role.featurePermissions;
  if (permissions) {
    const permission = permissions.find((item) => item.codename === "user_management");
    return permission?.canRead === true || permission?.canWrite === true;
  }
  return viewer.role.features?.includes("user_management") === true;
}

function memberSummary(user: AdminUser): ManualTeamUser {
  return { id: user.id, firstName: user.first_name, lastName: user.last_name, empId: user.emp_id };
}

function compareNames(left: AdminUser, right: AdminUser) {
  return left.first_name.localeCompare(right.first_name)
    || left.last_name.localeCompare(right.last_name)
    || left.id - right.id;
}

/** Manager reads on older servers use a complete authorized roster and every
 * page of scoped reviews. The day loader shares this path for a one-day window. */
export async function loadManualTeamRangeCompatibility(
  args: ManualTeamRangeQuery,
  query: ManualTeamRangeQueryCallback,
): Promise<TeamRangeResult> {
  if (!validInterval(args)) return reportError("Choose valid dates with the start date on or before the end date.", 422);
  if (args.viewerRole !== "manager") return reportError(UPDATE_REQUIRED);

  const rosterResult = await query({ url: "/users" });
  if (rosterResult.error) return { error: rosterResult.error };
  if (!Array.isArray(rosterResult.data) || !rosterResult.data.every(isProfile)) {
    return reportError(INCOMPLETE_ROSTER);
  }
  const profiles = rosterResult.data;
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const viewer = profilesById.get(args.viewerId);
  // /users returns only self when roster access is missing. That response
  // must not be misreported as a manager with no team members.
  if (!viewer || viewer.role.roleType !== "manager" || !canReadFullRoster(viewer)) {
    return reportError(UPDATE_REQUIRED);
  }
  if (profilesById.size !== profiles.length) return reportError(INCOMPLETE_ROSTER);

  const records: ManualDailyRecord[] = [];
  const recordIds = new Set<number>();
  const userDates = new Set<string>();
  let total: number | undefined;
  let totalPages = 1;
  let pageSize: number | undefined;
  for (let page = 1; page <= totalPages; page += 1) {
    const result = await query({
      url: `/reports/manual/reviews${buildQueryString({ fromDate: args.fromDate, toDate: args.toDate, page, pageSize: PAGE_SIZE })}`,
    });
    if (result.error) return { error: result.error };
    const data = result.data as PaginatedResult<ManualDailyRecord> | undefined;
    if (!data || !Array.isArray(data.items)
      || data.page !== page
      || !Number.isInteger(data.pageSize) || data.pageSize < 1 || data.pageSize > PAGE_SIZE
      || !Number.isInteger(data.total) || data.total < 0
      || data.totalPages !== Math.ceil(data.total / data.pageSize)
      || data.items.length !== Math.min(data.pageSize, Math.max(0, data.total - (page - 1) * data.pageSize))
      || (total !== undefined && data.total !== total)
      || (pageSize !== undefined && data.pageSize !== pageSize)) {
      return reportError(INCOMPLETE_RECORDS);
    }
    total = data.total;
    totalPages = data.totalPages;
    pageSize = data.pageSize;
    for (const record of data.items) {
      if (!record || !Number.isInteger(record.id) || !Number.isInteger(record.userId)
        || !isCalendarDate(record.date) || record.date < args.fromDate || record.date > args.toDate) {
        return reportError(INCOMPLETE_RECORDS);
      }
      const userDate = `${record.userId}:${record.date}`;
      if (recordIds.has(record.id) || userDates.has(userDate)) return reportError(INCOMPLETE_RECORDS);
      if (!profilesById.has(record.userId)) {
        return reportError("Some submitted records are missing from the available team roster. Update the backend to show the full report.");
      }
      recordIds.add(record.id);
      userDates.add(userDate);
      records.push(record);
    }
  }
  if (records.length !== total) return reportError(INCOMPLETE_RECORDS);

  // Mirror manager_team_user_ids, including inactive reporting lines and the
  // single-active-manager rule for legacy unassigned employees in a project.
  const leads = profiles.filter((profile) => profile.role.roleType === "lead" && profile.reports_to_id === viewer.id).sort(compareNames);
  const leadIds = new Set(leads.map((lead) => lead.id));
  const isOnlyProjectManager = viewer.project_id !== null && profiles.filter((profile) =>
    profile.role.roleType === "manager" && profile.is_active && profile.project_id === viewer.project_id,
  ).length === 1;
  const coders = profiles.filter((profile) => profile.role.roleType === "employee" && (
    (profile.reports_to_id !== null && leadIds.has(profile.reports_to_id))
    || (isOnlyProjectManager && profile.reports_to_id === null && profile.project_id === viewer.project_id)
  )).sort(compareNames);
  const memberIds = new Set([...leads, ...coders].map((profile) => profile.id));
  if (records.some((record) => !memberIds.has(record.userId))) {
    return reportError("The submitted records and team roster do not match. Refresh this view, or update the backend if the problem continues.");
  }

  const recordsByUserId = new Map<number, ManualDailyRecord[]>();
  records.sort((left, right) => left.date.localeCompare(right.date) || left.id - right.id);
  for (const record of records) {
    const profile = profilesById.get(record.userId)!;
    if (profile.last_working_day !== null && record.date > profile.last_working_day) continue;
    const entries = recordsByUserId.get(record.userId) ?? [];
    entries.push(record);
    recordsByUserId.set(record.userId, entries);
  }
  const eligible = (profile: AdminUser) => profile.last_working_day !== null
    ? args.fromDate <= profile.last_working_day
    : profile.is_active || recordsByUserId.has(profile.id);
  const codersByLead = new Map<number | null, ManualTeamRangeEntry[]>();
  for (const coder of coders) {
    if (!eligible(coder)) continue;
    const entries = codersByLead.get(coder.reports_to_id) ?? [];
    entries.push({ user: memberSummary(coder), records: recordsByUserId.get(coder.id) ?? [] });
    codersByLead.set(coder.reports_to_id, entries);
  }
  const teams: ManualTeamRangeGroup[] = [];
  for (const lead of leads) {
    const teamCoders = codersByLead.get(lead.id) ?? [];
    codersByLead.delete(lead.id);
    if (eligible(lead) || teamCoders.length > 0) {
      teams.push({
        lead: memberSummary(lead),
        leadRecords: eligible(lead) ? recordsByUserId.get(lead.id) ?? [] : [],
        coders: teamCoders,
      });
    }
  }
  const unassigned = [...codersByLead.values()].flat();
  if (unassigned.length > 0) teams.push({ lead: null, leadRecords: [], coders: unassigned });
  return { data: { fromDate: args.fromDate, toDate: args.toDate, teams } };
}

/** Older servers expose a lead's own project roster and scoped manual records,
 * even before they expose the grouped team-range endpoint. Keep the grouping
 * limited to the authenticated lead and their direct coders. */
async function loadLeadManualTeamRangeCompatibility(
  args: ManualTeamRangeQuery,
  query: ManualTeamRangeQueryCallback,
): Promise<TeamRangeResult> {
  const selfResult = await query({ url: "/users" });
  if (selfResult.error) return { error: selfResult.error };
  if (!Array.isArray(selfResult.data) || !selfResult.data.every(isProfile)) return reportError(INCOMPLETE_ROSTER);
  const lead = selfResult.data.find((profile: AdminUser) => profile.id === args.viewerId);
  if (!lead || lead.role.roleType !== "lead" || lead.project_id === null) return reportError(UPDATE_REQUIRED);

  const rosterResult = await query({ url: `/users/filter${buildQueryString({ projectIds: [lead.project_id] })}` });
  if (rosterResult.error) return { error: rosterResult.error };
  if (!Array.isArray(rosterResult.data) || !rosterResult.data.every(isProfile)) return reportError(INCOMPLETE_ROSTER);
  const profiles: AdminUser[] = rosterResult.data;
  if (new Set(profiles.map((profile) => profile.id)).size !== profiles.length
    || !profiles.some((profile) => profile.id === lead.id && profile.role.roleType === "lead" && profile.project_id === lead.project_id)) return reportError(INCOMPLETE_ROSTER);
  const coders = profiles.filter((profile) => profile.role.roleType === "employee"
    && profile.reports_to_id === lead.id && profile.project_id === lead.project_id).sort(compareNames);
  const memberIds = new Set([lead.id, ...coders.map((coder) => coder.id)]);

  const recordsResult = await query({ url: `/manual-daily-records${buildQueryString({ fromDate: args.fromDate, toDate: args.toDate })}` });
  if (recordsResult.error) return { error: recordsResult.error };
  if (!Array.isArray(recordsResult.data)) return reportError(INCOMPLETE_RECORDS);
  const recordIds = new Set<number>();
  const userDates = new Set<string>();
  const recordsByUserId = new Map<number, ManualDailyRecord[]>();
  for (const record of recordsResult.data as ManualDailyRecord[]) {
    if (!record || !Number.isInteger(record.id) || !Number.isInteger(record.userId)
      || !isCalendarDate(record.date) || record.date < args.fromDate || record.date > args.toDate
      || !memberIds.has(record.userId)) return reportError(INCOMPLETE_RECORDS);
    const userDate = `${record.userId}:${record.date}`;
    if (recordIds.has(record.id) || userDates.has(userDate)) return reportError(INCOMPLETE_RECORDS);
    recordIds.add(record.id);
    userDates.add(userDate);
    const profile = record.userId === lead.id ? lead : coders.find((coder) => coder.id === record.userId)!;
    if (profile.last_working_day !== null && record.date > profile.last_working_day) continue;
    const entries = recordsByUserId.get(record.userId) ?? [];
    entries.push(record);
    recordsByUserId.set(record.userId, entries);
  }
  for (const entries of recordsByUserId.values()) entries.sort((left, right) => left.date.localeCompare(right.date) || left.id - right.id);
  const eligible = (profile: AdminUser) => profile.last_working_day !== null
    ? args.fromDate <= profile.last_working_day
    : profile.is_active || recordsByUserId.has(profile.id);
  return {
    data: {
      fromDate: args.fromDate,
      toDate: args.toDate,
      teams: [{
        lead: memberSummary(lead),
        leadRecords: recordsByUserId.get(lead.id) ?? [],
        coders: coders.filter(eligible).map((coder) => ({ user: memberSummary(coder), records: recordsByUserId.get(coder.id) ?? [] })),
      }],
    },
  };
}

/** Keep the native server authoritative. Compatibility is used only when its
 * report endpoint is absent; write actions still use the existing review API. */
export async function loadManualTeamRange(
  args: ManualTeamRangeQuery,
  query: ManualTeamRangeQueryCallback,
): Promise<TeamRangeResult> {
  if (!validInterval(args)) return reportError("Choose valid dates with the start date on or before the end date.", 422);
  const native = await query({
    url: `/reports/manual/team-range${buildQueryString({ fromDate: args.fromDate, toDate: args.toDate })}`,
  });
  if (!native.error) return { data: native.data as ManualTeamRange };
  if (native.error.status !== 404) return { error: native.error };
  if (args.viewerRole === "manager") return loadManualTeamRangeCompatibility(args, query);
  if (args.viewerRole === "lead") return loadLeadManualTeamRangeCompatibility(args, query);
  return { error: { ...native.error, message: UPDATE_REQUIRED } };
}
