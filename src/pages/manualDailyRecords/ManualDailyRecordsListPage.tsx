import { displayNumber } from "@/utils/displayNumber";
import { useState } from "react";

import {
  useApproveManualDailyRecordMutation,
  useListManualDailyRecordsQuery,
  useRejectManualDailyRecordMutation,
} from "@/api/manualDailyRecordsApi";
import type { ManualDailyRecordStatus } from "@/api/types";
import { useUserNameLookup } from "@/api/useUserNameLookup";
import { Button } from "@/components/ui/Button";
import { ActionScreen } from "@/components/ui/ActionScreen";
import { inputClasses } from "@/components/ui/FormField";
import { ManualRecordStatusIndicator } from "@/components/ui/ManualRecordStatusIndicator";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { MultiUserSelect } from "@/components/ui/UserSelect";
import { useAuth } from "@/features/auth/useAuth";
import { formatManualMeetings } from "@/pages/reports/manualReportSummary";

const STATUS_TABS: { key: ManualDailyRecordStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function ManualDailyRecordsListPage() {
  const { user, hasFeature, hasRoleType } = useAuth();
  const canReview = hasFeature("reports", "write") && hasRoleType("lead");

  const [statusTab, setStatusTab] = useState<ManualDailyRecordStatus | "all">("pending");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // A single selection is the "single user" filter, several is "group of
  // users" — one control covers both (§8). Exclude is kept separate since
  // it's the opposite sense ("all users except").
  const [includeUserIds, setIncludeUserIds] = useState<number[]>([]);
  const [excludeUserIds, setExcludeUserIds] = useState<number[]>([]);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const {
    data: records,
    isLoading,
    isError,
    refetch,
  } = useListManualDailyRecordsQuery({
    status: statusTab === "all" ? null : statusTab,
    fromDate: fromDate || null,
    toDate: toDate || null,
    userIds: includeUserIds.length > 0 ? includeUserIds : null,
    excludeUserIds: excludeUserIds.length > 0 ? excludeUserIds : null,
  });

  const getUserName = useUserNameLookup();
  const [approve, { isLoading: isApproving }] = useApproveManualDailyRecordMutation();
  const [reject, { isLoading: isRejecting }] = useRejectManualDailyRecordMutation();

  const handleReject = async (id: number) => {
    const result = await reject({ id, reason: reason || null });
    if (!("error" in result)) {
      setRejectingId(null);
      setReason("");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-content-primary">Daily records</h1>
        <p className="text-sm text-content-muted">
          {canReview
            ? "Review and decide on your coders’ submitted daily records."
            : "Submitted daily records available to you."}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium ${
              statusTab === tab.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-content-muted hover:text-content-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-secondary">From date</label>
          <input
            type="date"
            className={inputClasses}
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-secondary">To date</label>
          <input
            type="date"
            className={inputClasses}
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <MultiUserSelect value={includeUserIds} onChange={setIncludeUserIds} label="User(s)" size={3} />
        <MultiUserSelect value={excludeUserIds} onChange={setExcludeUserIds} label="Exclude user(s)" size={3} />
      </div>

      {isLoading && <LoadingState label="Loading records…" />}
      {isError && <ErrorState message="Couldn't load records." onRetry={refetch} />}
      {!isLoading && !isError && records && records.length === 0 && (
        <EmptyState title="No records match these filters" />
      )}

      {!isLoading && !isError && records && records.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">PVP</th>
                <th className="px-4 py-3 font-medium">Foundation</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Downtime</th>
                <th className="px-4 py-3 font-medium">Idle</th>
                <th className="px-4 py-3 font-medium">Leave</th>
                <th className="px-4 py-3 font-medium">Meeting</th>
                    <th className="px-4 py-3 font-medium">Meetings</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canReview && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 text-content-primary">{getUserName(record.userId)}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.date}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.pvpCount}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.foundationCount}</td>
                  <td className="px-4 py-3 font-medium text-content-primary">{record.productionCount}</td>
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
                  {canReview && (
                    <td className="px-4 py-3 text-right">
                      {record.status === "pending" && record.userId !== user?.id && (
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" isLoading={isApproving} onClick={() => void approve(record.id)}>
                            Approve
                          </Button>
                          <Button variant="danger" onClick={() => setRejectingId(record.id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingId !== null && (
        <ActionScreen
          open
          onClose={() => {
            setRejectingId(null);
            setReason("");
          }}
          title="Reject this record?"
          description="Let the coder know what to fix (optional)."
          widthClass="max-w-md"
        >
            <textarea
              className={`${inputClasses} w-full`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (optional)"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={isRejecting}
                onClick={() => {
                  setRejectingId(null);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" isLoading={isRejecting} onClick={() => void handleReject(rejectingId)}>
                Reject
              </Button>
            </div>
        </ActionScreen>
      )}
    </div>
  );
}
