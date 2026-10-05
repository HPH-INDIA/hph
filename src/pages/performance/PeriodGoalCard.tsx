import { useId } from "react";
import type { PeriodGoalSummary } from "@/api/types";
import { dateRangeLabel } from "./leadFilters";
import { chartLabel, numberLabel } from "./performanceView";

export function PeriodGoalCard({ goal, monthly, label }: { goal: PeriodGoalSummary; monthly: boolean; label: string }) {
  const id = useId();
  const target = Number(goal.adjustedTargetCharts ?? goal.targetCharts);
  const completed = goal.manualCharts ?? 0;
  const remaining = Number(goal.adjustedDifference ?? goal.difference);
  const progress = target > 0 ? completed / target * 100 : 0;
  return <article aria-labelledby={id} className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id={id} className="text-sm font-semibold">{label}</h3><span className="text-xs text-content-secondary">{monthly ? "Full-month goal" : "Period goal"} · {dateRangeLabel(goal.from, goal.to)}</span></div>
    <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
      <div><dt className="text-xs text-content-secondary">Target goal charts</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{numberLabel(goal.targetCharts)}</dd></div>
      <div><dt className="text-xs text-content-secondary">Adjusted target goal charts</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-brand-600">{chartLabel(goal.adjustedTargetCharts)}</dd></div>
      <div><dt className="text-xs text-content-secondary">Charts to goal</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{target > 0 ? chartLabel(Math.max(0, remaining)) : "—"}</dd></div>
      <div><dt className="text-xs text-content-secondary">Manual goal progress</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{target > 0 ? `${numberLabel(progress, 1)}%` : "—"}</dd></div>
    </dl>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-content-secondary">
      <span>{goal.eligibleDays} target workdays{goal.scope === "team" ? " across people" : ""}</span><span>{goal.holidayCount} weekday holidays excluded</span><span>{goal.leaveDaysExcluded} full-leave days excluded</span>
      {target > 0 && remaining <= 0 && <span className="font-semibold text-brand-600">Goal achieved{remaining < 0 ? ` · ${chartLabel(-remaining)} charts above goal` : ""}</span>}
    </div>
  </article>;
}

