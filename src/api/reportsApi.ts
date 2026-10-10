import { loadLeadCoderPerformance, type LeadCoderPerformanceQuery, type CoderPerformanceMember } from "./coderPerformance";
import { apiSlice, providesList } from "./apiSlice";
import { loadManualTeamDay, type ManualTeamDayQuery } from "./manualTeamDay";
import { loadManualTeamRange, type ManualTeamRangeQuery } from "./manualTeamRange";
import { notifyOnSettle } from "./notify";
import { buildQueryString } from "./queryString";
import type {
  BulkApproveResult,
  BulkRejectItem,
  BulkRejectResult,
  CodingDashboardCard,
  CodingDashboardQuery,
  EfficiencySummary,
  KaironChartRecord,
  KaironCompletedDailyCount,
  KaironCompletedRecordQuery,
  KaironCompletedUserQuery,
  KaironCompletedUserSummary,
  KaironHoldQuery,
  KaironHoldSummary,
  KaironLeadTeamRange,
  KaironManagerTeamRange,
  KaironTeamRecordQuery,
  ManualDailyRecord,
  ManualDailyRecordQuery,
  ManualTeamDay,
  ManualTeamRange,
  MonthlyGoalSummary,
  LeadDashboardQuery,
  LeadDashboardSummary,
  ManagerDashboardQuery,
  ManagerDashboardSummary,
  PaginatedResult,
  PaginationQuery,
  SelfKaironChartQuery,
} from "./types";

// The viewer participates in the cache key, never in server authorization.
type KaironHoldRequest = { viewerId: number; filters: KaironHoldQuery };

type ReportPeriodQuery = PaginationQuery & { fromDate?: string; toDate?: string };

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Always "and it's mine" server-side — see SelfKaironChartQuery's note.
    getMyKaironRecords: builder.query<PaginatedResult<KaironChartRecord>, SelfKaironChartQuery | void>({
      query: (args) => ({ url: `/reports/kairon${buildQueryString({ ...args })}` }),
      providesTags: (result) => providesList("KaironChartRecords", result?.items),
    }),
    getKaironCompletedCounts: builder.query<PaginatedResult<KaironCompletedDailyCount>, ReportPeriodQuery | void>({
      query: (args) => ({ url: `/reports/kairon/completed-counts${buildQueryString({ ...args })}` }),
      providesTags: [{ type: "KaironChartRecords", id: "LIST" }],
    }),
    getKaironCompletedUsers: builder.query<PaginatedResult<KaironCompletedUserSummary>, KaironCompletedUserQuery>({
      query: (args) => ({ url: `/reports/kairon/completed-users${buildQueryString({ ...args })}` }),
      providesTags: [{ type: "KaironChartRecords", id: "LIST" }],
    }),
    getKaironCompletedRecords: builder.query<PaginatedResult<KaironChartRecord>, KaironCompletedRecordQuery>({
      query: (args) => ({ url: `/reports/kairon/completed-records${buildQueryString({ ...args })}` }),
      providesTags: (result) => providesList("KaironChartRecords", result?.items),
    }),
    getKaironLeadTeamRange: builder.query<KaironLeadTeamRange, { fromDate: string; toDate: string }>({
      query: (args) => ({ url: `/reports/kairon/team-range${buildQueryString(args)}` }),
      providesTags: [
        { type: "KaironChartRecords", id: "LIST" },
        { type: "Team" },
        { type: "Users", id: "LIST" },
      ],
    }),
    getKaironManagerTeamRange: builder.query<KaironManagerTeamRange, { fromDate: string; toDate: string }>({
      query: (args) => ({ url: `/reports/kairon/manager-team-range${buildQueryString(args)}` }),
      providesTags: [
        { type: "KaironChartRecords", id: "LIST" },
        { type: "Team" },
        { type: "Users", id: "LIST" },
      ],
    }),
    getKaironHolds: builder.query<PaginatedResult<KaironChartRecord>, KaironHoldRequest>({
      query: ({ filters }) => ({ url: `/reports/kairon/holds${buildQueryString(filters)}` }),
      providesTags: (result) => [...providesList("KaironChartRecords", result?.items), { type: "Team" }, { type: "Users", id: "LIST" }],
    }),
    getKaironHoldSummary: builder.query<KaironHoldSummary, KaironHoldRequest>({
      query: ({ filters }) => ({ url: `/reports/kairon/holds-summary${buildQueryString(filters)}` }),
      providesTags: [{ type: "KaironChartRecords", id: "LIST" }, { type: "Team" }, { type: "Users", id: "LIST" }],
    }),
    getKaironTeamHolds: builder.query<PaginatedResult<KaironChartRecord>, PaginationQuery>({
      query: (args) => ({ url: `/reports/kairon/team-holds${buildQueryString(args)}` }),
      providesTags: (result) => providesList("KaironChartRecords", result?.items),
    }),
    getKaironTeamRecords: builder.query<PaginatedResult<KaironChartRecord>, KaironTeamRecordQuery>({
      query: (args) => ({ url: `/reports/kairon/team-records${buildQueryString(args)}` }),
      providesTags: (result) => providesList("KaironChartRecords", result?.items),
    }),
    getMyManualRecords: builder.query<PaginatedResult<ManualDailyRecord>, ReportPeriodQuery | void>({
      query: (args) => ({ url: `/reports/manual${buildQueryString({ ...args })}` }),
      providesTags: (result) => providesList("ManualDailyRecords", result?.items),
    }),
    getManualTeamDay: builder.query<ManualTeamDay, ManualTeamDayQuery>({
      queryFn: (args, _api, _extraOptions, query) => loadManualTeamDay(args, query),
      providesTags: [
        { type: "ManualDailyRecords", id: "LIST" },
        { type: "Team" },
        { type: "Users", id: "LIST" },
      ],
    }),
    getManualTeamRange: builder.query<ManualTeamRange, ManualTeamRangeQuery>({
      queryFn: (args, _api, _extraOptions, query) => loadManualTeamRange(args, query),
      providesTags: [
        { type: "ManualDailyRecords", id: "LIST" },
        { type: "Team" },
        { type: "Users", id: "LIST" },
      ],
    }),
    // Other users' records, pending and decided alike (for audit) — never
    // the reviewing manager's own, which they already see in their own tab.
    listManualReviews: builder.query<PaginatedResult<ManualDailyRecord>, ManualDailyRecordQuery | void>({
      query: (args) => ({ url: `/reports/manual/reviews${buildQueryString({ ...args })}` }),
      providesTags: (result) => providesList("ManualDailyRecords", result?.items),
    }),
    bulkApproveManualRecords: builder.mutation<BulkApproveResult, number[]>({
      query: (ids) => ({ url: "/reports/manual/reviews/bulk-approve", method: "POST", body: { ids } }),
      invalidatesTags: [{ type: "ManualDailyRecords", id: "LIST" }, { type: "CodingDashboard" }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    bulkRejectManualRecords: builder.mutation<BulkRejectResult, BulkRejectItem[]>({
      query: (items) => ({ url: "/reports/manual/reviews/bulk-reject", method: "POST", body: { items } }),
      invalidatesTags: [{ type: "ManualDailyRecords", id: "LIST" }, { type: "CodingDashboard" }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    getCodingDashboard: builder.query<CodingDashboardCard[], CodingDashboardQuery | void>({
      query: (args) => ({ url: `/dashboards/coding${buildQueryString({ ...args })}` }),
      providesTags: [{ type: "CodingDashboard" }],
    }),
    getLeadCoderPerformance: builder.query<CoderPerformanceMember[], LeadCoderPerformanceQuery>({
      queryFn: (args, api, _extraOptions, query) => loadLeadCoderPerformance(args, query, api.signal),
      providesTags: [{ type: "CodingDashboard" }, { type: "Users", id: "LIST" }, { type: "Team" }],
    }),
    getLeadDashboard: builder.query<LeadDashboardSummary, LeadDashboardQuery>({
      query: (args) => ({ url: `/dashboards/lead${buildQueryString(args)}` }),
      providesTags: [{ type: "CodingDashboard" }, { type: "Users", id: "LIST" }, { type: "Team" }],
    }),
    getManagerDashboard: builder.query<ManagerDashboardSummary, ManagerDashboardQuery>({
      query: (args) => ({ url: `/dashboards/manager${buildQueryString(args)}` }),
      providesTags: [{ type: "CodingDashboard" }, { type: "Users", id: "LIST" }, { type: "Team" }],
    }),
    getManagerCoderSelection: builder.query<ManagerDashboardSummary[], { scope: ManagerDashboardQuery; coderIds: number[] }>({
      async queryFn({ scope, coderIds }, _api, _options, query) {
        const data: ManagerDashboardSummary[] = [];
        const ids = [...new Set(coderIds)];
        for (let index = 0; index < ids.length; index += 3) {
          const results = await Promise.all(ids.slice(index, index + 3).map(coderId => query({ url: `/dashboards/manager${buildQueryString({ ...scope, coderId })}` })));
          for (const result of results) {
            if (result.error) return { error: result.error };
            data.push(result.data as ManagerDashboardSummary);
          }
        }
        return { data };
      },
      providesTags: [{ type: "CodingDashboard" }, { type: "Users", id: "LIST" }, { type: "Team" }],
    }),
    getMyEfficiency: builder.query<EfficiencySummary, CodingDashboardQuery | void>({
      query: (args) => ({ url: `/dashboards/my-efficiency${buildQueryString({ ...args })}` }),
      providesTags: [{ type: "CodingDashboard" }],
    }),
    getMonthlyGoal: builder.query<MonthlyGoalSummary, { month?: string } | void>({
      query: (args) => ({ url: `/dashboards/monthly-goal${buildQueryString({ ...args })}` }),
      providesTags: [{ type: "CodingDashboard" }],
    }),
  }),
});

export const {
  useGetMyKaironRecordsQuery,
  useGetKaironCompletedCountsQuery,
  useGetKaironCompletedUsersQuery,
  useGetKaironCompletedRecordsQuery,
  useGetKaironLeadTeamRangeQuery,
  useGetKaironManagerTeamRangeQuery,
  useGetKaironHoldsQuery,
  useGetKaironHoldSummaryQuery,
  useGetKaironTeamHoldsQuery,
  useGetKaironTeamRecordsQuery,
  useGetMyManualRecordsQuery,
  useGetManualTeamDayQuery,
  useGetManualTeamRangeQuery,
  useListManualReviewsQuery,
  useBulkApproveManualRecordsMutation,
  useBulkRejectManualRecordsMutation,
  useGetCodingDashboardQuery,
  useGetMyEfficiencyQuery,
  useGetLeadDashboardQuery,
  useGetLeadCoderPerformanceQuery,
  useGetManagerDashboardQuery,
  useGetManagerCoderSelectionQuery,
  useGetMonthlyGoalQuery,
} = reportsApi;
