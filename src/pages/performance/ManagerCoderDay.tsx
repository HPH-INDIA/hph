import { getErrorMessage } from "@/api/apiError";
import { managerCoderDay, managerCoderDayQuery, type CoderPerformanceMember } from "@/api/coderPerformance";
import { useGetManagerDashboardQuery } from "@/api/reportsApi";
import type { ManagerDashboardQuery } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { CoderPerformanceTable } from "./CoderPerformanceTable";
import { dayLabel } from "./performanceView";

export function ManagerCoderDay({ date, scope, members, onPick, paginate = true }: {
  date: string;
  paginate?: boolean;
  scope: ManagerDashboardQuery;
  members: CoderPerformanceMember[];
  onPick: (userId: number) => void;
}) {
  const result = useGetManagerDashboardQuery(managerCoderDayQuery(scope, date));
  if (result.error) return <ErrorState message={getErrorMessage(result.error)} onRetry={result.refetch} />;
  if (!result.currentData) return <LoadingState label="Loading this day’s coder results…" />;
  return <CoderPerformanceTable paginate={paginate} enableEfficiencyFilters members={managerCoderDay(members, result.currentData.members)} caption={`Coder results · ${dayLabel(date, true)}`} onPick={onPick} day />;
}
