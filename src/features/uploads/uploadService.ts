import { kaironApi } from "@/api/kaironApi";
import { manualDailyRecordsApi } from "@/api/manualDailyRecordsApi";
import { store } from "@/app/store";

import { UploadManager } from "./uploadManager";

interface Request<T> {
  unwrap(): Promise<T>;
  abort(): void;
  reset?: () => void;
  unsubscribe?: () => void;
}

async function request<T>(pending: Request<T>, signal: AbortSignal): Promise<T> {
  const abort = () => pending.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    return await pending.unwrap();
  } finally {
    signal.removeEventListener("abort", abort);
    pending.unsubscribe?.();
    pending.reset?.();
  }
}

export const backgroundUploads = new UploadManager({
  listManualRecords: (query, signal) => request(store.dispatch(
    manualDailyRecordsApi.endpoints.listManualDailyRecords.initiate(query, { subscribe: false, forceRefetch: true }),
  ), signal),
  startManual: (payload, signal) => request(store.dispatch(
    manualDailyRecordsApi.endpoints.startManualImport.initiate(payload, { track: false }),
  ), signal),
  uploadManual: (payload, signal) => request(store.dispatch(
    manualDailyRecordsApi.endpoints.uploadManualImportChunk.initiate(payload, { track: false }),
  ), signal),
  completeManual: (id, signal) => request(store.dispatch(
    manualDailyRecordsApi.endpoints.completeManualImport.initiate(id, { track: false }),
  ), signal),
  startKairon: (payload, signal) => request(store.dispatch(
    kaironApi.endpoints.startKaironImport.initiate(payload, { track: false }),
  ), signal),
  uploadKairon: (payload, signal) => request(store.dispatch(
    kaironApi.endpoints.uploadKaironImportChunk.initiate(payload, { track: false }),
  ), signal),
  completeKairon: (id, signal) => request(store.dispatch(
    kaironApi.endpoints.completeKaironImport.initiate(id, { track: false }),
  ), signal),
});

const syncSession = () => backgroundUploads.setSession(store.getState().auth.user?.id ?? null);
syncSession();
store.subscribe(syncSession);
