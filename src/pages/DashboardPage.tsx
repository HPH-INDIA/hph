import { useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetMonthlyGoalQuery, useGetMyEfficiencyQuery } from "@/api/reportsApi";
import type { MonthlyGoalSummary } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { CodingDashboardPage } from "@/pages/coding/CodingDashboardPage";

const inputClassName =
  "h-10 rounded-md border border-border bg-surface px-3 text-sm text-content-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function formatAdjustedCpd(value: string | null | undefined) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function formatCpd(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}

function EfficiencyValue({ value, large = false }: { value: string | null; large?: boolean }) {
  if (value === null) return <span className="text-content-muted">Not available</span>;
  const numeric = Number(value);
  const color = numeric >= 100 ? "text-success" : numeric >= 80 ? "text-warning" : "text-danger";
  return <span className={`${large ? "text-5xl" : "font-semibold"} ${color}`}>{numeric.toFixed(1)}%</span>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const showsTeamDashboard = ["super_admin", "admin", "manager"].includes(user?.role.roleType ?? "");

  return showsTeamDashboard ? <CodingDashboardPage /> : <PersonalDashboardPage />;
}

function PersonalDashboardPage() {
  const { user } = useAuth();
  const currentMonth = currentMonthValue();
  const [month, setMonth] = useState(currentMonth);
  const efficiency = useGetMyEfficiencyQuery({ month });
  const monthlyGoal = useGetMonthlyGoalQuery({ month });
  const summary = efficiency.data;

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">My performance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-content-primary">Welcome, {user?.firstName}.</h1>
          <p className="mt-1 text-sm text-content-muted">Daily and monthly efficiency based on productive login time.</p>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">
          Month
          <input
            type="month"
            max={currentMonth}
            value={month}
            onChange={(event) => setMonth(event.target.value || currentMonth)}
            className={inputClassName}
          />
        </label>
      </section>

      {monthlyGoal.isLoading ? (
        <LoadingState label="Calculating the monthly chart goal…" />
      ) : monthlyGoal.error ? (
        <ErrorState message={getErrorMessage(monthlyGoal.error)} onRetry={monthlyGoal.refetch} />
      ) : monthlyGoal.data ? (
        <MonthlyGoalCard goal={monthlyGoal.data} manualCharts={summary?.manualCharts} />
      ) : null}

      {efficiency.isLoading ? (
        <LoadingState label="Calculating efficiency…" />
      ) : efficiency.error ? (
        <ErrorState message={getErrorMessage(efficiency.error)} onRetry={efficiency.refetch} />
      ) : summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <SummaryCard label="Efficiency">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="mb-3 text-sm font-normal text-content-muted">Manual</p><EfficiencyValue value={summary.manualEfficiencyPercent} /></div>
                <div className="border-l border-border pl-5"><p className="mb-3 text-sm font-normal text-content-muted">Kairon</p><EfficiencyValue value={summary.kaironEfficiencyPercent} /></div>
              </div>
            </SummaryCard>
            <SummaryCard label="Charts per day">
              <div className="grid grid-cols-3 gap-4">
                <div><p className="mb-3 text-sm font-normal text-content-muted">Manual</p>{formatCpd(summary.manualCpd)}</div>
                <div><p className="mb-3 text-sm font-normal text-content-muted">Kairon</p>{formatCpd(summary.kaironCpd)}</div>
                <div className="border-l border-border pl-5"><p className="mb-3 text-sm font-normal text-content-muted">Target</p>{formatCpd(summary.targetCpd)}</div>
              </div>
            </SummaryCard>
          </section>

          <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Productive time = Total Inside − downtime − idle time − meetings. Daily Refresh basis = 8 hours − downtime − idle time − meetings − leave/permission. Manual, Kairon, and Target CPD use the Daily Refresh basis; efficiency uses the adjusted target and is capped at 120%.
          </p>

          <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-content-primary">Daily efficiency</h2>
              <p className="text-sm text-content-muted">Adjusted target CPD uses saved manual records and excludes Huddle meetings.</p>
            </div>
            {summary.daily.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-content-muted">No efficiency data is available for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="px-4 py-3 font-medium">Manual charts completed</th>
                      <th className="px-4 py-3 font-medium">Kairon charts completed</th>
                      <th className="px-4 py-3 font-medium">Adjusted target CPD</th>
                      <th className="px-4 py-3 font-medium">Manual CPD</th>
                      <th className="px-4 py-3 font-medium">Kairon CPD</th>
                      <th className="px-4 py-3 font-medium">Target CPD</th>
                      <th className="px-4 py-3 font-medium">Manual efficiency</th>
                      <th className="px-4 py-3 font-medium">Kairon efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.daily.map((row) => (
                      <tr key={row.date}>
                        <td className="px-4 py-3 text-content-secondary">{new Date(`${row.date}T00:00:00`).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-content-secondary">{row.stage ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-content-primary">{row.manualCharts}</td>
                        <td className="px-4 py-3 font-medium text-content-primary">{row.kaironCharts}</td>
                        <td className="px-4 py-3 text-content-secondary">{formatAdjustedCpd(row.adjustedCpd)}</td>
                        <td className="px-4 py-3 font-medium text-content-primary">{formatCpd(row.manualCpd)}</td>
                        <td className="px-4 py-3 font-medium text-content-primary">{formatCpd(row.kaironCpd)}</td>
                        <td className="px-4 py-3 font-medium text-content-primary">{formatCpd(row.targetCpd)}</td>
                        <td className="px-4 py-3"><EfficiencyValue value={row.manualEfficiencyPercent} /></td>
                        <td className="px-4 py-3"><EfficiencyValue value={row.kaironEfficiencyPercent} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function MonthlyGoalCard({ goal, manualCharts }: { goal: MonthlyGoalSummary; manualCharts?: number }) {
  const hasAdjustedGoal = goal.adjustedTargetCharts !== undefined;
  const target = Number(goal.adjustedTargetCharts ?? goal.targetCharts);
  const production = hasAdjustedGoal ? goal.manualCharts ?? manualCharts ?? 0 : goal.completedCharts;
  const chartsLeft = Number(goal.adjustedDifference ?? goal.difference);
  const progress = target > 0
    ? (production / target) * 100
    : 0;
  const isTeam = goal.scope === "team";

  return (
    <article className="overflow-hidden rounded-xl border border-brand-200 bg-surface shadow-card">
      <div className="grid gap-8 p-6 xl:grid-cols-[1fr_1.6fr] xl:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              {isTeam ? "Team monthly goal" : "My monthly goal"}
            </p>
            {isTeam && (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                {goal.userCount} people
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-content-muted">Target goal charts</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-content-primary">{goal.targetCharts.toLocaleString()}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-brand-700">Adjusted target goal charts</h2>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-brand-700">{hasAdjustedGoal ? formatGoalCharts(target) : "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-content-secondary">{hasAdjustedGoal ? "Manual charts · adjusted full-month goal" : "Completed Kairon charts · full-month goal"}</p>
          <div role="progressbar" aria-label="Monthly goal completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(progress, 100)} aria-valuetext={`${progress.toFixed(1)}% complete`} className="mt-5 h-3 overflow-hidden rounded-full bg-surface-inset">
            <div className={`h-full rounded-full ${progress >= 100 ? "bg-success" : "bg-brand-600"} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-content-muted">
            <span>{progress.toFixed(1)}% complete</span>
            <span>{production.toLocaleString()} {hasAdjustedGoal ? "manual charts" : "completed"}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-muted p-5">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-content-muted">Charts this month</p>
          <div className="grid gap-5 sm:grid-cols-3 sm:items-center sm:gap-0 sm:divide-x sm:divide-border">
            <GoalMetric label={isTeam ? "Team manual charts" : "Manual charts"} value={goal.manualCharts ?? (isTeam ? undefined : manualCharts)} />
            <GoalMetric label={isTeam ? "Team Kairon charts" : "Kairon charts"} value={goal.completedCharts} />
            <div className="px-3 text-center">
              <p className="text-sm font-bold text-brand-700">Charts left to achieve goal</p>
              <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums text-brand-700">{formatGoalCharts(Math.max(0, chartsLeft))}</p>
              <p className="mt-2 text-xs text-content-secondary">{chartsLeft > 0 ? hasAdjustedGoal ? "Adjusted target minus manual charts" : "Based on completed Kairon charts" : chartsLeft < 0 ? `${formatGoalCharts(Math.abs(chartsLeft))} charts above target` : "Goal achieved"}</p>
            </div>
          </div>
        </div>
      </div>
      {hasAdjustedGoal && <p className="border-t border-border px-6 py-3 text-xs text-content-muted">The adjusted target accounts for manual downtime, idle time, leave and meetings other than Huddle.</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border bg-brand-50/50 px-5 py-3 text-xs text-content-secondary">
        <span><strong className="text-content-primary">{goal.eligibleDays}</strong> target workdays</span>
        <span><strong className="text-content-primary">{goal.holidayCount}</strong> weekday office holidays excluded</span>
        <span><strong className="text-content-primary">{goal.leaveDaysExcluded}</strong> full-leave days excluded</span>
      </div>
      {isTeam && (
        <section className="border-t border-border">
          <h3 className="px-6 pt-5 font-semibold text-content-primary">User records</h3>
          {goal.users ? (
            <div className="overflow-x-auto px-6 pb-5">
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-content-muted"><tr>
                  <th className="py-3 pr-4 font-medium">User</th>
                  <th className="px-3 py-3 text-right font-medium">Manual charts</th>
                  <th className="px-3 py-3 text-right font-medium">Kairon charts</th>
                  <th className="px-3 py-3 text-right font-medium">Monthly target</th>
                  <th className="px-3 py-3 text-right font-medium">Adjusted target</th>
                  <th className="py-3 pl-3 text-right font-bold">Charts left</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {goal.users.map((member) => (
                    <tr key={member.userId} className="text-content-primary">
                      <td className="py-4 pr-4 font-medium">{member.name}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{member.manualCharts.toLocaleString()}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{member.completedCharts.toLocaleString()}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{member.targetCharts.toLocaleString()}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{member.adjustedTargetCharts === undefined ? "—" : formatGoalCharts(Number(member.adjustedTargetCharts))}</td>
                      <td className="py-4 pl-3 text-right font-bold tabular-nums text-brand-700">{formatGoalCharts(Math.max(0, Number(member.adjustedDifference ?? member.difference)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="px-6 py-4 text-sm text-content-muted">Team manual totals and user records are unavailable from the connected backend.</p>}
        </section>
      )}
    </article>
  );
}

function formatGoalCharts(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function GoalMetric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="px-3 text-center">
      <p className="text-xs text-content-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-content-primary">
        {value === undefined ? "—" : new Intl.NumberFormat("en-US").format(value)}
      </p>
    </div>
  );
}

function SummaryCard({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="text-sm text-content-muted">{label}</p>
      <div className="mt-5 text-3xl font-semibold tracking-tight tabular-nums text-content-primary">{children ?? value}</div>
    </article>
  );
}
