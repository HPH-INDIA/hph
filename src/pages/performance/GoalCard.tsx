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
  return <article aria-labelledby={id} className="min-w-0 rounded-lg border border-border bg-surface shadow-sm">
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-content-secondary">{periodLabel}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-5">
        <div data-metric="kairon" className="metric-block"><dt className="text-xs text-brand-700">Kairon charts completed</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{numberLabel(goal.completedCharts)}</dd></div>
        <div data-metric="manual" className="metric-block"><dt className="text-xs text-content-secondary">Manual charts completed</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{numberLabel(goal.manualCharts)}</dd></div>
        <div data-metric="target" className="metric-block"><dt className="text-xs text-content-secondary">Target goal</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{numberLabel(goal.targetCharts)}</dd></div>
        <div data-metric="adjusted" className="metric-block"><dt className="text-xs text-content-secondary">Adjusted goal</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums text-brand-600">{chartLabel(goal.adjustedTargetCharts)}</dd></div>
        <div className="min-[360px]:col-span-2 lg:col-span-1"><dt className="text-xs text-content-secondary">Chart shortfall / surplus</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{difference != null && difference > 0 ? "+" : ""}{chartLabel(difference)}</dd><dd className="mt-1 text-xs text-content-secondary">Kairon completed − adjusted goal</dd></div>
      </dl>

    </div>
    {children}
  </article>;
}
