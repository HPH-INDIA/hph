import { PerformanceSummary } from "./PerformanceSummary";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { numericSortValue, sortTableRows, type SortColumn, type TableSort } from "@/components/ui/tableSort";
import { useState } from "react";
import { ReportGraphs } from "@/pages/reports/ReportGraphs";
import { PerformanceTabs } from "./PerformanceTabs";

import type { EfficiencySummary, MonthlyGoalSummary } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";

import { DailyPerformance } from "./DailyPerformance";
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
  const [view, setView] = useState<"overview" | "trends">("overview");
  return (
    <div className="coder-dashboard-fit mx-auto flex min-w-0 max-w-screen-2xl flex-col gap-3 text-content-primary">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="sr-only">Your performance</h1>
        <PerformanceTabs value={view} onChange={setView} items={[{ value: "overview", label: "Overview" }, { value: "trends", label: "Trends" }]} label="Personal performance views" />
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <div className="flex max-w-full items-center rounded-md border border-border bg-surface">
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
        </div>
      </header>

      <div className="coder-summary-grid grid min-w-0 gap-3">
        <div className="min-w-0">      {props.goalLoading ? <LoadingState label="Loading your monthly goal…" />
        : props.goalError ? <ErrorState message={props.goalError} onRetry={props.onRetryGoal} />
        : goal ? <MonthlyGoal goal={goal} month={month} /> : null}
        </div>
        {!props.summaryLoading && !props.summaryError && summary && <div className="coder-summary-rates min-w-0"><PerformanceSummary summary={summary} /></div>}
      </div>
      <div className="coder-dashboard-results min-w-0 space-y-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" role="region" aria-label="Personal performance results" tabIndex={0}>
        {props.summaryLoading ? <LoadingState label="Loading your performance…" />
          : props.summaryError ? <ErrorState message={props.summaryError} onRetry={props.onRetrySummary} />
          : summary ? view === "trends"
            ? <ReportGraphs sources={[summary.daily]} from={summary.from} to={summary.to} />
            : <DailyPerformance paginate={false} key={month} rows={summary.daily} month={month} title="Daily performance" /> : null}
      </div>


    </div>
  );
}

function MonthlyGoal({ goal, month }: { goal: MonthlyGoalSummary; month: string }) {
  const difference = chartsToGoal(goal.completedCharts, goal.adjustedTargetCharts);
  return <section aria-label="Monthly goal" className="h-full rounded-xl border border-border bg-surface px-4 py-3">
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 lg:grid-cols-5">
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 lg:col-span-5"><h2 className="text-sm font-semibold">Monthly goal</h2><p className="mt-1 text-xs text-content-secondary">Full month · {monthLabel(month)}</p></div>
      <dl data-metric="kairon" className="metric-block"><dt className="text-xs">Kairon charts completed</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{numberLabel(goal.completedCharts)}</dd></dl>
      <dl data-metric="manual" className="metric-block"><dt className="text-xs">Manual charts completed</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{numberLabel(goal.manualCharts)}</dd></dl>
      <dl data-metric="target" className="metric-block"><dt className="text-xs">Target goal</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{numberLabel(goal.targetCharts)}</dd></dl>
      <dl data-metric="adjusted" className="metric-block"><dt className="text-xs">Adjusted goal</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{chartLabel(goal.adjustedTargetCharts)}</dd></dl>
      <dl><dt className="text-xs text-content-secondary">Chart shortfall / surplus</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{difference != null && difference > 0 ? "+" : ""}{chartLabel(difference)}</dd><dd className="text-[11px] text-content-muted">Kairon completed − adjusted monthly goal</dd></dl>
    </div>

    {goal.scope === "team" && <TeamGoals goal={goal} />}
  </section>;
}

type GoalMember = NonNullable<MonthlyGoalSummary["users"]>[number];
const goalColumns: SortColumn<GoalMember>[] = [
  { key: "name", label: "Team member", value: (row) => row.name },
  ...([["completedCharts", "Kairon charts completed"], ["manualCharts", "Manual charts completed"], ["targetCharts", "Target goal"], ["adjustedTargetCharts", "Adjusted goal"]] as const)
    .map(([key, label]) => ({ key, label, value: (row: GoalMember) => numericSortValue(row[key]), defaultDirection: "desc" as const })),
  { key: "chartsToGoal", label: "Chart shortfall / surplus", value: (row) => chartsToGoal(row.completedCharts, row.adjustedTargetCharts), defaultDirection: "desc" },
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
            <td className="px-3 py-3 text-right">{numberLabel(member.completedCharts)}</td>
            <td className="px-3 py-3 text-right">{numberLabel(member.manualCharts)}</td>
            <td className="px-3 py-3 text-right">{numberLabel(member.targetCharts)}</td>
            <td className="px-3 py-3 text-right">{chartLabel(member.adjustedTargetCharts)}</td>
            <td className="px-3 py-3 text-right font-semibold text-brand-600">{chartLabel(chartsToGoal(member.completedCharts, member.adjustedTargetCharts))}</td>
          </tr>)}</tbody>
          <tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr><th scope="row" className="px-3 py-3">Total</th>
            {(["completedCharts","manualCharts","targetCharts"] as const).map(key => <td key={key} className="px-3 py-3 text-right">{numberLabel(members.reduce((sum,member) => sum + member[key],0))}</td>)}
            <td className="px-3 py-3 text-right">{members.every(member => member.adjustedTargetCharts != null) ? chartLabel(members.reduce((sum,member) => sum + Number(member.adjustedTargetCharts),0)) : "—"}</td>
            <td className="px-3 py-3 text-right">{members.every(member => member.adjustedTargetCharts != null) ? chartLabel(members.reduce((sum,member) => sum + member.completedCharts - Number(member.adjustedTargetCharts),0)) : "—"}</td>
          </tr></tfoot>
        </table>
      </div> : <p className="px-5 pb-5 text-sm text-content-secondary sm:px-7">Team member details are unavailable.</p>}
    </details>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${direction === "left" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 5 5 5-5 5" /></svg>;
}
