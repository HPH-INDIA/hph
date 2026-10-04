import { useState, type ReactNode } from "react";

import type { EfficiencySummary, MonthlyGoalSummary } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";

import { DailyPerformance } from "./DailyPerformance";
import { EfficiencyValue } from "./EfficiencyValue";
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
        : goal ? <MonthlyGoal goal={goal} manualCharts={summary?.manualCharts} month={month} /> : null}

      {props.summaryLoading ? <LoadingState label="Loading your performance…" />
        : props.summaryError ? <ErrorState message={props.summaryError} onRetry={props.onRetrySummary} />
        : summary ? <>
          <section aria-label="Personal performance summary" className="grid gap-3 md:grid-cols-3">
            <ComparisonCard title="Charts completed" note={goal?.scope === "team" ? "Your personal totals" : "Recorded this month"}>
              <Metric label="Manual" value={numberLabel(summary.manualCharts)} />
              <Metric label="Kairon" value={numberLabel(summary.kaironCharts)} />
            </ComparisonCard>
            <ComparisonCard title="Efficiency" note="100% meets target · capped at 120%">
              <Metric label="Manual" value={<EfficiencyValue value={summary.manualEfficiencyPercent} large />} />
              <Metric label="Kairon" value={<EfficiencyValue value={summary.kaironEfficiencyPercent} large />} />
            </ComparisonCard>
            <ComparisonCard title="Charts per day" note="Normalized to an 8-hour day" trailing={<span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-content-secondary">Target {numberLabel(summary.targetCpd, 1)}</span>}>
              <Metric label="Manual" value={numberLabel(summary.manualCpd, 1)} />
              <Metric label="Kairon" value={numberLabel(summary.kaironCpd, 1)} />
            </ComparisonCard>
          </section>
          <DailyPerformance key={month} rows={summary.daily} month={month} />
        </> : null}

      <CalculationHelp />
    </div>
  );
}

function MonthlyGoal({ goal, manualCharts, month }: { goal: MonthlyGoalSummary; manualCharts?: number; month: string }) {
  const adjusted = goal.adjustedTargetCharts !== undefined;
  const target = Number(goal.adjustedTargetCharts ?? goal.targetCharts);
  const isTeam = goal.scope === "team";
  const completed = adjusted ? goal.manualCharts ?? (isTeam ? undefined : manualCharts) : goal.completedCharts;
  const remaining = Number(goal.adjustedDifference ?? goal.difference);
  const progress = target > 0 && completed !== undefined ? completed / target * 100 : null;
  const achieved = target > 0 && remaining <= 0;
  return (
    <section aria-labelledby="monthly-goal-title" className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(240px,0.5fr)]">
        <div className="p-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="monthly-goal-title" className="text-sm font-semibold">{isTeam ? "Team monthly goal" : "Monthly goal"}</h2>
            <span className="text-xs text-content-secondary">{monthLabel(month)}{isTeam ? ` · ${goal.userCount} people` : ""}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1 tabular-nums">
            <span className="text-4xl font-semibold tracking-tight">{numberLabel(completed)}</span>
            <span className="pb-1 text-sm text-content-secondary">of <strong className="font-semibold text-content-primary">{chartLabel(target)}</strong> {adjusted ? "adjusted goal charts" : "goal charts"}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-content-secondary">{isTeam ? "Team · " : ""}{adjusted ? "Manual charts completed" : "Kairon charts completed"}</span>
            <span className="font-semibold tabular-nums text-brand-600">{progress === null ? "No goal progress yet" : `${numberLabel(progress, 1)}% complete`}</span>
          </div>
          <div role="progressbar" aria-label="Monthly goal completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === null ? 0 : Math.max(0, Math.min(progress, 100))} aria-valuetext={progress === null ? "No goal progress yet" : `${numberLabel(progress, 1)}% complete`} className="mt-2 h-2 overflow-hidden rounded-full bg-surface-inset">
            <div className={`h-full rounded-full ${achieved ? "bg-success" : "bg-brand-600"}`} style={{ width: `${Math.max(0, Math.min(progress ?? 0, 100))}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-content-secondary">
            <span>Original target <strong className="ml-1 font-semibold tabular-nums text-content-primary">{numberLabel(goal.targetCharts)}</strong></span>
            <span>Adjusted target <strong className="ml-1 font-semibold tabular-nums text-brand-600">{adjusted ? chartLabel(target) : "Unavailable"}</strong></span>
          </div>
        </div>
        <div className="flex flex-col justify-center bg-brand-900 px-5 py-6 text-content-inverted sm:px-7">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-100">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
            {target <= 0 ? "Monthly target" : achieved ? "Goal achieved" : "Charts to goal"}
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{target <= 0 ? "—" : chartLabel(Math.max(0, remaining))}</p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-brand-100">
            {target <= 0 ? "No eligible target for this month." : achieved
              ? remaining < 0 ? `${chartLabel(Math.abs(remaining))} charts above your ${isTeam ? "team’s " : ""}${adjusted ? "adjusted " : ""}goal. Well done!` : "You’ve completed your monthly goal. Well done!"
              : `Remaining to reach the full-month ${adjusted ? "adjusted " : ""}goal.`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-xs text-content-secondary sm:px-7">
        <span><strong className="text-content-primary">{goal.eligibleDays}</strong> target workdays{isTeam ? " across team" : ""}</span>
        <span><strong className="text-content-primary">{goal.holidayCount}</strong> weekday holidays excluded</span>
        <span><strong className="text-content-primary">{goal.leaveDaysExcluded}</strong> full-leave days excluded</span>
      </div>
      {isTeam && <TeamGoals goal={goal} />}
    </section>
  );
}

function TeamGoals({ goal }: { goal: MonthlyGoalSummary }) {
  return (
    <details className="group border-t border-border">
      <summary className={`flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold sm:px-7 [&::-webkit-details-marker]:hidden ${focusClass}`}>
        Team breakdown <span className="transition-transform group-open:rotate-90"><Chevron direction="right" /></span>
      </summary>
      {goal.users?.length ? <div className="overflow-x-auto px-5 pb-4 sm:px-7" role="region" aria-label="Team goal details" tabIndex={0}>
        <table className="w-full min-w-[650px] text-left text-sm tabular-nums">
          <caption className="sr-only">Monthly goals by team member</caption>
          <thead><tr className="border-b border-border text-xs text-content-secondary">
            {["Team member", "Manual charts", "Kairon charts", "Original target", "Adjusted target", "Charts to goal"].map((label, index) => <th key={label} scope="col" className={`px-3 py-3 font-medium ${index ? "text-right" : "pl-0"}`}>{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">{goal.users.map((member) => <tr key={member.userId}>
            <th scope="row" className="py-3 pr-3 font-medium">{member.name}</th>
            <td className="px-3 py-3 text-right">{numberLabel(member.manualCharts)}</td>
            <td className="px-3 py-3 text-right">{numberLabel(member.completedCharts)}</td>
            <td className="px-3 py-3 text-right">{numberLabel(member.targetCharts)}</td>
            <td className="px-3 py-3 text-right">{chartLabel(member.adjustedTargetCharts)}</td>
            <td className="px-3 py-3 text-right font-semibold text-brand-600">{chartLabel(Math.max(0, Number(member.adjustedDifference ?? member.difference)))}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="px-5 pb-5 text-sm text-content-secondary sm:px-7">Team member details are unavailable.</p>}
    </details>
  );
}

function ComparisonCard({ title, note, trailing, children }: { title: string; note: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{trailing}</div>
      <div className="mt-3 grid grid-cols-2 divide-x divide-border">{children}</div>
      <p className="mt-2 text-xs text-content-secondary">{note}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="last:pl-5"><p className="text-xs text-content-secondary">{label}</p><div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div></div>;
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
        <div><h3 className="mb-2 text-sm font-semibold text-content-primary">Monthly goal</h3><p>Your full-month target excludes weekends, office holidays, and full-leave days. Saved manual adjustments reduce the eligible daily targets. Progress compares manual charts with this adjusted goal.</p></div>
        <div><h3 className="mb-2 text-sm font-semibold text-content-primary">CPD & efficiency</h3><p>Manual and Kairon CPD normalize completed charts to an 8-hour day using the Daily Refresh hours: 8 hours minus downtime, idle time, all meetings, and leave. Efficiency compares charts with the target for those hours and is capped at 120%. Monthly values use weighted totals. A dash means no value is available.</p></div>
      </div>
    </details>
  );
}
