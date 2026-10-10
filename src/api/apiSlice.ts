import { createApi } from "@reduxjs/toolkit/query/react";

import { apiBaseQuery } from "./baseQuery";

export type TagType =
  | "CurrentUser"
  | "Sessions"
  | "Users"
  | "Roles"
  | "Features"
  | "MetricTheme"
  | "Projects"
  | "RoleTypes"
  | "KaironChartRecords"
  | "KaironUploadBatches"
  | "KaironAnalystReviews"
  | "ManualDailyRecords"
  | "CodingDashboard"
  | "Team"
  | "Cohorts"
  | "StageTargets"
  | "LoginHours";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: apiBaseQuery,
  tagTypes: [
    "CurrentUser",
    "Sessions",
    "Users",
    "Roles",
    "Features",
    "Projects",
    "MetricTheme",
    "RoleTypes",
    "KaironChartRecords",
    "KaironUploadBatches",
    "KaironAnalystReviews",
    "ManualDailyRecords",
    "CodingDashboard",
    "Team",
    "Cohorts",
    "StageTargets",
    "LoginHours",
  ],
  endpoints: () => ({}),
});

// Shared list/detail tag helper: every list endpoint provides one tag per
// row plus a `LIST` tag, so a create/update/delete mutation can invalidate
// just the list (or the list + one row) without refetching unrelated rows.
export function providesList<T extends { id: number }>(tagType: TagType, result: T[] | undefined) {
  const listTag = { type: tagType, id: "LIST" as const };
  return result ? [...result.map(({ id }) => ({ type: tagType, id })), listTag] : [listTag];
}
