import { useDeferredValue, useEffect, useState } from "react";

import {
  useDeleteKaironRecordMutation,
  useGetKaironCompletedCountsQuery,
  useGetKaironCompletedRecordsQuery,
  useGetKaironCompletedUsersQuery,
} from "@/api/reportsApi";
import type { KaironChartRecord, KaironCompletedUserSummary } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { inputClasses } from "@/components/ui/FormField";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { KaironUploadFormPage } from "@/pages/kairon/KaironUploadFormPage";

export function ReportsKaironTab() {
  const { hasFeature, hasRoleType } = useAuth();
  const canUpload = hasFeature("reports", "write") && hasRoleType("manager");
  const canDelete = canUpload;
  const isIndividualContributor = hasRoleType("lead") || hasRoleType("employee");
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<KaironCompletedUserSummary | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [analystSearch, setAnalystSearch] = useState("");
  const deferredAnalystSearch = useDeferredValue(analystSearch.trim());
  const [pendingDelete, setPendingDelete] = useState<KaironChartRecord | null>(null);
  const [deleteRecord, { isLoading: isDeleting }] = useDeleteKaironRecordMutation();
  const {
    data: pageData,
    isLoading,
    isError,
    refetch,
  } = useGetKaironCompletedCountsQuery({ page, pageSize: 25 });
  const completedCounts = pageData?.items;
  const {
    data: userPageData,
    isLoading: isLoadingUsers,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useGetKaironCompletedUsersQuery(
    {
      completedDate: selectedDate ?? "",
      analyst: deferredAnalystSearch || null,
      page: userPage,
      pageSize: 25,
    },
    { skip: selectedDate === null },
  );
  const {
    data: recordPageData,
    isLoading: isLoadingRecords,
    isError: isRecordsError,
    refetch: refetchRecords,
  } = useGetKaironCompletedRecordsQuery(
    {
      completedDate: selectedDate ?? "",
      userId: selectedUser?.userId ?? 0,
      page: recordPage,
      pageSize: 25,
    },
    { skip: selectedDate === null || selectedUser === null },
  );

  useEffect(() => {
    if (userPageData && userPage > Math.max(userPageData.totalPages, 1)) {
      setUserPage(Math.max(userPageData.totalPages, 1));
    }
  }, [userPage, userPageData]);

  useEffect(() => {
    if (recordPageData && recordPage > Math.max(recordPageData.totalPages, 1)) {
      setRecordPage(Math.max(recordPageData.totalPages, 1));
    }
  }, [recordPage, recordPageData]);

  const openDetails = (date: string) => {
    setSelectedDate(date);
    setUserPage(1);
    setSelectedUser(null);
    setRecordPage(1);
    setAnalystSearch("");
  };

  const closeDetails = () => {
    setSelectedDate(null);
    setSelectedUser(null);
    setPendingDelete(null);
  };

  const openUserRecords = (user: KaironCompletedUserSummary) => {
    setSelectedUser(user);
    setRecordPage(1);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const result = await deleteRecord(pendingDelete.id);
    if (!("error" in result)) setPendingDelete(null);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-content-primary">
            {isIndividualContributor ? "Your completed charts by day" : "Completed charts by day"}
          </h2>
          <p className="text-sm text-content-muted">
            {isIndividualContributor
              ? "Counts include only Kairon charts assigned to you. Select a date to review the records."
              : "Counts include the leads and coders assigned to your team. Select a date to review records by user."}
          </p>
        </div>
        {canUpload && <Button onClick={() => setShowUpload(true)}>Upload Kairon file</Button>}
      </div>

      <Drawer
        open={showUpload && canUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Kairon file"
        description="Upload a completed CSV batch for one reporting date."
        widthClass="max-w-2xl"
      >
        <KaironUploadFormPage
          embedded
          onCancel={() => setShowUpload(false)}
          onStarted={() => setShowUpload(false)}
        />
      </Drawer>

      <Drawer
        open={selectedDate !== null}
        onClose={closeDetails}
        title={`Completed charts — ${selectedDate ?? ""}`}
        description={selectedUser ? "Review this user's individual completed charts." : "Users are grouped with their completed-chart totals."}
        widthClass="max-w-6xl"
      >
        <div className="flex flex-col gap-4">
          {!selectedUser && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-full max-w-sm">
                  <label className="text-sm font-medium text-content-secondary" htmlFor="kaironAnalystSearch">
                    Search user
                  </label>
                  <input
                    id="kaironAnalystSearch"
                    type="search"
                    className={`${inputClasses} mt-1`}
                    placeholder="Type a user name…"
                    value={analystSearch}
                    onChange={(event) => {
                      setAnalystSearch(event.target.value);
                      setUserPage(1);
                    }}
                  />
                </div>
                {userPageData && (
                  <p className="text-sm text-content-muted">
                    {userPageData.total.toLocaleString()} {userPageData.total === 1 ? "user" : "users"}
                  </p>
                )}
              </div>

              {isLoadingUsers && <LoadingState label="Loading users…" />}
              {isUsersError && <ErrorState message="Couldn't load completed charts by user." onRetry={refetchUsers} />}
              {!isLoadingUsers && !isUsersError && userPageData?.items.length === 0 && (
                <EmptyState title="No matching users" />
              )}
              {!isLoadingUsers && !isUsersError && userPageData && userPageData.items.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 text-right font-medium">Charts completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {userPageData.items.map((user) => (
                        <tr
                          key={user.userId}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-600"
                          onClick={() => openUserRecords(user)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openUserRecords(user);
                            }
                          }}
                        >
                          <td className="px-4 py-3 font-medium text-content-primary">
                            {user.firstName} {user.lastName}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-content-primary">
                            {user.count.toLocaleString()}
                            <span className="ml-3 text-brand-700" aria-hidden="true">›</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PaginationControls
                    page={userPageData.page}
                    pageSize={userPageData.pageSize}
                    total={userPageData.total}
                    totalPages={userPageData.totalPages}
                    onPageChange={setUserPage}
                  />
                </div>
              )}
            </>
          )}

          {selectedUser && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={() => setSelectedUser(null)}>← Back to users</Button>
                  <div>
                    <h3 className="font-semibold text-content-primary">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </h3>
                    <p className="text-sm text-content-muted">
                      {recordPageData?.total ?? selectedUser.count} completed {(recordPageData?.total ?? selectedUser.count) === 1 ? "chart" : "charts"}
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingRecords && <LoadingState label="Loading completed chart records…" />}
              {isRecordsError && <ErrorState message="Couldn't load completed chart records." onRetry={refetchRecords} />}
              {!isLoadingRecords && !isRecordsError && recordPageData?.items.length === 0 && (
                <EmptyState title="No completed charts remain for this user" />
              )}
              {!isLoadingRecords && !isRecordsError && recordPageData && recordPageData.items.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Upload</th>
                      <th className="px-4 py-3 font-medium">Program</th>
                      <th className="px-4 py-3 font-medium">Level</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Last action</th>
                      <th className="px-4 py-3 font-medium">Practice</th>
                      {canDelete && <th className="px-4 py-3 text-right font-medium">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recordPageData.items.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 text-content-secondary">#{record.batchId}</td>
                        <td className="px-4 py-3 text-content-secondary">{record.program}</td>
                        <td className="px-4 py-3 text-content-secondary">{record.level}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{record.created}</td>
                        <td className="max-w-xs px-4 py-3 text-content-secondary">{record.lastAction ?? "—"}</td>
                        <td className="max-w-xs px-4 py-3 text-content-secondary">{record.practice ?? "—"}</td>
                        {canDelete && (
                          <td className="px-4 py-3 text-right">
                            <Button variant="danger" className="min-h-8 px-3 py-1 text-xs" onClick={() => setPendingDelete(record)}>
                              Delete
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={recordPageData.page}
                pageSize={recordPageData.pageSize}
                total={recordPageData.total}
                totalPages={recordPageData.totalPages}
                onPageChange={setRecordPage}
              />
            </div>
              )}
            </>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this Kairon record?"
        description={`${pendingDelete?.codingAnalyst ?? "This user"}'s completed chart on ${pendingDelete?.completed ?? selectedDate ?? "this date"} will be permanently removed. This can't be undone.`}
        confirmLabel="Delete record"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      {isLoading && <LoadingState label="Loading completed chart counts…" />}
      {isError && <ErrorState message="Couldn't load completed chart counts." onRetry={refetch} />}
      {!isLoading && !isError && completedCounts?.length === 0 && (
        <EmptyState title="No completed charts available" />
      )}
      {!isLoading && !isError && completedCounts && completedCounts.length > 0 && pageData && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Completed date</th>
                  <th className="px-4 py-3 text-right font-medium">Charts completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {completedCounts.map((item) => (
                  <tr
                    key={item.date}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-600"
                    onClick={() => openDetails(item.date)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetails(item.date);
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-content-primary">{item.date}</td>
                    <td className="px-4 py-3 text-right font-semibold text-content-primary">
                      <span>{item.count}</span>
                      <span className="ml-3 text-brand-700" aria-hidden="true">›</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={pageData.page}
            pageSize={pageData.pageSize}
            total={pageData.total}
            totalPages={pageData.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
