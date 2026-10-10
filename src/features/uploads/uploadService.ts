import { fileImportsApi } from "@/api/fileImportsApi";
import { apiSlice } from "@/api/apiSlice";
import { store } from "@/app/store";
import { UploadManager } from "./uploadManager";
import { uploadImportFile } from "./importFile";

interface Request<T> { unwrap(): Promise<T>; abort(): void; reset?: () => void; unsubscribe?: () => void }
async function request<T>(pending: Request<T>, signal: AbortSignal): Promise<T> {
  const abort = () => pending.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try { return await pending.unwrap(); }
  finally { signal.removeEventListener("abort", abort); pending.unsubscribe?.(); pending.reset?.(); }
}
export const backgroundUploads = new UploadManager({
  prepare: (payload, signal) => request(store.dispatch(fileImportsApi.endpoints.prepareFileImport.initiate(payload, { track: false })), signal),
  upload: uploadImportFile,
  complete: (payload, signal) => request(store.dispatch(fileImportsApi.endpoints.completeFileUpload.initiate(payload, { track: false })), signal),
  get: (id, signal) => request(store.dispatch(fileImportsApi.endpoints.getFileImport.initiate(id, { subscribe: false, forceRefetch: true })), signal),
  list: (signal) => request(store.dispatch(fileImportsApi.endpoints.listFileImports.initiate(undefined, { subscribe: false, forceRefetch: true })), signal),
  retry: (id, signal) => request(store.dispatch(fileImportsApi.endpoints.retryFileImport.initiate(id, { track: false })), signal),
  abandon: (id, signal) => request(store.dispatch(fileImportsApi.endpoints.abandonFileImport.initiate(id, { track: false })), signal),
  invalidate: () => { store.dispatch(apiSlice.util.invalidateTags(["KaironUploadBatches", "KaironChartRecords", "ManualDailyRecords", "CodingDashboard", "Team", "Cohorts"])); },
});
const syncSession = () => backgroundUploads.setSession(store.getState().auth.user?.id ?? null);
syncSession(); store.subscribe(syncSession);
