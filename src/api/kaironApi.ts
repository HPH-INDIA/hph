import { apiSlice, providesList } from "./apiSlice";
import { notifyOnSettle } from "./notify";
import { buildQueryString } from "./queryString";
import type {
  KaironAnalystReview,
  KaironAnalystReviewStatus,
  KaironChartQuery,
  KaironChartRecord,
  KaironImportChunkPayload,
  KaironImportProgress,
  KaironImportStartPayload,
  KaironUploadBatch,
} from "./types";

export const kaironApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listKaironCharts: builder.query<KaironChartRecord[], KaironChartQuery | void>({
      query: (args) => ({ url: `/kairon/charts${buildQueryString({ ...args })}` }),
      providesTags: (result) => providesList("KaironChartRecords", result),
    }),
    listKaironUploadBatches: builder.query<KaironUploadBatch[], void>({
      query: () => ({ url: "/kairon/uploads" }),
      providesTags: (result) => providesList("KaironUploadBatches", result),
    }),
    startKaironImport: builder.mutation<KaironImportProgress, KaironImportStartPayload>({
      query: (body) => ({ url: "/kairon/imports", method: "POST", body }),
    }),
    uploadKaironImportChunk: builder.mutation<KaironImportProgress, KaironImportChunkPayload>({
      query: ({ importId, chunkNumber, checksum, rows }) => ({
        url: `/kairon/imports/${importId}/chunks/${chunkNumber}`,
        method: "POST",
        body: { checksum, rows },
      }),
    }),
    completeKaironImport: builder.mutation<KaironImportProgress, number>({
      query: (importId) => ({ url: `/kairon/imports/${importId}/complete`, method: "POST" }),
      invalidatesTags: [
        { type: "KaironUploadBatches", id: "LIST" },
        { type: "KaironChartRecords", id: "LIST" },
        { type: "CodingDashboard" },
        { type: "Team" },
        { type: "Cohorts", id: "LIST" },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
    listKaironAnalystReviews: builder.query<KaironAnalystReview[], KaironAnalystReviewStatus | undefined>({
      query: (status) => ({ url: `/kairon/analyst-reviews${buildQueryString({ status })}` }),
      providesTags: (result) => providesList("KaironAnalystReviews", result),
    }),
    resolveKaironAnalystReview: builder.mutation<KaironAnalystReview, { reviewId: number; userId: number }>({
      query: ({ reviewId, userId }) => ({
        url: `/kairon/analyst-reviews/${reviewId}/resolve`,
        method: "POST",
        body: { userId },
      }),
      invalidatesTags: (_result, _error, { reviewId }) => [
        { type: "KaironAnalystReviews", id: reviewId },
        { type: "KaironAnalystReviews", id: "LIST" },
        { type: "KaironChartRecords", id: "LIST" },
        { type: "CodingDashboard" },
        { type: "Team" },
        { type: "Cohorts", id: "LIST" },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await notifyOnSettle(dispatch, queryFulfilled);
      },
    }),
  }),
});

export const {
  useListKaironChartsQuery,
  useListKaironUploadBatchesQuery,
  useStartKaironImportMutation,
  useUploadKaironImportChunkMutation,
  useCompleteKaironImportMutation,
  useListKaironAnalystReviewsQuery,
  useResolveKaironAnalystReviewMutation,
} = kaironApi;
