import { getErrorMessage } from "@/api/apiError";
import type {
  KaironChartRowInput,
  KaironImportChunkPayload,
  KaironImportProgress,
  KaironImportStartPayload,
  ManualDailyRecord,
  ManualDailyRecordQuery,
  ManualImportChunkPayload,
  ManualImportProgress,
  ManualImportRow,
  ManualImportStartPayload,
} from "@/api/types";
import { IMPORT_CHUNK_SIZE, sha256 } from "@/lib/imports";

export type UploadInput =
  | { kind: "kairon"; fileName: string; fileChecksum: string; rows: KaironChartRowInput[] }
  | { kind: "manual"; fileName: string; fileChecksum: string; rows: ManualImportRow[]; minDate: string | null; maxDate: string | null };

export interface UploadJob {
  id: string;
  kind: UploadInput["kind"];
  fileName: string;
  status: "preparing" | "uploading" | "completing" | "completed" | "failed";
  processedCount: number;
  totalRows: number;
  progress?: KaironImportProgress | ManualImportProgress;
  comparison?: { newCount: number; modifiedCount: number; unchangedCount: number };
  error?: string;
}

export interface UploadTransport {
  listManualRecords(query: ManualDailyRecordQuery, signal: AbortSignal): Promise<ManualDailyRecord[]>;
  startKairon(payload: KaironImportStartPayload, signal: AbortSignal): Promise<KaironImportProgress>;
  uploadKairon(payload: KaironImportChunkPayload, signal: AbortSignal): Promise<KaironImportProgress>;
  completeKairon(importId: number, signal: AbortSignal): Promise<KaironImportProgress>;
  startManual(payload: ManualImportStartPayload, signal: AbortSignal): Promise<ManualImportProgress>;
  uploadManual(payload: ManualImportChunkPayload, signal: AbortSignal): Promise<ManualImportProgress>;
  completeManual(importId: number, signal: AbortSignal): Promise<ManualImportProgress>;
}

type Progress = KaironImportProgress | ManualImportProgress;
type PendingChunk = { offset: number; chunkNumber: number; checksum: string };
interface UploadWork {
  input: UploadInput;
  candidates?: ManualImportRow[];
  progress?: Progress;
  pendingChunk?: PendingChunk;
  running: boolean;
  controller?: AbortController;
}

function valuesMatch(row: ManualImportRow, existing: ManualDailyRecord) {
  return existing.productionCount === row.productionCount &&
    Number(existing.techIssuesDowntimeHours) === row.techIssuesDowntimeHours &&
    Number(existing.noInventoryIdleTimeHours) === row.noInventoryIdleTimeHours &&
    Number(existing.leaveHours) === row.leaveHours &&
    Number(existing.meetingEngagementHours) === row.meetingEngagementHours;
}

/** Retains raw rows in memory; observable job snapshots contain only status metadata. */
export class UploadManager {
  private jobs: UploadJob[] = [];
  private readonly work = new Map<string, UploadWork>();
  private readonly listeners = new Set<() => void>();
  private sequence = 0;
  private userId: number | null | undefined;

  constructor(
    private readonly transport: UploadTransport,
    private readonly checksum: (value: string) => Promise<string> = sha256,
  ) {}

  getSnapshot = (): UploadJob[] => this.jobs;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  start = (input: UploadInput): string => {
    for (const [id, work] of this.work) {
      if (work.input.kind === input.kind && work.input.fileChecksum === input.fileChecksum) return id;
    }
    const id = `upload-${++this.sequence}`;
    // Snapshot the rows so changing/resetting the source form cannot alter a retry's payload.
    const snapshot: UploadInput = input.kind === "kairon"
      ? { ...input, rows: input.rows.map((row) => ({ ...row })) }
      : { ...input, rows: input.rows.map((row) => ({ ...row })) };
    const work: UploadWork = { input: snapshot, running: false };
    this.work.set(id, work);
    this.jobs = [...this.jobs, {
      id, kind: input.kind, fileName: input.fileName, status: "preparing",
      processedCount: 0, totalRows: input.rows.length,
    }];
    this.emit();
    this.launch(id, work);
    return id;
  };

  retry = (id: string) => {
    const work = this.work.get(id);
    if (!work || work.running || this.jobs.find((job) => job.id === id)?.status !== "failed") return;
    this.launch(id, work);
  };

  dismiss = (id: string) => {
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job || (job.status !== "completed" && job.status !== "failed")) return;
    this.work.delete(id);
    this.jobs = this.jobs.filter((entry) => entry.id !== id);
    this.emit();
  };

  clear = () => {
    const work = [...this.work.values()];
    this.work.clear();
    this.jobs = [];
    // Invalidate first: abort callbacks must not resurrect cleared jobs.
    for (const entry of work) entry.controller?.abort();
    this.emit();
  };

  /** Same-user whoami refreshes preserve work; logout/rejection/user switches discard it. */
  setSession = (userId: number | null) => {
    if (this.userId === userId) return;
    this.userId = userId;
    this.clear();
  };

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private update(id: string, update: Partial<UploadJob>) {
    this.jobs = this.jobs.map((job) => job.id === id ? { ...job, ...update } : job);
    this.emit();
  }

  private launch(id: string, work: UploadWork) {
    // Set before awaiting anything to make repeated Retry clicks harmless.
    work.running = true;
    work.controller = new AbortController();
    this.update(id, { status: work.progress ? "uploading" : "preparing", error: undefined });
    void this.run(id, work, work.controller.signal);
  }

  private async run(id: string, work: UploadWork, signal: AbortSignal) {
    const alive = () => this.work.get(id) === work && !signal.aborted;
    const accept = (progress: Progress) => {
      work.progress = progress;
      this.update(id, { progress, processedCount: progress.processedCount, totalRows: progress.totalRows });
      if (progress.status === "failed") {
        // The server may make a failed import resumable via the idempotent start endpoint.
        work.progress = undefined;
        work.pendingChunk = undefined;
        throw new Error("The server marked this import as failed. Retry to resume it, or dismiss it and upload a corrected file.");
      }
      if (progress.status === "completed") {
        this.finish(id);
        return true;
      }
      return false;
    };

    try {
      if (!alive()) return;
      const input = work.input;
      if (input.kind === "manual" && !work.candidates) {
        const existing = await this.transport.listManualRecords({
          fromDate: input.minDate,
          toDate: input.maxDate,
          userIds: [...new Set(input.rows.map((row) => row.userId))],
        }, signal);
        if (!alive()) return;
        const byUserDate = new Map(existing.map((record) => [`${record.userId}|${record.date}`, record]));
        const comparison = { newCount: 0, modifiedCount: 0, unchangedCount: 0 };
        work.candidates = input.rows.filter((row) => {
          const record = byUserDate.get(`${row.userId}|${row.date}`);
          if (!record) comparison.newCount += 1;
          else if (valuesMatch(row, record)) {
            comparison.unchangedCount += 1;
            return false;
          } else comparison.modifiedCount += 1;
          return true;
        });
        this.update(id, { comparison, totalRows: work.candidates.length });
      }
      const rows = input.kind === "manual" ? work.candidates! : input.rows;
      if (rows.length === 0) {
        this.finish(id);
        return;
      }
      if (!work.progress) {
        const payload = { sourceFilename: input.fileName, fileChecksum: input.fileChecksum, totalRows: rows.length };
        const progress = input.kind === "manual"
          ? await this.transport.startManual(payload, signal)
          : await this.transport.startKairon(payload, signal);
        if (!alive()) return;
        if (accept(progress)) return;
      }
      this.update(id, { status: "uploading" });
      while (work.progress!.processedCount < rows.length) {
        if (!alive()) return;
        const offset = work.progress!.processedCount;
        if (!work.pendingChunk) {
          const chunkRows = rows.slice(offset, offset + IMPORT_CHUNK_SIZE);
          const checksum = await this.checksum(JSON.stringify(chunkRows));
          if (!alive()) return;
          work.pendingChunk = { offset, chunkNumber: Math.floor(offset / IMPORT_CHUNK_SIZE), checksum };
        }
        const chunk = work.pendingChunk;
        const payload = { importId: work.progress!.id, chunkNumber: chunk.chunkNumber, checksum: chunk.checksum };
        const progress = input.kind === "manual"
          ? await this.transport.uploadManual({ ...payload, rows: work.candidates!.slice(chunk.offset, chunk.offset + IMPORT_CHUNK_SIZE) }, signal)
          : await this.transport.uploadKairon({ ...payload, rows: input.rows.slice(chunk.offset, chunk.offset + IMPORT_CHUNK_SIZE) }, signal);
        if (!alive()) return;
        if (accept(progress)) return;
        if (progress.processedCount < Math.min(chunk.offset + IMPORT_CHUNK_SIZE, rows.length)) {
          throw new Error("The server did not acknowledge this upload chunk. Please retry.");
        }
        work.pendingChunk = undefined;
      }
      this.update(id, { status: "completing" });
      if (!alive()) return;
      const completed = input.kind === "manual"
        ? await this.transport.completeManual(work.progress!.id, signal)
        : await this.transport.completeKairon(work.progress!.id, signal);
      if (!alive()) return;
      if (!accept(completed)) throw new Error("The server has not completed this import yet. Please retry.");
    } catch (error) {
      if (alive()) this.update(id, { status: "failed", error: getErrorMessage(error) });
    } finally {
      work.running = false;
      work.controller = undefined;
    }
  }

  private finish(id: string) {
    // No completed job retains patient identifiers or the original workbook rows.
    this.work.delete(id);
    this.update(id, { status: "completed", error: undefined });
  }
}
