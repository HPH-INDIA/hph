import { apiSlice, providesList } from "./apiSlice";
import { notifyOnSettle } from "./notify";
import { buildQueryString } from "./queryString";
import type { AdminUser, ManagerTeam, UserCreatePayload, UserUpdatePayload } from "./types";

export type UserStatusFilter = "all" | "active" | "inactive";

const LIST_PATH: Record<UserStatusFilter, string> = {
  all: "/users",
  active: "/users/active",
  inactive: "/users/inactive",
};

export interface UserFilterParams {
  projectIds?: number[];
  roleIds?: number[];
}

export interface ManagerTeamQuery {
  page: number;
  pageSize: number;
  search?: string | null;
  leadId?: number | null;
}

// Also suppress cached or older-server Super Admin rows before they reach any UI.
const visibleUsers = (users: AdminUser[]) => users.filter((user) => user.role.roleType !== "super_admin");

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<AdminUser[], UserStatusFilter>({
      query: (status) => ({ url: LIST_PATH[status] }),
      transformResponse: visibleUsers,
      providesTags: (result) => providesList("Users", result),
    }),
    // GET /users/filter — scopes the list down to a project + role set
    // instead of "everyone the caller can see" (listUsers above). Used by
    // pickers that must only ever offer users below the viewer in the
    // project's hierarchy (e.g. Kairon's Analyst(s) filter).
    listUsersFiltered: builder.query<AdminUser[], UserFilterParams>({
      query: (params) => ({ url: `/users/filter${buildQueryString(params)}` }),
      transformResponse: visibleUsers,
      providesTags: (result) => providesList("Users", result),
    }),
    getUser: builder.query<AdminUser, number>({
      query: (id) => ({ url: `/users/${id}` }),
      providesTags: (_result, _error, id) => [{ type: "Users", id }],
    }),
    getMyManagerTeam: builder.query<ManagerTeam, ManagerTeamQuery>({
      query: (params) => ({ url: `/teams/mine${buildQueryString(params)}` }),
      providesTags: [{ type: "Team" }],
    }),
    assignManagerTeam: builder.mutation<AdminUser[], { coderIds: number[]; leadId: number }>({
      query: (body) => ({ url: "/teams/mine/assign", method: "POST", body }),
      invalidatesTags: [{ type: "Team" }, { type: "Users", id: "LIST" }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    createUser: builder.mutation<AdminUser, UserCreatePayload>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: [{ type: "Users", id: "LIST" }, { type: "Projects", id: "LIST" }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    updateUser: builder.mutation<AdminUser, { id: number; body: UserUpdatePayload }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Users", id },
        { type: "Users", id: "LIST" },
        { type: "Projects", id: "LIST" },
        { type: "Team" },
        { type: "Cohorts", id: "LIST" },
        { type: "CodingDashboard" },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    deactivateUser: builder.mutation<null, { id: number; lastWorkingDay: string }>({
      query: ({ id, lastWorkingDay }) => ({
        url: `/users/${id}`,
        method: "DELETE",
        body: { last_working_day: lastWorkingDay },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Users", id },
        { type: "Users", id: "LIST" },
        { type: "Projects", id: "LIST" },
        { type: "Team" },
        { type: "Cohorts", id: "LIST" },
        { type: "CodingDashboard" },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    resendTemporaryPassword: builder.mutation<AdminUser, number>({
      query: (id) => ({ url: `/users/${id}/resend-temporary-password`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Users", id }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
  }),
});

export const {
  useListUsersQuery,
  useListUsersFilteredQuery,
  useGetUserQuery,
  useGetMyManagerTeamQuery,
  useAssignManagerTeamMutation,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useResendTemporaryPasswordMutation,
} = usersApi;
