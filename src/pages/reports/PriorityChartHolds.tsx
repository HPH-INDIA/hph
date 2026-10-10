import { Link } from "react-router-dom";
import { useGetKaironHoldsQuery } from "@/api/reportsApi";
import type { KaironHoldSummary } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { HoldArrow } from "./ChartHoldCards";
import { holdFocus, holdSearch } from "./chartHoldsView";

export function PriorityChartHolds({ viewerId, summary }: { viewerId: number; summary: KaironHoldSummary }) {
  const count = summary.ageBuckets?.priority ?? 0;
  const filters = { view: "all" as const, ageBucket: "priority" as const, sortBy: "age" as const, sortDirection: "desc" as const };
  const { currentData, error, refetch } = useGetKaironHoldsQuery({ viewerId, filters: { ...filters, pageSize: 5 } }, { skip: !count, refetchOnMountOrArgChange: true });
  const href = `/reports/chart-holds?${holdSearch(filters, "dashboard")}`;
  if (!count) return <p className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-content-secondary">No holds over 30 days in the current inventory.</p>;
  return <section aria-label="Priority review holds" className="overflow-hidden rounded-xl border border-danger bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-danger-bg px-5 py-4">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold text-danger"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs" aria-hidden="true">!</span>Priority review <span className="tabular-nums">· {count.toLocaleString()}</span></h3><p className="mt-1 text-xs text-content-secondary">Holds over 30 days · Oldest charts first</p></div>
      <Link to={href} className={`inline-flex items-center gap-2 rounded text-sm font-medium text-danger hover:underline ${holdFocus}`}>Review all <HoldArrow /></Link>
    </div>
    {error ? <div className="p-4"><ErrorState message="Couldn't load priority holds." onRetry={refetch} /></div> : !currentData ? <div className="p-4"><LoadingState label="Loading priority holds…" /></div> : <ul className="divide-y divide-border">{currentData.items.map((record) => <li key={record.id} className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0"><p className="truncate text-sm font-medium text-content-primary">{summary.users.find((user) => user.id === record.userId)?.name ?? record.codingAnalyst}<span className="ml-2 text-xs font-normal text-content-muted">#{record.id}</span></p><p className="mt-1 truncate text-xs text-content-muted">{record.practice || "No practice specified"} · {record.program} / {record.level}</p></div>
      <span className="shrink-0 rounded-full bg-danger-bg px-3 py-1 text-xs font-semibold tabular-nums text-danger">{record.age} days</span>
    </li>)}</ul>}
    {count > 5 && <p className="border-t border-border px-5 py-2.5 text-xs text-content-muted">Showing the 5 oldest of {count.toLocaleString()} priority holds</p>}
  </section>;
}
