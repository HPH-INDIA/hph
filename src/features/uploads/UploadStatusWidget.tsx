import { useId } from "react";

import type { UploadJob } from "./uploadManager";
import { backgroundUploads } from "./uploadService";
import { useBackgroundUploads } from "./useBackgroundUploads";

function completionSummary(job: UploadJob) {
  if (job.progress && "insertedCount" in job.progress) {
    const progress = job.progress;
    return `${progress.insertedCount.toLocaleString()} new · ${progress.updatedCount.toLocaleString()} updated · ${progress.unchangedCount.toLocaleString()} unchanged · ${progress.rejectedCount.toLocaleString()} rejected · ${progress.unmatchedCount.toLocaleString()} unmatched`;
  }

  const progress = job.progress;
  const unchanged = (progress?.unchangedCount ?? 0) + (job.comparison?.unchangedCount ?? 0);
  return `${(progress?.createdCount ?? 0).toLocaleString()} created · ${(progress?.updatedCount ?? 0).toLocaleString()} updated · ${unchanged.toLocaleString()} unchanged`;
}

function UploadStatusItem({ job }: { job: UploadJob }) {
  const typeLabel = job.kind === "kairon" ? "Kairon" : "Manual";
  const isComplete = job.status === "completed";
  const isFailed = job.status === "failed";
  const isPreparing = job.status === "preparing";
  const isActive = !isComplete && !isFailed;
  const percent = isComplete
    ? 100
    : job.totalRows > 0
      ? Math.min(100, Math.max(0, Math.round((job.processedCount / job.totalRows) * 100)))
      : 0;
  const statusLabel = {
    preparing: job.kind === "manual" ? "Comparing records…" : "Preparing upload…",
    uploading: "Uploading…",
    completing: "Finishing upload…",
    completed: "Complete",
    failed: "Upload stopped",
  }[job.status];
  const progressText = job.totalRows > 0
    ? `${job.processedCount.toLocaleString()} of ${job.totalRows.toLocaleString()} rows`
    : isComplete ? "No changes needed" : "Preparing rows";

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content-primary">{typeLabel} upload</p>
          <p className="truncate text-xs text-content-secondary" title={job.fileName}>{job.fileName}</p>
        </div>
        {!isActive && (
          <button
            type="button"
            onClick={() => backgroundUploads.dismiss(job.id)}
            aria-label={`Dismiss ${typeLabel} upload ${job.fileName}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-muted hover:bg-surface-inset hover:text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 5 10 10m0-10L5 15" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <p role="status" aria-atomic="true" className={isFailed ? "text-danger" : isComplete ? "text-success" : "text-content-secondary"}>
          <span className="sr-only">{typeLabel} upload {job.fileName}: </span>
          {statusLabel}
        </p>
        {!isPreparing && <span className="tabular-nums text-content-secondary">{percent}%</span>}
      </div>

      <div
        role="progressbar"
        aria-label={`${typeLabel} upload progress for ${job.fileName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isPreparing ? undefined : percent}
        aria-valuetext={isPreparing ? statusLabel : `${statusLabel} ${progressText}`}
        className="h-1.5 overflow-hidden rounded-full bg-surface-inset"
      >
        <div
          className={`h-full rounded-full transition-[width] ${isFailed ? "bg-danger" : isComplete ? "bg-success" : "bg-brand-600"} ${isPreparing ? "motion-safe:animate-pulse" : ""}`}
          style={{ width: isPreparing ? "25%" : `${percent}%` }}
        />
      </div>

      {!isPreparing && <p className="text-xs tabular-nums text-content-secondary">{progressText}</p>}
      {isComplete && <p className="text-xs leading-relaxed text-content-secondary">{completionSummary(job)}</p>}
      {isFailed && (
        <div className="flex flex-col items-start gap-2">
          <p className="break-words text-xs leading-relaxed text-danger">{job.error || "The upload could not finish. Retry to continue."}</p>
          <button
            type="button"
            onClick={() => { void backgroundUploads.retry(job.id); }}
            aria-label={`Retry ${typeLabel} upload ${job.fileName}`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-brand-600 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            Retry upload
          </button>
        </div>
      )}
    </li>
  );
}

export function UploadStatusWidget() {
  const jobs = useBackgroundUploads();
  const titleId = useId();
  if (jobs.length === 0) return null;

  const activeCount = jobs.filter((job) => job.status !== "completed" && job.status !== "failed").length;

  return (
    <section
      aria-labelledby={titleId}
      className="fixed bottom-12 right-4 z-[900] flex max-h-[50vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-popover"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-brand-50/60 px-4 py-3">
        <h2 id={titleId} className="text-sm font-semibold text-content-primary">Uploads</h2>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
          {activeCount > 0 ? `${activeCount} active` : `${jobs.length} upload${jobs.length === 1 ? "" : "s"}`}
        </span>
      </header>
      <ul className="min-h-0 overflow-y-auto overscroll-contain divide-y divide-border">
        {jobs.map((job) => <UploadStatusItem key={job.id} job={job} />)}
      </ul>
      <p className="shrink-0 border-t border-border px-4 py-2.5 text-xs leading-relaxed text-content-secondary">
        Uploads continue as you browse. Keep this tab open.
      </p>
    </section>
  );
}
