import { apiSlice } from './apiSlice';
import { loadUserChartRecords } from './userDetailRecords';
import type { KaironChartRecord, KaironTeamRecordQuery } from './types';
export const userDetailsApi = apiSlice.injectEndpoints({ endpoints: builder => ({
  getUserHoldHistory: builder.query<KaironChartRecord[], {userId: number; viewerId: number}>({
    queryFn: (args, api, _options, query) => loadUserChartRecords({userId: args.userId, fromDate: '', toDate: ''}, query, api.signal, true),
    providesTags: [{ type: 'KaironChartRecords', id: 'LIST' }],
  }),
  getUserChartHistory: builder.query<KaironChartRecord[], Omit<KaironTeamRecordQuery, 'page' | 'pageSize'>>({
    queryFn: (args, api, _options, query) => loadUserChartRecords(args, query, api.signal),
    providesTags: [{ type: 'KaironChartRecords', id: 'LIST' }],
  }),
}) });
export const { useGetUserChartHistoryQuery, useGetUserHoldHistoryQuery } = userDetailsApi;
