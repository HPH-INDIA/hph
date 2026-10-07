import { useMemo } from "react";
import { getErrorMessage } from "@/api/apiError";
import { useGetCodingDashboardQuery, useGetMyEfficiencyQuery } from "@/api/reportsApi";
import type { CodingDashboardCard, EfficiencySummary } from "@/api/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import type { ManualReportWindow } from "./manualReportSummary";
import { ReportGraphs } from "./ReportGraphs";

function formatCpd(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}

function achievement(actual: string | null, target: string | null) {
  if (actual === null || target === null || Number(target) <= 0) return null;
  return Number(actual) * 100 / Number(target);
}

function cpd(charts: number, targetMinutes: number) {
  return targetMinutes > 0 ? (charts * 480 / targetMinutes).toFixed(1) : null;
}

function aggregateTeamOverview(cards: CodingDashboardCard[], from: string, to: string): EfficiencySummary {
  const totals = cards.reduce(
    (result, card) => ({
      manualCharts: result.manualCharts + card.efficiency.manualCharts,
      kaironCharts: result.kaironCharts + card.efficiency.kaironCharts,
      adjustedTarget: result.adjustedTarget + Number(card.efficiency.adjustedTarget),
      insideMinutes: result.insideMinutes + card.efficiency.insideMinutes,
      loginDays: result.loginDays + card.efficiency.loginDays,
      productiveMinutes: result.productiveMinutes + card.efficiency.productiveMinutes,
      targetMinutes: result.targetMinutes + card.efficiency.targetMinutes,
      calculatedDays: result.calculatedDays + card.efficiency.calculatedDays,
    }),
    { manualCharts: 0, kaironCharts: 0, adjustedTarget: 0, insideMinutes: 0, loginDays: 0, productiveMinutes: 0, targetMinutes: 0, calculatedDays: 0 },
  );

  return {
    from,
    to,
    ...totals,
    adjustedTarget: totals.adjustedTarget.toFixed(2),
    manualEfficiencyPercent: totals.adjustedTarget > 0 ? Math.min(120, totals.manualCharts * 100 / totals.adjustedTarget).toFixed(1) : null,
    kaironEfficiencyPercent: totals.adjustedTarget > 0 ? Math.min(120, totals.kaironCharts * 100 / totals.adjustedTarget).toFixed(1) : null,
    manualCpd: cpd(totals.manualCharts, totals.targetMinutes),
    kaironCpd: cpd(totals.kaironCharts, totals.targetMinutes),
    targetCpd: cpd(totals.adjustedTarget, totals.targetMinutes),
    daily: [],
  };
}


export function TeamPerformanceGraphs({ cards }: { cards: CodingDashboardCard[] }) {
  if (!cards.length) return <EmptyState title="No coders match these filters" />;
  return <div className="min-w-0 p-5"><ReportGraphs sources={cards.map((card) => card.efficiency.daily)}
    from={cards[0].efficiency.from} to={cards[0].efficiency.to} teamView /></div>;
}

export function ReportsOverviewTab({ window }: { window: ManualReportWindow }) {
  const { user } = useAuth();
  const isTeamView = ["super_admin", "admin", "manager"].includes(user?.role.roleType ?? "");
  const { fromDate: from, toDate: to } = window;
  const efficiency = useGetMyEfficiencyQuery({ from, to }, { skip: isTeamView });
  const teamDashboard = useGetCodingDashboardQuery({ from, to, includeDaily: true }, { skip: !isTeamView });
  const summary = useMemo(() => isTeamView
    ? teamDashboard.currentData ? aggregateTeamOverview(teamDashboard.currentData, from, to) : undefined
    : efficiency.currentData, [isTeamView, teamDashboard.currentData, efficiency.currentData, from, to]);
  const sources = useMemo(() => isTeamView
    ? (teamDashboard.currentData ?? []).map((card) => card.efficiency.daily)
    : [efficiency.currentData?.daily ?? []], [isTeamView, teamDashboard.currentData, efficiency.currentData]);
  const error = isTeamView ? teamDashboard.error : efficiency.error;
  const refetch = isTeamView ? teamDashboard.refetch : efficiency.refetch;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-content-primary">{isTeamView ? "Team daily overview" : "Daily CPD overview"}</h2>
        <p className="text-sm text-content-muted">Compare lost hours, production, and charts per day for the selected reporting period.</p>
      </div>
      {error ? <ErrorState message={getErrorMessage(error)} onRetry={refetch} /> : !summary
        ? <LoadingState label="Building daily overview…" /> : <>
          <div className="grid gap-3 sm:grid-cols-3">
            <CpdCard label="Target CPD" value={summary.targetCpd} />
            <CpdCard label="Manual CPD" value={summary.manualCpd} achievement={achievement(summary.manualCpd, summary.targetCpd)} />
            <CpdCard label="Kairon CPD" value={summary.kaironCpd} achievement={achievement(summary.kaironCpd, summary.targetCpd)} />
          </div>
          <ReportGraphs sources={sources} from={from} to={to} teamView={isTeamView} />
        </>}
    </section>
  );
}

function CpdCard({ label, value, achievement: achievementValue }: { label: string; value: string | null; achievement?: number | null }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="text-sm text-content-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-content-primary">{formatCpd(value)}</p>
        {achievementValue != null && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${achievementValue >= 100 ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>
            {achievementValue.toFixed(1)}% of target
          </span>
        )}
      </div>
    </article>
  );
}
