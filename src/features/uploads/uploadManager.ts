import { getErrorMessage } from "@/api/apiError";
import type { FileImportProgress, PreparedFileImport, PrepareFileImport } from "@/api/fileImportsApi";
import type { KaironChartRowInput, ManualImportRow } from "@/api/types";
import { buildImportFile } from "./importFile";

export type UploadInput =
  | { kind: "kairon"; fileName: string; fileChecksum: string; rows: KaironChartRowInput[] }
  | { kind: "manual"; fileName: string; fileChecksum: string; rows: ManualImportRow[]; minDate: string | null; maxDate: string | null };
export interface UploadJob {
  id: string;
  kind: UploadInput["kind"];
  fileName: string;
  status: "preparing" | "uploading" | "queued" | "processing" | "completing" | "completed" | "failed" | "abandoned";
  processedCount: number;
  totalRows: number;
  transferPercent?: number;
  progress?: FileImportProgress;
  error?: string;
}
export interface UploadTransport {
  prepare(payload: PrepareFileImport, signal: AbortSignal): Promise<PreparedFileImport>;
  upload(url: string, blob: Blob, transfer: { url?: string }, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void>;
  complete(payload: { id: string; fileSize: number; fileChecksum: string }, signal: AbortSignal): Promise<FileImportProgress>;
  get(id: string, signal: AbortSignal): Promise<FileImportProgress>;
  list(signal: AbortSignal): Promise<FileImportProgress[]>;
  retry(id: string, signal: AbortSignal): Promise<FileImportProgress>;
  abandon(id: string, signal: AbortSignal): Promise<FileImportProgress>;
  invalidate(): void;
}
interface Work {
  input?: UploadInput;
  prepared?: PreparedFileImport;
  file?: { blob: Blob; checksum: string };
  transfer: { url?: string };
  uploaded?: boolean;
  running: boolean;
  controller?: AbortController;
}
function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 3000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export class UploadManager {
  private jobs: UploadJob[] = [];
  private work = new Map<string, Work>();
  private listeners = new Set<() => void>();
  private userId: number | null | undefined;
  private sessionController?: AbortController;
  private retiredIds = new Set<string>();
  private completionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private transport: UploadTransport,
    private buildFile = buildImportFile,
    private wait = delay) {}
  getSnapshot = () => this.jobs;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  private update(id: string, changes: Partial<UploadJob>) {
    this.jobs = this.jobs.map((job) => job.id === id ? { ...job, ...changes } : job); this.emit();
  }
  private accept(progress: FileImportProgress) {
    this.update(progress.id, { progress, status: progress.status, processedCount: progress.processedCount,
      totalRows: progress.totalRows, error: progress.error ?? undefined });
    if (progress.status === "completed") {
      this.retiredIds.add(progress.id);
      this.work.delete(progress.id);
      // Success is transient; server history must never recreate this notification.
      if (!this.completionTimers.has(progress.id)) {
        this.completionTimers.set(progress.id, setTimeout(() => {
          this.completionTimers.delete(progress.id);
          this.remove(progress.id);
        }, 8000));
      }
      this.transport.invalidate();
      return true;
    }
    return progress.status === "failed" || progress.status === "abandoned";
  }
  start = (input: UploadInput): string => {
    const duplicate = this.jobs.find((job) => this.work.get(job.id)?.input?.fileChecksum === input.fileChecksum && job.kind === input.kind);
    if (duplicate) return duplicate.id;
    const id = crypto.randomUUID();
    const work: Work = { input: { ...input, rows: input.rows.map((row) => ({ ...row })) } as UploadInput, transfer: {}, running: false };
    this.work.set(id, work);
    this.jobs = [...this.jobs, { id, kind: input.kind, fileName: input.fileName, status: "preparing", processedCount: 0, totalRows: input.rows.length }];
    this.emit(); this.launch(id, work); return id;
  };
  retry = (id: string) => {
    const work = this.work.get(id);
    if (work && !work.running && this.jobs.find((job) => job.id === id)?.status === "failed") this.launch(id, work);
  };
  dismiss = (id: string) => {
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job || !["completed", "failed", "abandoned"].includes(job.status)) return;
    const work = this.work.get(id);
    if ((work?.prepared || job.progress) && job.status === "failed") {
      // Release an unfinished/failed slot explicitly; processing jobs cannot be abandoned.
      const controller = new AbortController();
      void this.transport.abandon(id, controller.signal).then(() => this.remove(id)).catch((error) => this.update(id, { error: getErrorMessage(error) }));
    } else this.remove(id);
  };
  cancel = (id: string) => {
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job || job.status !== "uploading") return;
    const controller = new AbortController();
    void this.transport.abandon(id, controller.signal).then(() => this.remove(id)).catch((error) => this.update(id, { error: getErrorMessage(error) }));
  };
  private remove(id: string) {
    clearTimeout(this.completionTimers.get(id));
    this.completionTimers.delete(id);
    this.retiredIds.add(id);
    this.work.get(id)?.controller?.abort(); this.work.delete(id); this.jobs = this.jobs.filter((job) => job.id !== id); this.emit(); }
  clear = () => {
    this.sessionController?.abort();
    for (const timer of this.completionTimers.values()) clearTimeout(timer);
    this.completionTimers.clear();
    this.retiredIds.clear();
    for (const work of this.work.values()) work.controller?.abort();
    this.work.clear(); this.jobs = []; this.emit();
  };
  setSession = (userId: number | null) => {
    if (userId === this.userId) return;
    this.userId = userId; this.clear();
    if (userId === null) return;
    const controller = new AbortController(); this.sessionController = controller;
    void this.transport.list(controller.signal).then((jobs) => {
      if (controller.signal.aborted || this.userId !== userId) return;
      for (const progress of jobs) {
        if (progress.status === "completed" || progress.status === "abandoned" || this.retiredIds.has(progress.id) ||
          this.jobs.some((job) => job.id === progress.id)) continue;
        this.jobs = [...this.jobs, { id: progress.id, kind: progress.kind, fileName: progress.sourceFilename,
          status: progress.status, processedCount: progress.processedCount, totalRows: progress.totalRows, progress, error: progress.error ?? undefined }];
        {
          const work: Work = { transfer: {}, running: false }; this.work.set(progress.id, work);
          if (progress.status !== "failed") this.launch(progress.id, work);
        }
      }
      this.emit();
    }).catch(() => { /* Existing imports remain durable and can be recovered on next login. */ });
  };
  private launch(id: string, work: Work) {
    work.running = true; work.controller = new AbortController();
    this.update(id, { error: undefined });
    void this.run(id, work, work.controller.signal);
  }
  private async run(id: string, work: Work, signal: AbortSignal) {
    const alive = () => this.work.get(id) === work && !signal.aborted;
    try {
      let server = this.jobs.find((job) => job.id === id)?.progress;
      if (server?.status === "failed") server = await this.transport.retry(id, signal);
      if (!work.prepared && work.input && !server) {
        this.update(id, { status: "preparing" });
        const input = work.input;
        work.prepared = await this.transport.prepare({ kind: input.kind, requestId: id,
          sourceFilename: input.fileName, sourceChecksum: input.fileChecksum, totalRows: input.rows.length }, signal);
        if (!alive()) return;
        server = work.prepared;
      }
      if (work.prepared?.status === "uploading" && work.input && !work.uploaded && (!server || server.status === "uploading")) {
        if (work.file) {
          // Refresh short-lived authorization while retaining the same per-import key and ciphertext.
          const input = work.input;
          work.prepared = await this.transport.prepare({ kind: input.kind, requestId: id,
            sourceFilename: input.fileName, sourceChecksum: input.fileChecksum, totalRows: input.rows.length }, signal);
          if (!alive()) return;
          if (work.prepared.status !== "uploading") server = work.prepared;
        }
        if (!work.file) {
          const prepared = work.prepared;
          if (!prepared.encryptionKey || !prepared.signedUrl) throw new Error("Upload authorization is missing.");
          work.file = await this.buildFile(id, prepared.encryptionKey, work.input.rows, prepared.maxFileBytes, signal);
          if (!alive()) return;
        }
        if (server && server.status !== "uploading") {
          work.input = undefined; work.file = undefined; work.prepared = undefined;
        } else {
          this.update(id, { status: "uploading" });
          try {
            await this.transport.upload(work.prepared.signedUrl!, work.file.blob, work.transfer, signal,
              (transferPercent) => { if (alive()) this.update(id, { transferPercent }); });
            work.uploaded = true;
          } catch (error) {
            if (!alive()) return;
            // A lost final response may still mean Supabase received the whole object.
            const current = await this.transport.get(id, signal);
            if (current.status === "uploading") throw error;
            server = current;
          }
          if (!alive()) return;
        }
      }
      if (work.uploaded && work.file && (!server || server.status === "uploading")) {
        this.update(id, { status: "completing" });
        server = await this.transport.complete({ id, fileSize: work.file.blob.size, fileChecksum: work.file.checksum }, signal);
        if (!alive()) return;
      }
      if (server && server.status !== "uploading") {
        // No identifiers or encrypted payloads are retained after server submission.
        work.input = undefined; work.file = undefined; work.prepared = undefined;
      }
      while (alive()) {
        const current = server ?? await this.transport.get(id, signal);
        if (!alive()) return;
        if (this.accept(current)) return;
        await this.wait(signal);
        server = undefined;
      }
    } catch (error) {
      if (alive()) this.update(id, { status: "failed", error: getErrorMessage(error) });
    } finally { work.running = false; work.controller = undefined; }
  }
}
