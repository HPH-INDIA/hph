import { apiSlice, providesList } from "./apiSlice";
import { buildQueryString } from "./queryString";
import { notifyOnSettle } from "./notify";
import type {
  ChangeStageTargetPayload,
  ChangeFoundationTargetPayload,
  CodingUserSummary,
  CreateTeamCohortPayload,
  StageTargetRule,
  StageTargetChangeResult,
  PaginatedResult,
  TeamCoderOverviewItem,
  TeamCoderOverviewQuery,
  TeamCohort,
} from "./types";

export const cohortsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTeamCoderOverview: builder.query<PaginatedResult<TeamCoderOverviewItem>, TeamCoderOverviewQuery>({
      query: (params) => ({ url: `/team/coders${buildQueryString(params)}` }),
      providesTags: [{ type: "Team" }],
    }),
    listTeamCohorts: builder.query<TeamCohort[], void>({
      query: () => ({ url: "/team/cohorts" }),
      providesTags: (result) => providesList("Cohorts", result),
    }),
    listEligibleCohortMembers: builder.query<CodingUserSummary[], void>({
      query: () => ({ url: "/team/cohorts/eligible-members" }),
      providesTags: [{ type: "Cohorts", id: "ELIGIBLE" }],
    }),
    createTeamCohort: builder.mutation<TeamCohort, CreateTeamCohortPayload>({
      query: (body) => ({ url: "/team/cohorts", method: "POST", body }),
      invalidatesTags: [
        { type: "Cohorts", id: "LIST" },
        { type: "Cohorts", id: "ELIGIBLE" },
        { type: "Team" },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    listStageTargetRules: builder.query<StageTargetRule[], void>({
      query: () => ({ url: "/stage-target-rules" }),
      providesTags: (result) => providesList("StageTargets", result),
    }),
    listFoundationTargetRules: builder.query<StageTargetRule[], void>({
      query: () => ({ url: "/team/foundation-target-rules" }),
      providesTags: [{ type: "StageTargets", id: "FOUNDATION" }],
    }),
    changeFoundationTarget: builder.mutation<StageTargetChangeResult, ChangeFoundationTargetPayload>({
      query: (body) => ({ url: "/team/foundation-targets/change", method: "POST", body }),
      invalidatesTags: [{ type: "StageTargets", id: "FOUNDATION" }, { type: "Team" }, { type: "ManualDailyRecords" }, { type: "CodingDashboard" }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    changeStageTarget: builder.mutation<StageTargetChangeResult, ChangeStageTargetPayload>({
      query: (body) => ({ url: "/team/stage-targets/change", method: "POST", body }),
      invalidatesTags: [{ type: "StageTargets", id: "LIST" }, { type: "CodingDashboard" }, { type: "Team" }, { type: "ManualDailyRecords" }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
  }),
});

export const {
  useGetTeamCoderOverviewQuery,
  useListTeamCohortsQuery,
  useListEligibleCohortMembersQuery,
  useCreateTeamCohortMutation,
  useListStageTargetRulesQuery,
  useChangeStageTargetMutation,
  useListFoundationTargetRulesQuery,
  useChangeFoundationTargetMutation,
} = cohortsApi;
