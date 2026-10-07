import { useState, type ReactNode } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useApproveManualDailyRecordMutation, useRejectManualDailyRecordMutation } from "@/api/manualDailyRecordsApi";
import { useBulkApproveManualRecordsMutation, useBulkRejectManualRecordsMutation, useGetManualTeamRangeQuery } from "@/api/reportsApi";
import type { ManualDailyRecord, ManualTeamDayEntry, ManualTeamUser } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { inputClasses } from "@/components/ui/FormField";
import { ManualRecordStatusIndicator } from "@/components/ui/ManualRecordStatusIndicator";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/features/ui/useToast";

import { PeriodRecordsTable, ProductionCards } from "./ManagerManualReport";
import { formatManualMeetings, type ManualReportWindow } from "./manualReportSummary";

interface ReportsReviewsSectionProps {
  onEditOwnRecord?: (record: ManualDailyRecord) => void;
  window: ManualReportWindow;
}

interface RejectDraft {
  date: string;
  ids: number[];
  reason: string;
  bulk: boolean;
}

function userName(user: ManualTeamUser) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function periodLabel(window: ManualReportWindow) {
  const format = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
  return window.fromDate === window.toDate ? format(window.fromDate) : `${format(window.fromDate)} – ${format(window.toDate)}`;
}

function TeamRecordsTable({
  entries,
  caption,
  renderActions,
}: {
  entries: ManualTeamDayEntry[];
  caption: string;
  renderActions?: (entry: ManualTeamDayEntry) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">PVP</th>
            <th className="px-3 py-2 font-medium">Foundation</th>
            <th className="px-3 py-2 font-medium">Total</th>
            <th className="px-3 py-2 font-medium">Downtime (hours)</th>
            <th className="px-3 py-2 font-medium">Idle (hours)</th>
            <th className="px-3 py-2 font-medium">Leave (hours)</th>
            <th className="px-3 py-2 font-medium">Meeting (hours)</th>
            <th className="px-3 py-2 font-medium">Meetings</th>
            <th className="px-3 py-2 font-medium">Status</th>
            {renderActions && <th className="px-3 py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const { user, record } = entry;
            return (
              <tr key={user.id}>
                <th scope="row" className="px-3 py-3 font-medium text-content-primary">
                  <span className="block whitespace-nowrap">{userName(user)}</span>
                </th>
                <td className="px-3 py-3 text-content-secondary">{record?.pvpCount ?? "—"}</td>
                <td className="px-3 py-3 text-content-secondary">{record?.foundationCount ?? "—"}</td>
                <td className="px-3 py-3 font-medium text-content-primary">{record?.productionCount ?? "—"}</td>
                <td className="px-3 py-3 text-content-secondary">{record?.techIssuesDowntimeHours ?? "—"}</td>
                <td className="px-3 py-3 text-content-secondary">{record?.noInventoryIdleTimeHours ?? "—"}</td>
                <td className="px-3 py-3 text-content-secondary">{record?.leaveHours ?? "—"}</td>
                <td className="px-3 py-3 text-content-secondary">{record?.meetingEngagementHours ?? "—"}</td>
                <td className="px-3 py-3 text-content-secondary">{record ? formatManualMeetings([record]) : "—"}</td>
                <td className="px-3 py-3">
                  {record ? (
                    <div className="flex flex-col gap-1">
                      <ManualRecordStatusIndicator status={record.status} />
                      {record.status === "rejected" && record.rejectionReason && (
                        <span className="text-xs text-content-muted">{record.rejectionReason}</span>
                      )}
                    </div>
                  ) : (
                    <span className="whitespace-nowrap text-content-muted">Not submitted</span>
                  )}
                </td>
                {renderActions && <td className="px-3 py-3">{renderActions(entry)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsReviewsSection({ onEditOwnRecord, window }: ReportsReviewsSectionProps) {
  const [rejectDraft, setRejectDraft] = useState<RejectDraft | null>(null);
  const { user, hasRoleType, hasFeature } = useAuth();
  const canReview = hasRoleType("lead") && hasFeature("reports", "write");
  const { notifyInfo } = useToast();
  const { currentData, isFetching, isError, error, refetch } = useGetManualTeamRangeQuery(
    { ...window, viewerId: user?.id ?? 0, viewerRole: user?.role.roleType ?? null },
    { refetchOnMountOrArgChange: true, skip: !user },
  );
  const report = currentData?.fromDate === window.fromDate && currentData.toDate === window.toDate ? currentData : undefined;
  const team = report?.teams.find((entry) => entry.lead?.id === user?.id);
  const dayView = window.fromDate === window.toDate;
  const date = window.fromDate;
  const period = periodLabel(window);

  const [approveOne, { isLoading: isApprovingOne }] = useApproveManualDailyRecordMutation();
  const [rejectOne, { isLoading: isRejectingOne }] = useRejectManualDailyRecordMutation();
  const [bulkApprove, { isLoading: isBulkApproving }] = useBulkApproveManualRecordsMutation();
  const [bulkReject, { isLoading: isBulkRejecting }] = useBulkRejectManualRecordsMutation();
  const isMutating = isApprovingOne || isRejectingOne || isBulkApproving || isBulkRejecting;
  const actionsDisabled = isMutating || isFetching || isError || !dayView;
  const pendingIds = new Set(
    canReview && dayView && team
      ? team.coders.flatMap(({ user: coder, records }) => records
        .filter((record) => coder.id !== user?.id && record.date === date && record.status === "pending")
        .map((record) => record.id))
      : [],
  );

  const approveRecord = async (record: ManualDailyRecord) => {
    if (actionsDisabled || !pendingIds.has(record.id)) return;
    await approveOne(record.id);
  };
  const approveAll = async (ids: number[]) => {
    if (actionsDisabled || ids.length === 0 || ids.some((id) => !pendingIds.has(id))) return;
    const result = await bulkApprove(ids);
    if (!("error" in result) && result.data.skipped.length > 0) {
      notifyInfo(`${result.data.approved.length} approved, ${result.data.skipped.length} skipped (already decided).`);
    }
  };
  const openReject = (ids: number[], bulk: boolean) => {
    if (actionsDisabled || ids.length === 0 || ids.some((id) => !pendingIds.has(id))) return;
    setRejectDraft({ date, ids, reason: "", bulk });
  };
  const submitReject = async () => {
    if (actionsDisabled || !rejectDraft || rejectDraft.date !== date) return;
    const ids = rejectDraft.ids.filter((id) => pendingIds.has(id));
    if (ids.length === 0) {
      notifyInfo("These records are no longer pending. Refresh the team records to see their latest status.");
      setRejectDraft(null);
      return;
    }
    const reason = rejectDraft.reason.trim() || null;
    if (rejectDraft.bulk) {
      const result = await bulkReject(ids.map((id) => ({ id, reason })));
      if (!("error" in result)) {
        const skipped = result.data.skipped.length + rejectDraft.ids.length - ids.length;
        if (skipped > 0) notifyInfo(`${result.data.rejected.length} rejected, ${skipped} skipped (already decided).`);
        setRejectDraft(null);
      }
    } else {
      const result = await rejectOne({ id: ids[0], reason });
      if (!("error" in result)) setRejectDraft(null);
    }
  };

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4">

      {isError && <ErrorState message={`Couldn't load team records. ${getErrorMessage(error)}`} onRetry={refetch} />}
      {!isError && !report && <LoadingState label="Loading team records…" />}
      {!isError && report && !team && <EmptyState title="No team records for this period" />}
      {!isError && report && team && (
        <>
          {isFetching && <p role="status" className="text-sm text-content-muted">Updating team records…</p>}
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
            <div>
              <h3 className="font-semibold text-content-primary">My team · {period}</h3>
              <p className="text-sm text-content-muted">{team.coders.filter((coder) => coder.records.length > 0).length} of {team.coders.length} coders submitted {dayView ? "for this day" : "in this period"}.</p>
            </div>
            <ProductionCards teams={[team]} label="My team production" compact />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-content-secondary">My {dayView ? "daily record" : "records"}</h4>
            {dayView ? (
              <TeamRecordsTable
                entries={[{ user: team.lead!, record: team.leadRecords[0] ?? null }]}
                caption={`My daily record for ${date}`}
                renderActions={canReview && onEditOwnRecord && team.leadRecords[0] ? ({ record }) => (
                  record && <Button type="button" variant="secondary" disabled={actionsDisabled} onClick={() => onEditOwnRecord(record)}>Edit</Button>
                ) : undefined}
              />
            ) : (
              <PeriodRecordsTable entries={[{ user: team.lead!, records: team.leadRecords }]} caption={`My records for ${period}`} multipleDays />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-content-secondary">Coder {dayView ? "daily records" : "records"}</h4>
              {canReview && dayView && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" disabled={actionsDisabled || pendingIds.size === 0} isLoading={isBulkApproving} onClick={() => void approveAll([...pendingIds])}>Approve all ({pendingIds.size})</Button>
                  <Button type="button" variant="danger" disabled={actionsDisabled || pendingIds.size === 0} onClick={() => openReject([...pendingIds], true)}>Reject all ({pendingIds.size})</Button>
                </div>
              )}
            </div>
            {team.coders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-content-muted">No coders assigned to your team for this period.</p>
            ) : dayView ? (
              <TeamRecordsTable
                entries={team.coders.map(({ user: coder, records }) => ({ user: coder, record: records[0] ?? null }))}
                caption={`Coder records for ${date}`}
                renderActions={canReview ? ({ user: coder, record }) => (
                  record && pendingIds.has(record.id) ? (
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" disabled={actionsDisabled} aria-label={`Approve ${userName(coder)}'s record`} onClick={() => void approveRecord(record)}>Approve</Button>
                      <Button type="button" variant="danger" disabled={actionsDisabled} aria-label={`Reject ${userName(coder)}'s record`} onClick={() => openReject([record.id], false)}>Reject</Button>
                    </div>
                  ) : null
                ) : undefined}
              />
            ) : (
              <PeriodRecordsTable entries={team.coders} caption={`Coder records for ${period}`} multipleDays />
            )}
            {!dayView && <p className="text-xs text-content-muted">Select a single day to approve or reject individual records.</p>}
          </div>
        </>
      )}
      {rejectDraft && rejectDraft.date === date && (
        <Drawer open onClose={() => { if (!isMutating) setRejectDraft(null); }}
          title={rejectDraft.bulk ? `Reject ${rejectDraft.ids.length} pending records?` : "Reject this record?"}
          description={rejectDraft.bulk ? `The same optional reason will be added to each selected record for ${date}.` : `Let the coder know what to fix for ${date}.`}
          widthClass="max-w-md">
          <label htmlFor="manual-team-rejection-reason" className="mb-2 block text-sm font-medium text-content-secondary">Reason (optional)</label>
          <textarea id="manual-team-rejection-reason" className={`${inputClasses} w-full`} rows={4}
            value={rejectDraft.reason} disabled={isMutating} onChange={(event) => setRejectDraft({ ...rejectDraft, reason: event.target.value })} />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={isMutating} onClick={() => setRejectDraft(null)}>Cancel</Button>
            <Button type="button" variant="danger" disabled={actionsDisabled} isLoading={isRejectingOne || isBulkRejecting} onClick={() => void submitReject()}>{rejectDraft.bulk ? "Reject all" : "Reject"}</Button>
          </div>
        </Drawer>
      )}
    </section>
  );
}
