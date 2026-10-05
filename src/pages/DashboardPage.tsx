import { useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetMonthlyGoalQuery, useGetMyEfficiencyQuery } from "@/api/reportsApi";
import { useAuth } from "@/features/auth/useAuth";
import { CodingDashboardPage } from "@/pages/coding/CodingDashboardPage";
import { ManagerDashboardPage } from "./performance/ManagerDashboardPage";
import { LeadDashboardPage } from "@/pages/performance/LeadDashboardPage";
import { PerformanceOverview } from "@/pages/performance/PerformanceOverview";
import { currentMonthValue } from "@/pages/performance/performanceView";

export function DashboardPage() {
  const { user } = useAuth();
  const showsTeamDashboard = ["super_admin", "admin", "manager"].includes(user?.role.roleType ?? "");
  if (user?.role.roleType === "manager") return <ManagerDashboardPage />;
  if (user?.role.roleType === "lead") return <LeadDashboardPage />;
  return showsTeamDashboard ? <CodingDashboardPage /> : <PersonalDashboardPage />;
}

function PersonalDashboardPage() {
  const { user } = useAuth();
  const currentMonth = currentMonthValue();
  const [month, setMonth] = useState(currentMonth);
  const efficiency = useGetMyEfficiencyQuery({ month });
  const monthlyGoal = useGetMonthlyGoalQuery({ month });

  return (
    <PerformanceOverview
      firstName={user?.firstName}
      month={month}
      currentMonth={currentMonth}
      onMonthChange={setMonth}
      goal={monthlyGoal.currentData}
      summary={efficiency.currentData}
      goalLoading={monthlyGoal.isFetching && !monthlyGoal.currentData}
      summaryLoading={efficiency.isFetching && !efficiency.currentData}
      goalError={monthlyGoal.error ? getErrorMessage(monthlyGoal.error) : undefined}
      summaryError={efficiency.error ? getErrorMessage(efficiency.error) : undefined}
      onRetryGoal={monthlyGoal.refetch}
      onRetrySummary={efficiency.refetch}
    />
  );
}
