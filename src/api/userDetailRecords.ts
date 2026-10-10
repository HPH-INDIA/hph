import type { ApiErrorShape } from './apiError';
import type { ApiRequestArgs } from './baseQuery';
import type { KaironChartRecord, KaironTeamRecordQuery, PaginatedResult } from './types';
import { buildQueryString } from './queryString';
type Result = { data?: unknown; error?: ApiErrorShape };
type Query = (args: ApiRequestArgs) => Result | PromiseLike<Result>;
/** Fetch every authorized page; never present a partial list as the full history. */
export async function loadUserChartRecords(args: Omit<KaironTeamRecordQuery, 'page' | 'pageSize'>, query: Query, signal?: AbortSignal, held = false) {
  const rows: KaironChartRecord[] = [];
  let total: number | undefined;
  for (let page = 1; !signal?.aborted; page++) {
    const result = await query({ url: `/reports/kairon/${held ? "holds" : "team-records"}${buildQueryString({ ...(held ? { userId: args.userId } : args), page, pageSize: 100 })}` });
    if (result.error) return { error: result.error };
    const data = result.data as PaginatedResult<KaironChartRecord>;
    if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0 || (total !== undefined && total !== data.total) || data.items.some(row => row.userId !== args.userId || (held && row.status !== "On Hold"))) {
      return { error: { status: 502, message: 'Chart records changed or were incomplete. Please retry.', data: undefined } };
    }
    total = data.total;
    rows.push(...data.items);
    if (new Set(rows.map(row => row.id)).size !== rows.length || rows.length > total || (!data.items.length && rows.length < total)) {
      return { error: { status: 502, message: 'Chart records changed or were incomplete. Please retry.', data: undefined } };
    }
    if (rows.length === total) return { data: rows };
  }
  return { error: { status: 0, message: 'Request cancelled.', data: undefined } };
}
