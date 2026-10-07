import { SortableHeader } from "@/components/ui/SortableHeader";
import { numericSortValue, sortTableRows, type SortColumn, type TableSort } from "@/components/ui/tableSort";
import { useState } from "react";

import type { EfficiencySummary, MonthlyGoalSummary } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";

import { DailyPerformance } from "./DailyPerformance";
import { PerformanceSummary } from "./PerformanceSummary";
import { GoalCard } from "./GoalCard";
import { chartsToGoal } from "./goalMetrics";
import { chartLabel, monthLabel, numberLabel, shiftMonth } from "./performanceView";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

interface PerformanceOverviewProps {
  firstName?: string;
  month: string;
  currentMonth: string;
  onMonthChange: (month: string) => void;
  goal?: MonthlyGoalSummary;
  summary?: EfficiencySummary;
  goalLoading: boolean;
  summaryLoading: boolean;
  goalError?: string;
  summaryError?: string;
  onRetryGoal: () => void;
  onRetrySummary: () => void;
}

export function PerformanceOverview(props: PerformanceOverviewProps) {
  const { month, currentMonth, onMonthChange, goal, summary } = props;
  return (
    <div className="mx-auto flex min-w-0 max-w-screen-2xl flex-col gap-5 text-content-primary">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">My workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your performance</h1>
          <p className="mt-1 text-sm text-content-secondary">{props.firstName ? `${props.firstName}, here’s` : "Here’s"} your month at a glance.</p>
        </div>
        <div className="flex max-w-full items-center gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-sm">
          <button type="button" aria-label="Previous month" disabled={month <= "1900-01"} onClick={() => onMonthChange(shiftMonth(month, -1))} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-content-secondary hover:bg-surface-muted disabled:opacity-30 ${focusClass}`}>
            <Chevron direction="left" />
          </button>
          <label className="min-w-0">
            <span className="sr-only">Performance month</span>
            <input type="month" min="1900-01" max={currentMonth} value={month} onChange={(event) => {
              const value = event.target.value;
              if (/^\d{4}-\d{2}$/.test(value) && value >= "1900-01" && value <= currentMonth) onMonthChange(value);
            }} className={`h-10 min-w-0 max-w-full rounded-md bg-surface px-2 text-sm font-semibold text-content-primary ${focusClass}`} />
          </label>
          <button type="button" aria-label="Next month" disabled={month >= currentMonth} onClick={() => onMonthChange(shiftMonth(month, 1))} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-content-secondary hover:bg-surface-muted disabled:opacity-30 ${focusClass}`}>
            <Chevron direction="right" />
          </button>
        </div>
      </header>

      {props.goalLoading ? <LoadingState label="Loading your monthly goal…" />
        : props.goalError ? <ErrorState message={props.goalError} onRetry={props.onRetryGoal} />
        : goal ? <MonthlyGoal goal={goal} month={month} /> : null}

      {props.summaryLoading ? <LoadingState label="Loading your performance…" />
        : props.summaryError ? <ErrorState message={props.summaryError} onRetry={props.onRetrySummary} />
        : summary ? <>
          <PerformanceSummary summary={summary} />
          <DailyPerformance key={month} rows={summary.daily} month={month} />
        </> : null}

      <CalculationHelp />
    </div>
  );
}

function MonthlyGoal({ goal, month }: { goal: MonthlyGoalSummary; month: string }) {
  const isTeam = goal.scope === "team";
  return <GoalCard goal={goal} label={isTeam ? "Team monthly goal" : "Monthly goal"}
    periodLabel={`Full-month goal · ${monthLabel(month)}${isTeam ? ` · ${goal.userCount} people` : ""}`}>
    {isTeam && <TeamGoals goal={goal} />}
  </GoalCard>;
}

type GoalMember = NonNullable<MonthlyGoalSummary["users"]>[number];
const goalColumns: SortColumn<GoalMember>[] = [
  { key: "name", label: "Team member", value: (row) => row.name },
  ...([["targetCharts", "Target goal charts"], ["adjustedTargetCharts", "Adjusted goal charts"], ["manualCharts", "Manual charts completed"], ["completedCharts", "Kairon charts completed"]] as const)
    .map(([key, label]) => ({ key, label, value: (row: GoalMember) => numericSortValue(row[key]), defaultDirection: "desc" as const })),
  { key: "chartsToGoal", label: "No. of charts to goal", value: (row) => chartsToGoal(row.completedCharts, row.adjustedTargetCharts), defaultDirection: "desc" },
];
function TeamGoals({ goal }: { goal: MonthlyGoalSummary }) {
  const [sort, setSort] = useState<TableSort>({ key: "name", direction: "asc" });
  const members = sortTableRows(goal.users ?? [], goalColumns, sort);
  return (
    <details className="group border-t border-border">
      <summary className={`flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold sm:px-7 [&::-webkit-details-marker]:hidden ${focusClass}`}>
        Team breakdown <span className="transition-transform group-open:rotate-90"><Chevron direction="right" /></span>
      </summary>
      {goal.users?.length ? <div className="overflow-x-auto px-5 pb-4 sm:px-7" role="region" aria-label="Team goal details" tabIndex={0}>
        <table className="w-full min-w-[650px] text-left text-sm tabular-nums">
          <caption className="sr-only">Monthly goals by team member</caption>
          <thead><tr className="border-b border-border text-xs text-content-secondary">
            {goalColumns.map((column, index) => <SortableHeader key={column.key} column={column} sort={sort} onSort={setSort} align={index ? "right" : "left"} className={`px-3 py-3 font-medium ${index ? "" : "pl-0"}`} />)}
          </tr></thead>
          <tbody className="divide-y divide-border">{members.map((member) => <tr key={member.userId}>
            <th scope="row" className="py-3 pr-3 font-medium">{member.name}</th>
            <td className="px-3 py-3 text-right">{numberLabel(member.targetCharts)}</td>
            <td className="px-3 py-3 text-right">{chartLabel(member.adjustedTargetCharts)}</td>
            <td className="px-3 py-3 text-right">{numberLabel(member.manualCharts)}</td>
            <td className="px-3 py-3 text-right">{numberLabel(member.completedCharts)}</td>
            <td className="px-3 py-3 text-right font-semibold text-brand-600">{chartLabel(chartsToGoal(member.completedCharts, member.adjustedTargetCharts))}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="px-5 pb-5 text-sm text-content-secondary sm:px-7">Team member details are unavailable.</p>}
    </details>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${direction === "left" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 5 5 5-5 5" /></svg>;
}

function CalculationHelp() {
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-lg border border-border bg-surface">
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-content-secondary [&::-webkit-details-marker]:hidden ${focusClass}`}>
        How these numbers work <span className={open ? "rotate-90" : ""}><Chevron direction="right" /></span>
      </summary>
      <div className="grid gap-5 border-t border-border px-5 py-5 text-xs leading-relaxed text-content-secondary md:grid-cols-3">
        <div><h3 className="mb-2 text-sm font-semibold text-content-primary">Adjusted target CPD</h3><p>Your stage target × available manual hours ÷ 8. Available hours start at 8 and deduct downtime, no-inventory / idle time, leave, and meetings other than Huddle, including one-on-ones. Hours cannot fall below zero. This value updates when your manual record is saved.</p></div>
        <div><h3 className="mb-2 text-sm font-semibold text-content-primary">Monthly goal</h3><p>Your full-month target excludes weekends, office holidays, and full-leave days. Saved manual adjustments reduce the eligible daily targets. Kairon charts completed come from the goal’s reporting period. No. of charts to goal is Kairon completed minus the adjusted goal: negative below goal, zero at goal, and positive above goal.</p></div>
        <div><h3 className="mb-2 text-sm font-semibold text-content-primary">CPD & efficiency</h3><p>Manual and Kairon CPD normalize completed charts to an 8-hour day using the Daily Refresh hours: 8 hours minus downtime, idle time, all meetings, and leave. Efficiency compares charts with the target for those hours and is capped at 120%. Monthly values use weighted totals. A dash means no value is available.</p></div>
      </div>
    </details>
  );
}
