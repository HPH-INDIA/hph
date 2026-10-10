import { displayNumber, displayCpd } from "@/utils/displayNumber";
import { useRef, useState } from "react";
import { FieldArray, Form, Formik, type FormikHelpers } from "formik";
import * as Yup from "yup";

import { getFieldErrors, toFormikErrors } from "@/api/apiError";
import {
  useUpsertManualDailyRecordMutation,
} from "@/api/manualDailyRecordsApi";
import { useGetMyManualRecordsQuery } from "@/api/reportsApi";
import {
  MANUAL_DAILY_RECORD_MAX_HOURS,
  MANUAL_MEETING_TYPES,
  type ManualBulkUploadRowError,
  type ManualDailyRecord,
  type ManualDailyRecordUpsertPayload,
  type ManualMeetingType,
} from "@/api/types";
import { useListUsersQuery } from "@/api/usersApi";
import { Button } from "@/components/ui/Button";
import { ActionScreen } from "@/components/ui/ActionScreen";
import { inputClasses, SelectField, TextField } from "@/components/ui/FormField";
import { ManualRecordStatusIndicator } from "@/components/ui/ManualRecordStatusIndicator";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/features/ui/useToast";
import { API_BASE_URL } from "@/lib/env";
import { backgroundUploads } from "@/features/uploads/uploadService";
import { sha256 } from "@/lib/imports";

import { parseManualBulkFile, type ManualBulkFileResult } from "../manual/manualBulkFile";

import { ReportsReviewsSection } from "./ReportsReviewsSection";
import { ManagerManualReport } from "./ManagerManualReport";
import { formatManualMeetings, isReportDate, type ManualReportWindow } from "./manualReportSummary";

const MANUAL_RECORDS_PAGE_SIZE = 10;

async function downloadManualTemplate() {
  const response = await fetch(`${API_BASE_URL}/manual-daily-records/upload-template`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Could not download the template.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "manual_production_upload_template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

interface ManualEntryValues {
  date: string;
  pvpCount: string;
  foundationCount: string;
  techIssuesDowntimeHours: string;
  noInventoryIdleTimeHours: string;
  leaveHours: string;
  meetings: { type: ManualMeetingType | ""; hours: string }[];
}

const hourField = () =>
  Yup.number()
    .typeError("Enter a number")
    .min(0, "Cannot be negative")
    .max(MANUAL_DAILY_RECORD_MAX_HOURS, `Cannot exceed ${MANUAL_DAILY_RECORD_MAX_HOURS} hours`)
    .required("Required");

const manualValidationSchema = Yup.object({
  date: Yup.string().required("Date is required")
    .test("calendar-date", "Enter a valid date", (value) => !value || isReportDate(value)),
  pvpCount: Yup.number()
    .typeError("Enter a whole number")
    .integer("Enter a whole number")
    .min(0, "Cannot be negative")
    .required("PVP count is required"),
  foundationCount: Yup.number()
    .typeError("Enter a whole number")
    .integer("Enter a whole number")
    .min(0, "Cannot be negative")
    .required("Foundation count is required"),
  techIssuesDowntimeHours: hourField(),
  noInventoryIdleTimeHours: hourField(),
  leaveHours: hourField(),
  meetings: Yup.array().of(Yup.object({
    type: Yup.string().oneOf([...MANUAL_MEETING_TYPES], "Select a valid meeting type").required("Meeting type is required"),
    hours: Yup.number().typeError("Enter a number")
      .moreThan(0, "Hours must be greater than 0")
      .max(MANUAL_DAILY_RECORD_MAX_HOURS, `Cannot exceed ${MANUAL_DAILY_RECORD_MAX_HOURS} hours`)
      .test("two-decimals", "Use at most 2 decimal places", (value) => value === undefined || Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)
      .required("Meeting hours are required"),
  })).max(20, "You can add up to 20 meetings")
    .test("total-hours", `Total meeting hours cannot exceed ${MANUAL_DAILY_RECORD_MAX_HOURS}`, (meetings) =>
      (meetings ?? []).reduce((sum, meeting) => sum + (Number(meeting?.hours) || 0), 0) <= MANUAL_DAILY_RECORD_MAX_HOURS),
});

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function manualInitialValues(record?: ManualDailyRecord | null, date = todayDate()): ManualEntryValues {
  return {
    date: record?.date ?? date,
    pvpCount: String(record?.pvpCount ?? 0),
    foundationCount: String(record?.foundationCount ?? 0),
    techIssuesDowntimeHours: record?.techIssuesDowntimeHours ?? "0",
    noInventoryIdleTimeHours: record?.noInventoryIdleTimeHours ?? "0",
    leaveHours: record?.leaveHours ?? "0",
    meetings: record?.meetings?.length
      ? record.meetings.map((meeting) => ({ type: meeting.type ?? "", hours: meeting.hours }))
      : record && Number(record.meetingEngagementHours) > 0
        ? [{ type: record.meetingType ?? "", hours: record.meetingEngagementHours }]
        : [],
  };
}

interface ManualEntryFormProps {
  record?: ManualDailyRecord | null;
  initialDate?: string;
  onCancel: () => void;
  onSaved: () => void;
}

function ManualEntryForm({ record, initialDate, onCancel, onSaved }: ManualEntryFormProps) {
  const [upsertManualRecord] = useUpsertManualDailyRecordMutation();

  const handleSubmit = async (values: ManualEntryValues, helpers: FormikHelpers<ManualEntryValues>) => {
    const meetings = values.meetings.map((meeting) => ({
      type: meeting.type as ManualMeetingType,
      hours: Number(meeting.hours),
    }));
    const meetingHours = Math.round(meetings.reduce((total, meeting) => total + meeting.hours, 0) * 100) / 100;
    const payload: ManualDailyRecordUpsertPayload = {
      date: values.date,
      pvpCount: Number(values.pvpCount),
      foundationCount: Number(values.foundationCount),
      techIssuesDowntimeHours: Number(values.techIssuesDowntimeHours),
      noInventoryIdleTimeHours: Number(values.noInventoryIdleTimeHours),
      leaveHours: Number(values.leaveHours),
      meetingEngagementHours: meetingHours,
      meetingType: meetings.length === 1 ? meetings[0].type : null,
      ...(meetings.length > 1 ? { meetings } : {}),
    };
    const result = await upsertManualRecord(payload);

    if ("error" in result) {
      const fieldErrors = getFieldErrors(result.error);
      if (fieldErrors) helpers.setErrors(toFormikErrors(fieldErrors));
      helpers.setSubmitting(false);
      return;
    }

    helpers.resetForm({ values: manualInitialValues() });
    onSaved();
  };

  return (
    <section id="manual-entry-form">
      <Formik initialValues={manualInitialValues(record, initialDate)} validationSchema={manualValidationSchema} onSubmit={handleSubmit}>
        {({ errors, isSubmitting, submitCount, values }) => (
          <Form noValidate className="grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><TextField label="Date *" name="date" type="date" aria-required readOnly={Boolean(record)} /></div>
            <TextField label="PVP count *" name="pvpCount" type="number" min="0" step="1" aria-required />
            <TextField label="Foundation count *" name="foundationCount" type="number" min="0" step="1" aria-required />
            <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 sm:col-span-2">
              <span className="block text-xs font-medium text-brand-700">Total production</span>
              <span className="mt-1 block text-2xl font-semibold text-brand-900">
                {(Number(values.pvpCount) || 0) + (Number(values.foundationCount) || 0)}
              </span>
            </div>
            <TextField label="Technical issues downtime (hours) *" name="techIssuesDowntimeHours" type="number" min="0" max={MANUAL_DAILY_RECORD_MAX_HOURS} step="0.25" aria-required />
            <TextField label="No inventory / idle time (hours) *" name="noInventoryIdleTimeHours" type="number" min="0" max={MANUAL_DAILY_RECORD_MAX_HOURS} step="0.25" aria-required />
            <TextField label="Leave (hours) *" name="leaveHours" type="number" min="0" max={MANUAL_DAILY_RECORD_MAX_HOURS} step="0.25" aria-required />
            <FieldArray name="meetings">
              {({ push, remove }) => (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4 sm:col-span-2">
                  <h3 className="font-semibold text-content-primary">Meetings / engagements</h3>
                  <p className="text-xs text-content-muted">Add each meeting separately with its type and hours.</p>
                  {values.meetings.map((_, index) => (
                    <div key={index} className="grid items-end gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-2">
                      <h4 className="text-sm font-semibold text-content-secondary sm:col-span-2">Meeting {index + 1}</h4>
                      <SelectField label="Meeting type *" name={`meetings.${index}.type`} placeholder="Select meeting type" aria-required>
                        {MANUAL_MEETING_TYPES.map((meetingType) => (
                          <option key={meetingType} value={meetingType}>{meetingType}</option>
                        ))}
                      </SelectField>
                      <TextField label="Hours *" name={`meetings.${index}.hours`} type="number" min="0.01" max={MANUAL_DAILY_RECORD_MAX_HOURS} step="0.01" aria-required />
                      <Button type="button" variant="secondary" onClick={() => remove(index)}>Remove meeting</Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" disabled={values.meetings.length >= 20} onClick={() => push({ type: "", hours: "" })}>Add meeting</Button>
                  <p className="text-sm font-medium text-content-secondary">Total meeting hours: <strong className="text-content-primary">{displayNumber(values.meetings.reduce((total, meeting) => total + (Number(meeting.hours) || 0), 0))}</strong></p>
                  {submitCount > 0 && typeof errors.meetings === "string" && <p role="alert" className="text-xs text-danger">{errors.meetings}</p>}
                </div>
              )}
            </FieldArray>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:col-span-2">
              <Button type="submit" className="min-w-0 w-full" isLoading={isSubmitting}>{record ? "Save changes" : "Save daily record"}</Button>
              <Button type="button" variant="secondary" className="min-w-0 w-full" disabled={isSubmitting} onClick={onCancel}>Cancel</Button>
            </div>
          </Form>
        )}
      </Formik>
    </section>
  );
}

function ManualBulkUploadForm({ onStarted, onCancel }: { onStarted: () => void; onCancel: () => void }) {
  const { notifyError } = useToast();
  const { isLoading: isLoadingUsers, refetch: refetchUsers } = useListUsersQuery("all");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileChecksum, setFileChecksum] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ManualBulkFileResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rowErrors, setRowErrors] = useState<ManualBulkUploadRowError[]>([]);
  const submitted = useRef(false);
  const isLoading = isParsing || isLoadingUsers;

  const handleDownload = async () => {
    try {
      await downloadManualTemplate();
    } catch {
      notifyError("Could not download the manual upload template. Try again.");
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setFileChecksum(null);
    setParseResult(null);
    setRowErrors([]);
    setIsParsing(true);
    try {
      const [contents, freshUsers] = await Promise.all([file.arrayBuffer(), refetchUsers().unwrap()]);
      const [parsed, checksum] = await Promise.all([
        parseManualBulkFile(file, freshUsers, contents),
        sha256(contents),
      ]);
      setParseResult(parsed);
      setRowErrors(parsed.rowErrors);
      setFileChecksum(checksum);
    } catch {
      notifyError("Could not refresh the team list before reading the workbook. Try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = () => {
    if (submitted.current || isLoading || !canSubmit || !parseResult || !fileName || !fileChecksum) return;
    submitted.current = true;
    backgroundUploads.start({
      kind: "manual",
      fileName,
      fileChecksum,
      rows: parseResult.rows,
      minDate: parseResult.minDate,
      maxDate: parseResult.maxDate,
    });
    onStarted();
  };

  const canSubmit = Boolean(
    fileName && fileChecksum && parseResult && parseResult.fileErrors.length === 0 && rowErrors.length === 0 && parseResult.rows.length > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <h3 className="font-semibold text-content-primary">Start with the reference template</h3>
        <p className="mt-1 text-sm text-content-muted">
          Upload month-to-date or historical daily production. The first worksheet must match the Coder Production Details format.
        </p>
        <Button type="button" variant="secondary" className="mt-3" onClick={() => void handleDownload()}>
          Download template
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-content-secondary" htmlFor="manualBulkFile">Filled-in workbook (.xlsx)</label>
        <input
          id="manualBulkFile"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={inputClasses}
          disabled={isLoading}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void handleFile(selected);
          }}
        />
        <p className="text-xs text-content-muted">
          Rows are matched to active and historically relevant team members by Coder name; email is not required. Blank numbers become 0; Holiday must be 0.
        </p>
      </div>

      {isParsing && <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-content-secondary">Reading and validating {fileName}…</div>}

      {parseResult?.fileErrors.length ? (
        <ul className="rounded-lg border border-danger/30 bg-danger/5 p-4 pl-9 text-sm text-danger">
          {parseResult.fileErrors.map((error) => <li className="list-disc" key={error}>{error}</li>)}
        </ul>
      ) : null}

      {parseResult && parseResult.fileErrors.length === 0 && rowErrors.length === 0 && (
        <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-content-secondary">
          <strong>{parseResult.rows.length.toLocaleString()}</strong> rows across {parseResult.minDate} to {parseResult.maxDate} are ready to compare.
          {parseResult.skippedAfterLastWorkingDay > 0 && (
            <p className="mt-2 text-content-muted">
              Skipped {parseResult.skippedAfterLastWorkingDay.toLocaleString()} row(s) dated after an inactive
              user&apos;s last working day. Their records through the last working day remain included.
            </p>
          )}
        </div>
      )}

      {rowErrors.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4" role="alert">
          <h3 className="font-semibold text-danger">Nothing was imported. Fix these rows and upload again.</h3>
          <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-content-secondary">
            {rowErrors.map((error, index) => (
              <li key={`${error.row}-${index}`}>
                Row {error.row}{error.name ? ` (${error.name})` : ""}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-content-muted">
        Keep this tab open until processing finishes. Track progress in the upload widget; submitted imports can resume from saved progress after an interruption.
      </p>

      <div className="flex gap-2">
        <Button type="button" isLoading={isLoading} disabled={!canSubmit} onClick={handleUpload}>
          Compare and upload
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Close</Button>
      </div>
    </div>
  );
}

export function ReportsManualTab({ window }: { window: ManualReportWindow }) {
  const [page, setPage] = useState(1);
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ManualDailyRecord | null>(null);
  const [entryDate, setEntryDate] = useState(todayDate);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const { hasFeature, hasRoleType } = useAuth();
  const isManager = hasRoleType("manager");
  const isLead = hasRoleType("lead");
  const canWriteReports = hasFeature("reports", "write");
  const canSubmit = canWriteReports && (isLead || hasRoleType("employee"));
  const canBulkUpload = canWriteReports && isManager;
  const canViewTeam = hasFeature("reports") && (isManager || isLead);
  const showOwnRecords = !isManager && !isLead;
  const { data: pageData, isLoading, isError, refetch } = useGetMyManualRecordsQuery(
    { ...window, page, pageSize: MANUAL_RECORDS_PAGE_SIZE },
    { refetchOnMountOrArgChange: true, skip: !showOwnRecords },
  );
  const records = pageData?.items;

  const openNewEntry = (date = todayDate()) => {
    setEditingRecord(null);
    setEntryDate(date);
    setIsEntryFormOpen(true);
  };
  const openEditEntry = (record: ManualDailyRecord) => {
    setEditingRecord(record);
    setEntryDate(record.date);
    setIsEntryFormOpen(true);
  };

  return (
    <div className="source-tab flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-content-primary">{canViewTeam ? "Manual entries" : "My records"}</h2>
          <p className="text-sm text-content-muted">
            {isLead
              ? "Review your coders’ daily entries. Your own entries and edits are automatically approved."
              : isManager
                ? "View daily entries by lead and team."
                : "Submit your daily production for your lead to review."}
          </p>
        </div>
        {(canSubmit || canBulkUpload || canViewTeam) && (
          <div className="flex flex-wrap gap-2">
            {canBulkUpload && <Button type="button" variant="secondary" onClick={() => setIsBulkUploadOpen(true)}>Bulk upload</Button>}
            {canSubmit && (
              <Button
                type="button"
                aria-expanded={isEntryFormOpen}
                aria-controls="manual-entry-form"
                onClick={() => openNewEntry()}
              >
                Add daily record
              </Button>
            )}
          </div>
        )}
      </div>

      <ActionScreen
        open={canSubmit && isEntryFormOpen}
        onClose={() => setIsEntryFormOpen(false)}
        title={editingRecord ? "Edit daily production" : "Add daily production"}
        description={isLead ? "Your daily entry is automatically approved, including any edits." : "Submit your own production record for the selected date."}
        widthClass="max-w-3xl"
      >
        <ManualEntryForm
          key={editingRecord?.id ?? entryDate}
          record={editingRecord}
          initialDate={entryDate}
          onCancel={() => setIsEntryFormOpen(false)}
          onSaved={() => {
            setPage(1);
            setIsEntryFormOpen(false);
          }}
        />
      </ActionScreen>

      <ActionScreen
        open={canBulkUpload && isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        title="Bulk upload manual records"
        description="Import month-to-date or historical daily production. Existing identical user-day values are skipped."
        widthClass="max-w-2xl"
      >
        <ManualBulkUploadForm
          onCancel={() => setIsBulkUploadOpen(false)}
          onStarted={() => {
            setPage(1);
            setIsBulkUploadOpen(false);
          }}
        />
      </ActionScreen>

      {canViewTeam && isManager && <ManagerManualReport window={window} />}
      {canViewTeam && isLead && (
        <ReportsReviewsSection
          window={window}
          onEditOwnRecord={isLead && canSubmit ? openEditEntry : undefined}
        />
      )}

      {showOwnRecords && <section className="flex flex-col gap-3">
        {isLoading && <LoadingState label="Loading your records…" />}
        {isError && <ErrorState message="Couldn't load your records." onRetry={refetch} />}
        {!isLoading && !isError && records && records.length === 0 && <EmptyState title="No records yet" />}
        {!isLoading && !isError && records && records.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">PVP</th>
                    <th className="px-4 py-3 font-medium">Foundation</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Target CPD</th>
                    <th className="px-4 py-3 font-medium" title="8 hours minus downtime, idle, leave and non-Huddle meetings, multiplied by the stage target / 8">Adjusted CPD</th>
                    <th className="px-4 py-3 font-medium">Downtime</th>
                    <th className="px-4 py-3 font-medium">Idle</th>
                    <th className="px-4 py-3 font-medium">Leave</th>
                    <th className="px-4 py-3 font-medium">Meeting</th>
                    <th className="px-4 py-3 font-medium">Meeting Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 text-content-primary">{record.date}</td>
                      <td className="px-4 py-3 text-content-secondary">{record.pvpCount}</td>
                      <td className="px-4 py-3 text-content-secondary">{record.foundationCount}</td>
                      <td className="px-4 py-3 font-medium text-content-primary">{record.productionCount}</td>
                      <td className="px-4 py-3 text-content-secondary">
                        {record.dailyTarget == null ? "—" : displayNumber(record.dailyTarget)}
                        {record.foundationDailyTarget != null && <div className="mt-1 text-xs text-content-muted">
                          PVP {record.pvpDailyTarget ?? "—"} · Foundation {record.foundationDailyTarget}
                          {record.dailyTarget == null && <div>Awaiting a calculable chart mix</div>}
                        </div>}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{displayCpd(record.adjustedCpd)}</td>
                      <td className="px-4 py-3 text-content-secondary">{displayNumber(record.techIssuesDowntimeHours)}</td>
                      <td className="px-4 py-3 text-content-secondary">{displayNumber(record.noInventoryIdleTimeHours)}</td>
                      <td className="px-4 py-3 text-content-secondary">{displayNumber(record.leaveHours)}</td>
                      <td className="px-4 py-3 text-content-secondary">{displayNumber(record.meetingEngagementHours)}</td>
                      <td className="px-4 py-3 text-content-secondary">{formatManualMeetings([record])}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <ManualRecordStatusIndicator status={record.status} />
                          {record.status === "rejected" && record.rejectionReason && (
                            <span className="text-xs text-content-muted">{record.rejectionReason}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls page={pageData.page} pageSize={pageData.pageSize} total={pageData.total} totalPages={pageData.totalPages} onPageChange={setPage} />
          </div>
        )}
      </section>}
    </div>
  );
}
