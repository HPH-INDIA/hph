import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  useListKaironAnalystReviewsQuery,
  useListKaironUploadBatchesQuery,
  useResolveKaironAnalystReviewMutation,
} from "@/api/kaironApi";
import { useUserNameLookup } from "@/api/useUserNameLookup";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { UserSelect } from "@/components/ui/UserSelect";
import { useAuth } from "@/features/auth/useAuth";

type Tab = "history" | "reviews";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium ${
        active ? "border-b-2 border-brand-600 text-brand-700" : "text-content-muted hover:text-content-secondary"
      }`}
    >
      {children}
    </button>
  );
}

export function KaironUploadsListPage() {
  const { hasFeature, hasRoleType } = useAuth();
  const canManage = hasFeature("reports", "write") && hasRoleType("manager");
  const [tab, setTab] = useState<Tab>("history");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-metric="kairon" className="metric-label text-lg font-semibold text-content-primary">Kairon uploads</h1>
          <p className="text-sm text-content-muted">
            Every batch ever uploaded, and any coding-analyst names waiting on manual review.
          </p>
        </div>
        {canManage && (
          <Link to="/kairon/uploads/new">
            <Button>Upload batch</Button>
          </Link>
        )}
      </div>

      {canManage && (
        <div className="flex gap-1 border-b border-border">
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            Upload history
          </TabButton>
          <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")}>
            Analyst reviews
          </TabButton>
        </div>
      )}

      {tab === "history" && <UploadHistoryTable />}
      {tab === "reviews" && canManage && <AnalystReviewsTable />}
    </div>
  );
}

function UploadHistoryTable() {
  const { data: batches, isLoading, isError, refetch } = useListKaironUploadBatchesQuery();
  const getUserName = useUserNameLookup();

  if (isLoading) return <LoadingState label="Loading upload history…" />;
  if (isError) return <ErrorState message="Couldn't load upload history." onRetry={refetch} />;
  if (!batches || batches.length === 0) return <EmptyState title="No batches uploaded yet" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-4 py-3 font-medium">As of</th>
            <th className="px-4 py-3 font-medium">Uploaded by</th>
            <th className="px-4 py-3 font-medium">Uploaded at</th>
            <th className="px-4 py-3 font-medium">Rows</th>
            <th className="px-4 py-3 font-medium">Matched</th>
            <th className="px-4 py-3 font-medium">Unmatched</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td className="px-4 py-3 text-content-primary">{batch.asOfDate}</td>
              <td className="px-4 py-3 text-content-secondary">{getUserName(batch.uploadedById)}</td>
              <td className="px-4 py-3 text-content-secondary">{new Date(batch.uploadedAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-content-secondary">{batch.rowCount}</td>
              <td className="px-4 py-3 text-content-secondary">{batch.matchedCount}</td>
              <td className="px-4 py-3 text-content-secondary">{batch.unmatchedCount}</td>
              <td className="px-4 py-3">
                {batch.supersededAt ? (
                  <Badge tone="neutral">Superseded</Badge>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalystReviewsTable() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved">("pending");
  const { data: reviews, isLoading, isError, refetch } = useListKaironAnalystReviewsQuery(statusFilter);
  const [resolveReview, { isLoading: isResolving }] = useResolveKaironAnalystReviewMutation();
  const [pendingResolveId, setPendingResolveId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleResolve = async (reviewId: number) => {
    if (!selectedUserId) return;
    const result = await resolveReview({ reviewId, userId: selectedUserId });
    if (!("error" in result)) {
      setPendingResolveId(null);
      setSelectedUserId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-border">
        <TabButton active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>
          Pending
        </TabButton>
        <TabButton active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>
          Resolved
        </TabButton>
      </div>

      {isLoading && <LoadingState label="Loading analyst reviews…" />}
      {isError && <ErrorState message="Couldn't load analyst reviews." onRetry={refetch} />}
      {!isLoading && !isError && reviews && reviews.length === 0 && (
        <EmptyState title={statusFilter === "pending" ? "Nothing waiting on review" : "Nothing resolved yet"} />
      )}

      {!isLoading && !isError && reviews && reviews.length > 0 && (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-content-primary">{review.rawName}</p>
                  <p className="text-xs text-content-muted">Chart record #{review.chartRecordId}</p>
                </div>
                <Badge tone={review.status === "pending" ? "warning" : "success"}>{review.status}</Badge>
              </div>

              {review.status === "pending" &&
                (pendingResolveId === review.id ? (
                  <div className="mt-3 flex items-end gap-2">
                    <div className="flex-1">
                      <UserSelect value={selectedUserId} onChange={setSelectedUserId} placeholder="Resolve to…" />
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleResolve(review.id)}
                      disabled={!selectedUserId}
                      isLoading={isResolving}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setPendingResolveId(null);
                        setSelectedUserId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button type="button" variant="secondary" onClick={() => setPendingResolveId(review.id)}>
                      Resolve
                    </Button>
                  </div>
                ))}

              {review.status === "resolved" && (
                <p className="mt-2 text-xs text-content-muted">
                  Resolved — see the linked chart record for who this was pointed at.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
