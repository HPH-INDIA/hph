import type { PeriodGoalSummary } from "@/api/types";
import { GoalCard } from "./GoalCard";
import { dateRangeLabel } from "./leadFilters";

export function PeriodGoalCard({ goal, monthly, label }: { goal: PeriodGoalSummary; monthly: boolean; label: string }) {
  return <GoalCard goal={goal} label={label} periodLabel={`${monthly ? "Full-month goal" : "Period goal"} · ${dateRangeLabel(goal.from, goal.to)}`} />;
}
