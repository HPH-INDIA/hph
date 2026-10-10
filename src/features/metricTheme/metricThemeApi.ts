import { apiSlice } from "@/api/apiSlice";
import type { MetricTheme } from "./metricTheme";
export type ProjectTheme = { theme: MetricTheme; configured: boolean };
const themeApi = apiSlice.injectEndpoints({ endpoints: builder => ({
  getMetricTheme: builder.query<ProjectTheme, string>({ query: () => ({url:"/project-metric-theme"}), providesTags:["MetricTheme"] }),
  saveMetricTheme: builder.mutation<ProjectTheme, MetricTheme>({ query: body => ({url:"/project-metric-theme",method:"PUT",body}), invalidatesTags:["MetricTheme"] }),
}) });
export const {useGetMetricThemeQuery,useSaveMetricThemeMutation} = themeApi;
