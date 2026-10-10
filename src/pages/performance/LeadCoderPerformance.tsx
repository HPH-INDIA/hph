import { getErrorMessage } from "@/api/apiError";
import { leadCoderDay, type CoderPerformanceMember } from "@/api/coderPerformance";
import { useGetLeadCoderPerformanceQuery } from "@/api/reportsApi";
import type { LeadDashboardSummary } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { CoderPerformancePanel } from "./CoderPerformancePanel";
import { CoderPerformanceTable } from "./CoderPerformanceTable";
import { dateRangeLabel } from "./leadFilters";
import { dayLabel } from "./performanceView";

export function LeadCoderPerformance({ data, onPick, view = "coder" }: { view?: "coder" | "day"; data: LeadDashboardSummary; onPick: (userId: number) => void }) {
  const selected = data.coderOptions.find((coder) => coder.userId === data.selectedCoderId);
  const details = useGetLeadCoderPerformanceQuery({ from: data.from, to: data.to, coders: data.coderOptions }, { skip: Boolean(selected) || data.coderOptions.length === 0 });
  const members: CoderPerformanceMember[] = selected
    ? [{ ...selected, efficiency: data.coders.efficiency, daily: data.coders.efficiency.daily }]
    : details.currentData ?? [];
  const error = !selected && details.error ? getErrorMessage(details.error) : undefined;
  const loading = !selected && !details.currentData && (details.isLoading || details.isFetching);
  return <CoderPerformancePanel compact activeView={view} key={`${data.from}-${data.to}-${data.selectedCoderId ?? "all"}`}
    members={members} rows={data.coders.efficiency.daily} from={data.from} to={data.to} periodLabel={dateRangeLabel(data.from, data.to)}
    loading={loading} error={error} onRetry={details.refetch} onPick={onPick}
    exportName={`coder-performance-${data.selectedCoderId ?? "combined"}-${data.from}-to-${data.to}`}
    renderDayDetails={(date) => error ? <ErrorState message={error} onRetry={details.refetch} /> : loading ? <LoadingState label="Loading coder results…" /> : <CoderPerformanceTable paginate={false} enableEfficiencyFilters members={leadCoderDay(members, date)} caption={`Coder results · ${dayLabel(date, true)}`} onPick={onPick} day />} />;
}
