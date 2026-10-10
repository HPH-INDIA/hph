import { useState } from "react";
import { Link } from "react-router-dom";

import { useListKaironChartsQuery } from "@/api/kaironApi";
import { KAIRON_LEVELS, KAIRON_STATUSES, PROJECTS, type KaironLevel, type KaironStatus } from "@/api/types";
import { useRoleIdsForRoleTypes } from "@/api/useRoleIdsForRoleTypes";
import { useUserNameLookup } from "@/api/useUserNameLookup";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/FormField";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { MultiUserSelect } from "@/components/ui/UserSelect";
import { useAuth } from "@/features/auth/useAuth";
import { visibleAnalystRoleTypes } from "@/features/auth/hierarchy";

const CODING_PROJECT_ID = PROJECTS.find((project) => project.name === "CODING")!.id;

function statusTone(status: KaironStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "On Hold") return "warning" as const;
  return "brand" as const;
}

export function KaironRecordsListPage() {
  const { hasFeature, hasRoleType, user } = useAuth();
  const canUpload = hasFeature("reports", "write") && hasRoleType("manager");
  const [status, setStatus] = useState<KaironStatus | "">("");
  const [level, setLevel] = useState<KaironLevel | "">("");
  // A single selection filters to one analyst; several is the "group of
  // users" filter from the doc's §8 — both are the same control, since the
  // backend's userIds param already covers a list of any size.
  const [analystIds, setAnalystIds] = useState<number[]>([]);
  const [asOfDate, setAsOfDate] = useState("");

  // The Analyst(s) picker should only ever offer the coding project's
  // analysts below the viewer in the hierarchy (leads+employees for a
  // manager, employees for a lead) — never every user in the system.
  const analystRoleIds = useRoleIdsForRoleTypes(visibleAnalystRoleTypes(user?.role.roleType));

  const {
    data: records,
    isLoading,
    isError,
    refetch,
  } = useListKaironChartsQuery({
    status: status || null,
    level: level || null,
    userIds: analystIds.length > 0 ? analystIds : null,
    asOfDate: asOfDate || null,
  });
  const getUserName = useUserNameLookup();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-metric="kairon" className="metric-label text-lg font-semibold text-content-primary">Kairon chart records</h1>
          <p className="text-sm text-content-muted">The per-chart coding/QA ledger pulled from Kairon exports.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/kairon/uploads">
            <Button variant="secondary">Upload history</Button>
          </Link>
          {canUpload && (
            <Link to="/kairon/uploads/new">
              <Button>Upload batch</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-secondary">Status</label>
          <select
            className={inputClasses}
            value={status}
            onChange={(event) => setStatus(event.target.value as KaironStatus | "")}
          >
            <option value="">All</option>
            {KAIRON_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-secondary">Level</label>
          <select
            className={inputClasses}
            value={level}
            onChange={(event) => setLevel(event.target.value as KaironLevel | "")}
          >
            <option value="">All</option>
            {KAIRON_LEVELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <MultiUserSelect
          value={analystIds}
          onChange={setAnalystIds}
          label="Analyst(s)"
          size={3}
          projectIds={[CODING_PROJECT_ID]}
          roleIds={analystRoleIds ?? []}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-secondary">As of date</label>
          <input
            type="date"
            className={inputClasses}
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
          />
        </div>
      </div>

      {isLoading && <LoadingState label="Loading chart records…" />}
      {isError && <ErrorState message="Couldn't load chart records." onRetry={refetch} />}
      {!isLoading && !isError && records && records.length === 0 && (
        <EmptyState title="No chart records match these filters" />
      )}

      {!isLoading && !isError && records && records.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Coding analyst</th>
                <th className="px-4 py-3 font-medium">Actions</th>
                <th className="px-4 py-3 font-medium">Last action</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Completed</th>
                <th className="px-4 py-3 font-medium">TAT</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Practice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 text-content-primary">{record.program}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.level}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(record.status)}>{record.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    <div className="flex flex-col">
                      <span>{record.userId ? getUserName(record.userId) : record.codingAnalyst}</span>
                      {!record.userId && <Badge tone="warning">Unresolved</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-content-secondary">{record.actions}</td>
                  <td
                    className="max-w-xs truncate px-4 py-3 text-content-secondary"
                    title={record.lastAction ?? undefined}
                  >
                    {record.lastAction ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">{record.created}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.completed ?? "—"}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.tat ?? "—"}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.age ?? "—"}</td>
                  <td className="px-4 py-3 text-content-secondary">{record.practice ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
