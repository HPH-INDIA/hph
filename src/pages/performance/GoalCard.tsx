import { useId, type ReactNode } from "react";
import type { MonthlyGoalSummary } from "@/api/types";
import { chartsToGoal } from "./goalMetrics";
import { chartLabel, numberLabel } from "./performanceView";

export function GoalCard({ goal, label, periodLabel, children }: {
  goal: MonthlyGoalSummary;
  label: string;
  periodLabel: string;
  children?: ReactNode;
}) {
  const id = useId();
  const difference = chartsToGoal(goal.completedCharts, goal.adjustedTargetCharts);
  const achieved = Number(goal.adjustedTargetCharts) > 0 && difference !== null && difference >= 0;
  return <article aria-labelledby={id} className="min-w-0 rounded-lg border border-border bg-surface shadow-sm">
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-content-secondary">{periodLabel}</span>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 min-[360px]:grid-cols-2 lg:grid-cols-5">
        <div><dt className="text-xs text-content-secondary">Target goal charts</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{numberLabel(goal.targetCharts)}</dd></div>
        <div><dt className="text-xs text-content-secondary">Adjusted goal charts</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums text-brand-600">{chartLabel(goal.adjustedTargetCharts)}</dd></div>
        <div><dt className="text-xs text-content-secondary">Manual charts completed</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{numberLabel(goal.manualCharts)}</dd></div>
        <div><dt className="text-xs text-content-secondary">Kairon charts completed</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{numberLabel(goal.completedCharts)}</dd></div>
        <div className="min-[360px]:col-span-2 lg:col-span-1"><dt className="text-xs text-content-secondary">No. of charts to goal</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{chartLabel(difference)}</dd><dd className="mt-1 text-xs text-content-secondary">Kairon completed − adjusted goal</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-content-secondary">
        <span>{goal.eligibleDays} target workdays{goal.scope === "team" ? " across people" : ""}</span>
        <span>{goal.holidayCount} weekday holidays excluded</span>
        <span>{goal.leaveDaysExcluded} full-leave days excluded</span>
        {achieved && <span className="font-semibold text-brand-600">Goal achieved{difference > 0 ? ` · ${chartLabel(difference)} charts above goal` : ""}</span>}
      </div>
      <p className="mt-2 text-xs text-content-secondary">Negative means below goal; zero means at goal; positive means above goal.</p>
    </div>
    {children}
  </article>;
}
