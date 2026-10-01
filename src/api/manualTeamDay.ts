import type { ApiErrorShape } from "./apiError";
import { loadManualTeamRangeCompatibility, type ManualTeamRangeQueryCallback } from "./manualTeamRange";
import { buildQueryString } from "./queryString";
import type { ManualTeamDay, RoleTypeCode } from "./types";

export interface ManualTeamDayQuery {
  date: string;
  viewerId: number;
  viewerRole: RoleTypeCode | null;
}

export type ManualTeamDayQueryCallback = ManualTeamRangeQueryCallback;
type TeamDayResult = { data: ManualTeamDay; error?: undefined } | { error: ApiErrorShape; data?: undefined };

const UPDATE_REQUIRED = "The daily team view is not available for your account on this server yet. Ask an administrator to update the backend.";

/** Prefer the native day endpoint. The manager-only compatibility path shares
 * the range loader, while lead reviews always require the native backend. */
export async function loadManualTeamDay(
  args: ManualTeamDayQuery,
  query: ManualTeamDayQueryCallback,
): Promise<TeamDayResult> {
  const native = await query({ url: `/reports/manual/team-day${buildQueryString({ date: args.date })}` });
  if (!native.error) return { data: native.data as ManualTeamDay };
  if (native.error.status !== 404) return { error: native.error };
  if (args.viewerRole !== "manager") {
    return { error: { ...native.error, message: UPDATE_REQUIRED } };
  }
  const result = await loadManualTeamRangeCompatibility({
    fromDate: args.date,
    toDate: args.date,
    viewerId: args.viewerId,
    viewerRole: args.viewerRole,
  }, query);
  if (result.error) return { error: result.error };
  return {
    data: {
      date: args.date,
      teams: result.data.teams.map((team) => ({
        lead: team.lead,
        leadRecord: team.leadRecords[0] ?? null,
        coders: team.coders.map((coder) => ({ user: coder.user, record: coder.records[0] ?? null })),
      })),
    },
  };
}
