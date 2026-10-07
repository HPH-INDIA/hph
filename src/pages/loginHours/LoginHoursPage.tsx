import { parseAttendance } from "./parseAttendance";
import { useDispatch } from "react-redux";
import { apiSlice } from "@/api/apiSlice";
import { Fragment, useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import {
  useListLoginHourRecordsQuery,
  useListLoginHoursUploadsQuery,
  useUploadLoginHoursChunkMutation,
} from "@/api/loginHoursApi";
import type { LoginHoursUploadBatch } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { inputClasses } from "@/components/ui/FormField";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

interface LoginHoursFilters {
  userIds: number[];
  projectId: number | null;
  leadId: number | null;
  cohortId: number | null;
  fromDate: string;
  toDate: string;
}

function formatMinutes(minutes: number) {
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" strokeLinecap="round" />
    </svg>
  );
}

export function LoginHoursPage() {
  const { user, canWriteFeature } = useAuth();
  const isManager = user?.role.roleType === "manager";
  const isAdmin = ["admin", "super_admin"].includes(user?.role.roleType ?? "");
  const canSelectUser = Boolean(user);
  const canFilter = Boolean(user);
  const canUpload = canWriteFeature("login_hours");
  const scopeDescription = isAdmin
    ? "View day-wise attendance across all projects."
    : isManager
    ? "View day-wise attendance for your project."
    : user?.role.roleType === "lead"
      ? "View your login hours and the login hours of your direct team members."
      : "View day-wise attendance for your team.";
  const [file, setFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<LoginHoursUploadBatch | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<LoginHoursFilters>({
    userIds: [],
    projectId: null,
    leadId: null,
    cohortId: null,
    fromDate: "",
    toDate: "",
  });
  const [upload] = useUploadLoginHoursChunkMutation();
  const dispatch = useDispatch();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pendingUpload, setPendingUpload] = useState<{ uploadId: string; sourceFilename: string; sourceFormat: string; headers: string[]; rows: unknown[][]; offset: number; batchId?: number } | null>(null);
  const records = useListLoginHourRecordsQuery({
    page,
    pageSize: 25,
    from: fromDate || null,
    to: toDate || null,
    userIds: selectedUserIds,
    projectId: selectedProjectId,
    leadId: selectedLeadId,
    cohortId: selectedCohortId,
  });
  const uploads = useListLoginHoursUploadsQuery(undefined, { skip: !canUpload });
  const filterOptions = records.data?.filterOptions;

  const activeFilterCount = canFilter
    ? Number(selectedUserIds.length > 0) + Number(selectedProjectId !== null) +
      Number(isManager && selectedLeadId !== null) +
      Number(isManager && selectedCohortId !== null) +
      Number(Boolean(fromDate)) +
      Number(Boolean(toDate))
    : 0;

  const openFilters = () => {
    setDraftFilters({
      userIds: selectedUserIds,
      projectId: selectedProjectId,
      leadId: isManager ? selectedLeadId : null,
      cohortId: isManager ? selectedCohortId : null,
      fromDate,
      toDate,
    });
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setSelectedUserIds(draftFilters.userIds);
    setSelectedProjectId(draftFilters.projectId);
    setSelectedLeadId(isManager ? draftFilters.leadId : null);
    setSelectedCohortId(isManager ? draftFilters.cohortId : null);
    setFromDate(draftFilters.fromDate);
    setToDate(draftFilters.toDate);
    setPage(1);
    setFiltersOpen(false);
  };

  const resetDraftFilters = () => {
    setDraftFilters({ userIds: [], projectId: null, leadId: null, cohortId: null, fromDate: "", toDate: "" });
    setUserSearch("");
  };

  const handleUpload = async () => {
    if ((!file && !pendingUpload) || uploading) return;
    setUploading(true);
    setUploadError("");
    setLastResult(null);
    let job = pendingUpload;
    try {
      if (!job) {
        setProgress("Reading attendance workbook…");
        const parsed = await parseAttendance(file!);
        job = { ...parsed, sourceFilename: file!.name, uploadId: crypto.randomUUID(), offset: 0 };
        setPendingUpload(job);
      }
      while (job.offset < job.rows.length) {
        setProgress(`Saving day records: ${job.offset} of ${job.rows.length} processed`);
        const result = await upload({ sourceFilename: job.sourceFilename, sourceFormat: job.sourceFormat, uploadId: job.uploadId,
          batchId: job.batchId, chunkIndex: job.offset / 200, headers: job.headers, rows: job.rows.slice(job.offset, job.offset + 200) }).unwrap();
        job = { ...job, batchId: result.id, offset: Math.min(job.offset + 200, job.rows.length) };
        setPendingUpload(job);
        if (job.offset === job.rows.length) setLastResult(result);
      }
      setProgress(`Completed: ${job.rows.length} day records processed`);
      setPendingUpload(null);
      setFile(null);
      setPage(1);
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setUploading(false);
      dispatch(apiSlice.util.invalidateTags(["LoginHours", "CodingDashboard"]));
    }
  };

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-content-primary">Login hours</h1>
          <p className="text-sm text-content-muted">{scopeDescription}</p>
        </div>
        {canUpload && <Button onClick={() => setShowUpload(true)}>Upload attendance workbook</Button>}
      </div>

      <Drawer
        open={canUpload && showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload attendance workbook"
        description="Upload either supported attendance format; only matched CODING users are saved."
        widthClass="max-w-xl"
      >
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-80 flex-1 flex-col gap-1.5 text-sm font-medium text-content-secondary">
              Excel workbook
              <input
                className={inputClasses}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={uploading}
                onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPendingUpload(null); setProgress(""); setUploadError(""); setLastResult(null); }}
              />
            </label>
            <Button disabled={!file && !pendingUpload} isLoading={uploading} onClick={() => void handleUpload()}>
              {pendingUpload && !uploading ? "Retry remaining records" : "Upload login hours"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-content-muted">
            Total Inside is stored as the primary login-hours measure. First in, last out, outside time, total span, status, and anomalies are retained for review.
          </p>

          {progress && <p role="status" className="mt-3 text-sm text-content-secondary">{progress}</p>}
          {uploadError && <p role="alert" className="mt-3 text-sm text-danger">{uploadError} Saved chunks are retained. Retry to continue.</p>}
          {lastResult && (
            <div className="mt-4 rounded-md border border-border bg-surface-muted p-4 text-sm">
              <p className="font-medium text-content-primary">Imported {lastResult.matchedCount} matched row(s)</p>
              <p className="text-content-muted">
                Detected format: {lastResult.sourceFormat}. Dropped {lastResult.unmatchedCount} unmatched row(s).
              </p>
              {(lastResult.unmatchedNames?.length ?? 0) > 0 && (
                <p className="mt-2 text-content-secondary">Unmatched names: {lastResult.unmatchedNames?.join(", ")}</p>
              )}
            </div>
          )}
      </Drawer>

      <Drawer
        open={canFilter && filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Login hours filters"
        description="Select users and a date range to review daily attendance."
        widthClass="max-w-md"
      >
        <div className="flex min-h-full flex-col gap-5">
          {isAdmin && <LoginHoursFilter label="Project">
            <select className={inputClasses} value={draftFilters.projectId ?? "ALL"} onChange={(event) => setDraftFilters((current) => ({ ...current, projectId: event.target.value === "ALL" ? null : Number(event.target.value), userIds: [] }))}>
              <option value="ALL">All projects</option>
              {filterOptions?.projects?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </LoginHoursFilter>}
          {canSelectUser && (
            <div className="text-sm">
              <p className="mb-1 text-xs font-medium text-content-secondary">Users</p>
              <details className="rounded-md border border-border bg-surface p-3">
                <summary className="cursor-pointer">{draftFilters.userIds.length ? `${draftFilters.userIds.length} users selected` : "All users"}</summary>
                <input aria-label="Search users" className={`${inputClasses} mt-3`} placeholder="Search by name" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
                <button type="button" className="my-2 text-brand-700 underline" onClick={() => setDraftFilters((current) => ({ ...current, userIds: [] }))}>All users / clear selection</button>
                <div className="max-h-60 overflow-y-auto">
                  {(filterOptions?.users ?? []).filter((option) => (!draftFilters.projectId || option.projectId === draftFilters.projectId) && option.label.toLowerCase().includes(userSearch.toLowerCase())).map((option) => (
                    <label key={option.id} className="flex items-center gap-2 py-2">
                      <input type="checkbox" checked={draftFilters.userIds.includes(option.id)} onChange={(event) => setDraftFilters((current) => ({ ...current, userIds: event.target.checked ? [...current.userIds, option.id] : current.userIds.filter((id) => id !== option.id) }))} />{option.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          )}

          {isManager && (
            <>
              <LoginHoursFilter label="Lead">
                <select
                  className={inputClasses}
                  value={draftFilters.leadId ?? "ALL"}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, leadId: event.target.value === "ALL" ? null : Number(event.target.value) }))}
                >
                  <option value="ALL">All leads</option>
                  {(filterOptions?.leads ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </LoginHoursFilter>
              <LoginHoursFilter label="Cohort">
                <select
                  className={inputClasses}
                  value={draftFilters.cohortId ?? "ALL"}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, cohortId: event.target.value === "ALL" ? null : Number(event.target.value) }))}
                >
                  <option value="ALL">All cohorts</option>
                  {(filterOptions?.cohorts ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </LoginHoursFilter>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <LoginHoursFilter label="From">
              <input
                className={inputClasses}
                type="date"
                max={draftFilters.toDate || undefined}
                value={draftFilters.fromDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </LoginHoursFilter>
            <LoginHoursFilter label="To">
              <input
                className={inputClasses}
                type="date"
                min={draftFilters.fromDate || undefined}
                value={draftFilters.toDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
              />
            </LoginHoursFilter>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="ghost" onClick={resetDraftFilters}>Reset all</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button>
              <Button type="button" disabled={Boolean(draftFilters.fromDate && draftFilters.toDate && draftFilters.fromDate > draftFilters.toDate)} onClick={applyFilters}>Apply filters</Button>
            </div>
          </div>
        </div>
      </Drawer>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><ClockIcon /></span>
            <div>
              <p className="text-xs font-medium text-content-muted">Average inside hours</p>
              <p className="text-xl font-semibold tracking-tight text-content-primary">
                {records.data?.averageInsideMinutes == null ? "—" : formatMinutes(records.data.averageInsideMinutes)}
              </p>
              <p className="text-[11px] text-content-muted">
                {records.data ? `${records.data.total} matching ${records.data.total === 1 ? "record" : "records"}` : "Current selection"}
              </p>
            </div>
          </div>
          {canFilter && (
            <Button type="button" variant="secondary" onClick={openFilters}>
              <span className="flex items-center gap-2"><FilterIcon /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
            </Button>
          )}
        </div>

        {records.isLoading ? (
          <LoadingState label="Loading login hours…" />
        ) : records.error ? (
          <ErrorState message={getErrorMessage(records.error)} onRetry={records.refetch} />
        ) : !records.data || records.data.items.length === 0 ? (
          <EmptyState title="No login-hour records found" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">User / project</th>
                    <th className="px-4 py-3 font-medium">First in</th>
                    <th className="px-4 py-3 font-medium">Last out</th>
                    <th className="px-4 py-3 font-medium">Inside</th>
                    <th className="px-4 py-3 font-medium">Outside</th>
                    <th className="px-4 py-3 font-medium">Total span</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.data.items.map((record, index) => (
                    <Fragment key={record.id}>
                    {(index === 0 || records.data.items[index - 1].date !== record.date) && <tr className="bg-brand-50"><th colSpan={8} className="px-4 py-3 text-left font-semibold text-brand-800">{new Date(`${record.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</th></tr>}
                    <tr>
                      <td className="px-4 py-3 text-content-secondary">{record.date}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-content-primary">{record.userName}</div>
                        {record.projectName && <div className="text-xs text-content-muted">{record.projectName}</div>}
                        {record.employeeNameRaw !== record.userName && <div className="text-xs text-content-muted">Source: {record.employeeNameRaw}</div>}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{record.firstIn?.slice(0, 5) ?? "—"}</td>
                      <td className="px-4 py-3 text-content-secondary">{record.lastOut?.slice(0, 5) ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-content-primary">{formatMinutes(record.totalInsideMinutes)}</td>
                      <td className="px-4 py-3 text-content-secondary">{formatMinutes(record.totalOutsideMinutes)}</td>
                      <td className="px-4 py-3 text-content-secondary">{formatMinutes(record.totalSpanMinutes)}</td>
                      <td className="px-4 py-3 text-content-secondary">{record.status ?? "—"}{record.anomalies ? ` · ${record.anomalies} anomal${record.anomalies === 1 ? "y" : "ies"}` : ""}</td>
                    </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={records.data.page}
              pageSize={records.data.pageSize}
              total={records.data.total}
              totalPages={records.data.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>

      {canUpload && !uploads.isLoading && !uploads.error && (uploads.data?.length ?? 0) > 0 && (
        <p className="text-xs text-content-muted">{uploads.data?.length} upload batch(es) retained in the audit history.</p>
      )}
    </div>
  );
}

function LoginHoursFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-content-secondary">
      {label}
      {children}
    </label>
  );
}
