import { metricTotals } from "@/pages/performance/metricTotals";
import { displayNumber, displayCpd } from "@/utils/displayNumber";
import { metricIdentity } from "@/components/ui/metricIdentity";
import { useMemo, useState } from "react";
import { getErrorMessage } from "@/api/apiError";
import { useGetCodingDashboardQuery, useGetMyEfficiencyQuery, useGetLeadDashboardQuery, useGetLeadCoderPerformanceQuery } from "@/api/reportsApi";
import type { CodingDashboardCard, EfficiencySummary } from "@/api/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import type { ManualReportWindow } from "./manualReportSummary";
import { ReportGraphs } from "./ReportGraphs";
import { buildReportChartRows } from "./reportChartData";
import { PaginationControls } from "@/components/ui/PaginationControls";
import type { DailyEfficiency } from "@/api/types";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { PerformanceTabs } from "@/pages/performance/PerformanceTabs";

function formatCpd(value: string | null) {
  return displayCpd(value);
}

function achievement(actual: string | null, target: string | null) {
  if (actual === null || target === null || Number(target) <= 0) return null;
  return Number(actual) * 100 / Number(target);
}

function cpd(charts: number, targetMinutes: number) {
  return targetMinutes > 0 ? String(charts * 480 / targetMinutes) : null;
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

export function ReportsOverviewTab({ window, view = "trends", onViewChange }: { window: ManualReportWindow; view?: "records" | "trends"; onViewChange: (view: "records" | "trends") => void }) {
  const { user } = useAuth();
  const isLead = user?.role.roleType === "lead";
  const isTeamView = ["super_admin", "admin", "manager"].includes(user?.role.roleType ?? "");
  const [scope, setScope] = useState<"qa" | "coders">("qa");
  // null means all available coders; an empty selection means no coders.
  const [selectedCoderIds, setSelectedCoderIds] = useState<string[] | null>(null);
  const { fromDate: from, toDate: to } = window;
  const efficiency = useGetMyEfficiencyQuery({ from, to }, { skip: isTeamView || isLead });
  const teamDashboard = useGetCodingDashboardQuery({ from, to, includeDaily: true }, { skip: !isTeamView });
  const leadDashboard = useGetLeadDashboardQuery({ from, to }, { skip: !isLead });
  const coderOptions = useMemo(() => leadDashboard.currentData?.coderOptions ?? [], [leadDashboard.currentData]);
  const coderDetails = useGetLeadCoderPerformanceQuery({ from, to, coders: coderOptions },
    { skip: !isLead || scope !== "coders" || !leadDashboard.currentData || !coderOptions.length });
  const coderIds = selectedCoderIds ?? coderOptions.map(coder => String(coder.userId));
  const selectedMembers = useMemo(() => (coderDetails.currentData ?? []).filter(member =>
    selectedCoderIds === null || selectedCoderIds.includes(String(member.userId))), [coderDetails.currentData, selectedCoderIds]);
  const coderSources = useMemo(() => selectedMembers.map(member => member.daily ?? []), [selectedMembers]);
  const summary = useMemo(() => isLead
    ? scope === "qa" ? leadDashboard.currentData?.qa.efficiency
      : selectedCoderIds === null ? leadDashboard.currentData?.coders.efficiency
        : metricTotals(coderSources.flat())
    : isTeamView ? teamDashboard.currentData ? aggregateTeamOverview(teamDashboard.currentData, from, to) : undefined
      : efficiency.currentData,
    [isLead, scope, leadDashboard.currentData, selectedCoderIds, coderSources, isTeamView, teamDashboard.currentData, efficiency.currentData, from, to]);
  const sources = useMemo(() => isLead
    ? scope === "coders" ? coderSources : [leadDashboard.currentData?.qa.efficiency.daily ?? []]
    : isTeamView ? (teamDashboard.currentData ?? []).map(card => card.efficiency.daily)
      : [efficiency.currentData?.daily ?? []],
    [isLead, scope, coderSources, leadDashboard.currentData, isTeamView, teamDashboard.currentData, efficiency.currentData]);
  const error = isLead ? leadDashboard.error || (scope === "coders" ? coderDetails.error : undefined)
    : isTeamView ? teamDashboard.error : efficiency.error;
  const refetch = isLead ? () => { void leadDashboard.refetch(); if (scope === "coders" && coderOptions.length) void coderDetails.refetch(); }
    : isTeamView ? teamDashboard.refetch : efficiency.refetch;
  const loading = !summary || (isLead && (leadDashboard.isFetching && !leadDashboard.currentData
    || scope === "coders" && coderOptions.length > 0 && !coderDetails.currentData));
  return (
    <section className="report-overview flex min-w-0 flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-content-primary">{isTeamView ? "Team source comparison" : "Your source comparison"}</h2>
        <p className="text-sm text-content-muted">{view === "trends" ? "Production above CPD, with a shared timeline and consistent source colors." : "Daily production and capacity for the selected period. Switch to Trends to explore changes over time."}</p>
      </div>
      {isLead && <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {scope === "coders" && <SearchableMultiSelect label="Coders" noun="coders"
          options={coderOptions.map(coder => ({value: String(coder.userId), label: coder.name}))}
          value={coderIds} onChange={setSelectedCoderIds} />}
        <PerformanceTabs value={scope} onChange={setScope} compact
          items={[{value: "qa", label: "QA"}, {value: "coders", label: "Coders"}]}
          label="Reports data scope" />
      </div>}
      {error ? <ErrorState message={getErrorMessage(error)} onRetry={refetch} /> : loading || !summary
        ? <LoadingState label="Building daily overview…" /> : <>
          <div className="grid gap-3 sm:grid-cols-3">
            <CpdCard label="Kairon CPD" value={summary.kaironCpd} achievement={achievement(summary.kaironCpd, summary.targetCpd)} />
            <CpdCard label="Manual CPD" value={summary.manualCpd} achievement={achievement(summary.manualCpd, summary.targetCpd)} />
            <CpdCard label="Target CPD" value={summary.targetCpd} />
          </div>
          <ReportGraphs sources={sources} from={from} to={to} teamView={isTeamView || isLead && scope === "coders"} stackedComparison overviewView={view} onViewChange={onViewChange} records={<DailyComparisonRecords sources={sources} from={from} to={to} />} />
        </>}
    </section>
  );
}

function CpdCard({ label, value, achievement: achievementValue }: { label: string; value: string | null; achievement?: number | null }) {
  return (
    <article data-metric={metricIdentity(label)} className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <p data-metric={metricIdentity(label)} className="metric-label text-sm">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p data-metric={metricIdentity(label)} className="metric-value text-2xl font-semibold tracking-tight">{formatCpd(value)}</p>
        {achievementValue != null && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${achievementValue >= 100 ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>
            {displayNumber(achievementValue)}% of target
          </span>
        )}
      </div>
    </article>
  );
}


function DailyComparisonRecords({ sources, from, to }: { sources: DailyEfficiency[][]; from: string; to: string }) {
  const [page, setPage] = useState(1);
  const rows = useMemo(() => buildReportChartRows(sources, from, to, "day").filter((row) => row.kairon !== null || row.manual !== null).reverse(), [sources, from, to]);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const format = displayNumber;
  const totals = metricTotals(sources.flat().filter(row => row.date >= from && row.date <= to));
  if (!rows.length) return <EmptyState title="No daily comparison records for this period" />;
  return (
    <section className="comparison-records overflow-hidden rounded-xl border border-border bg-surface shadow-card" aria-label="Daily source comparison">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-content-primary">Daily production</h3>
        <span className="text-xs text-content-muted">{rows.length} reporting days · Latest first</span>
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Daily production records">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-surface-muted text-xs text-content-muted">
            <tr>{["Date", "Kairon", "Manual", "Adjusted goal", "Kairon CPD", "Manual CPD", "Lost hours"].map((label, index) => <th data-metric={metricIdentity(label)} scope="col" key={label} className={`px-4 py-3 font-medium ${index ? "text-right" : ""}`}>{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => <tr key={row.date} className="hover:bg-surface-muted/60">
              <th scope="row" className="px-4 py-3 font-medium text-content-primary">{row.date}</th>
              <td data-metric="kairon" className="metric-value px-4 py-3 text-right font-semibold tabular-nums text-content-primary">{format(row.kairon)}</td>
              <td data-metric="manual" className="metric-value px-4 py-3 text-right tabular-nums text-content-secondary">{format(row.manual)}</td>
              <td data-metric="adjusted" className="metric-value px-4 py-3 text-right tabular-nums text-content-secondary">{format(row.adjusted)}</td>
              <td data-metric="kairon" className="metric-value px-4 py-3 text-right tabular-nums text-content-secondary">{displayCpd(row.kaironCpd)}</td>
              <td data-metric="manual" className="metric-value px-4 py-3 text-right tabular-nums text-content-secondary">{displayCpd(row.manualCpd)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-content-secondary">{format(row.idle + row.downtime + row.meeting)}h</td>
            </tr>)}
          </tbody>
          <tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr><th scope="row" className="px-4 py-3">Total · all days</th>
            <td data-metric="kairon" className="metric-value px-4 py-3 text-right">{format(totals.kaironCharts)}</td>
            <td data-metric="manual" className="metric-value px-4 py-3 text-right">{format(totals.manualCharts)}</td>
            <td data-metric="adjusted" className="metric-value px-4 py-3 text-right">{format(rows.reduce((sum,row) => sum + (row.adjusted ?? 0),0))}</td>
            <td data-metric="kairon" className="metric-value px-4 py-3 text-right">{displayCpd(totals.kaironCpd)}</td>
            <td data-metric="manual" className="metric-value px-4 py-3 text-right">{displayCpd(totals.manualCpd)}</td>
            <td className="px-4 py-3 text-right">{format(rows.reduce((sum,row) => sum + row.idle + row.downtime + row.meeting,0))}h</td>
          </tr></tfoot>
        </table>
      </div>
      <PaginationControls page={currentPage} pageSize={pageSize} total={rows.length} totalPages={totalPages} onPageChange={setPage} />
    </section>
  );
}
