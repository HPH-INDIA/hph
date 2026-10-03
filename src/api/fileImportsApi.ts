import { apiSlice } from "./apiSlice";

export interface FileImportProgress {
  id: string;
  kind: "kairon" | "manual";
  sourceFilename: string;
  status: "uploading" | "queued" | "processing" | "completed" | "failed" | "abandoned";
  totalRows: number;
  processedCount: number;
  insertedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  rejectedCount: number;
  unmatchedCount: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
export interface PreparedFileImport extends FileImportProgress {
  signedUrl: string | null;
  encryptionKey: string | null;
  maxFileBytes: number;
}
export interface PrepareFileImport {
  kind: "kairon" | "manual";
  sourceFilename: string;
  sourceChecksum: string;
  totalRows: number;
  requestId: string;
}
export const fileImportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    prepareFileImport: builder.mutation<PreparedFileImport, PrepareFileImport>({
      query: (body) => ({ url: "/file-imports", method: "POST", body }),
    }),
    completeFileUpload: builder.mutation<FileImportProgress, { id: string; fileSize: number; fileChecksum: string }>({
      query: ({ id, ...body }) => ({ url: `/file-imports/${id}/upload-complete`, method: "POST", body }),
    }),
    getFileImport: builder.query<FileImportProgress, string>({
      query: (id) => ({ url: `/file-imports/${id}` }),
    }),
    listFileImports: builder.query<FileImportProgress[], void>({
      query: () => ({ url: "/file-imports" }),
    }),
    retryFileImport: builder.mutation<FileImportProgress, string>({
      query: (id) => ({ url: `/file-imports/${id}/retry`, method: "POST" }),
    }),
    abandonFileImport: builder.mutation<FileImportProgress, string>({
      query: (id) => ({ url: `/file-imports/${id}/abandon`, method: "POST" }),
    }),
  }),
});
