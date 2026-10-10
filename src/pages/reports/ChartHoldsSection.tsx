import { Link, useLocation } from "react-router-dom";

import { getErrorMessage } from "@/api/apiError";
import { useGetKaironHoldSummaryQuery } from "@/api/reportsApi";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { PriorityChartHolds } from "./PriorityChartHolds";
import { ChartHoldCards, HoldArrow } from "./ChartHoldCards";
import { holdFocus, holdLink, holdViews, type HoldRole } from "./chartHoldsView";

export function ChartHoldsSection() {
  const { user, hasFeature } = useAuth();
  const role = user?.role.roleType;
  if (!user || !hasFeature("reports") || (role !== "employee" && role !== "lead" && role !== "manager")) return null;
  return <ChartHoldsContent key={user.id} role={role} viewerId={user.id} />;
}

function ChartHoldsContent({ role, viewerId }: { role: HoldRole; viewerId: number }) {
  const location = useLocation();
  const source = location.pathname === "/reports" ? "kairon" : "dashboard";
  const { currentData, isFetching, error, refetch } = useGetKaironHoldSummaryQuery({ viewerId, filters: {} }, { refetchOnMountOrArgChange: true });
  return <section aria-label="Chart holds" className="flex min-w-0 flex-col gap-3" aria-busy={isFetching}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-semibold text-content-primary">Chart holds</h2>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-content-secondary">Current inventory</span>
      </div>
      <Link to={holdLink(holdViews(role)[0].value, source)} className={`inline-flex items-center gap-2 rounded text-sm font-medium text-brand-700 hover:underline ${holdFocus}`}>Explore holds <HoldArrow /></Link>
    </div>
    {error ? <ErrorState message={`Couldn't load chart holds. ${getErrorMessage(error)}`} onRetry={refetch} />
      : !currentData ? <LoadingState label="Loading chart holds…" />
        : <ChartHoldCards role={role} summary={currentData} href={(view) => holdLink(view, source)} />}
    {role === "manager" && source === "dashboard" && currentData && !error && <PriorityChartHolds viewerId={viewerId} summary={currentData} />}
  </section>;
}
