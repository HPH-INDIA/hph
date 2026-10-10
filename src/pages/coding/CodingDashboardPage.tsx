import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { metricTotals } from "@/pages/performance/metricTotals";
import { displayNumber, displayCpd } from "@/utils/displayNumber";
import { metricIdentity } from "@/components/ui/metricIdentity";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { numericSortValue, sortTableRows, type SortColumn, type TableSort } from "@/components/ui/tableSort";
import { useMemo, useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetTeamCoderOverviewQuery, useListTeamCohortsQuery } from "@/api/cohortsApi";
import { useGetCodingDashboardQuery } from "@/api/reportsApi";
import type { CoderStageFilter, CodingDashboardCard, CodingDashboardQuery } from "@/api/types";
import { useListUsersQuery } from "@/api/usersApi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { TeamPerformanceGraphs } from "@/pages/reports/ReportsOverviewTab";

type DateMode = "from_start" | "day" | "month" | "year" | "range";
type Program = "ALL" | "PVP" | "FOUNDATION";
type TableStageFilter = "ALL" | CoderStageFilter;
type CoderEfficiencyView = "graph" | "list";

const CODER_PAGE_SIZE = 8;

const CODER_STAGES: CoderStageFilter[] = ["Training", "M1", "M2", "M3", "M4", "Steady State", "Unassigned"];

interface DashboardFilters {
  dateMode: DateMode;
  day: string;
  month: string;
  year: number;
  rangeStart: string;
  rangeEnd: string;
  program: Program;
  cohortId: "ALL" | number;
  leadId: "ALL" | number;
}

const inputClassName =
  "h-10 rounded-md border border-border bg-surface px-3 text-sm text-content-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// During a rolling backend/frontend deployment, older dashboard responses do
// not contain isActive. Treat an omitted value as active until the new backend
// contract is serving.
function isCardActive(card: CodingDashboardCard) {
  return card.isActive !== false;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function aprilStartValue(today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return `${month >= 4 ? year : year - 1}-04-01`;
}

function loadPeriodPreference(key: string, fallback: Pick<DashboardFilters, "dateMode" | "day" | "month" | "year" | "rangeStart" | "rangeEnd">) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<typeof fallback>;
    const validModes: DateMode[] = ["from_start", "day", "month", "year", "range"];
    if (!parsed.dateMode || !validModes.includes(parsed.dateMode)) return fallback;
    return {
      dateMode: parsed.dateMode,
      day: typeof parsed.day === "string" ? parsed.day : fallback.day,
      month: typeof parsed.month === "string" ? parsed.month : fallback.month,
      year: typeof parsed.year === "number" ? parsed.year : fallback.year,
      rangeStart: typeof parsed.rangeStart === "string" ? parsed.rangeStart : fallback.rangeStart,
      rangeEnd: typeof parsed.rangeEnd === "string" ? parsed.rangeEnd : fallback.rangeEnd,
    };
  } catch {
    return fallback;
  }
}

function savePeriodPreference(key: string, filters: DashboardFilters) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        dateMode: filters.dateMode,
        day: filters.day,
        month: filters.month,
        year: filters.year,
        rangeStart: filters.rangeStart,
        rangeEnd: filters.rangeEnd,
      }),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser sessions.
  }
}

function formatNumber(value: number) {
  return displayNumber(value);
}

function MetricIcon({ kind }: { kind: "charts" | "downtime" }) {
  return kind === "charts" ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 20V10m7 10V4m7 16v-7" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" strokeLinecap="round" />
    </svg>
  );
}

function GraphViewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19V9m6 10V5m6 14v-7m4 7V8" strokeLinecap="round" />
    </svg>
  );
}

function ListViewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const efficiencyColumns: SortColumn<CodingDashboardCard>[] = [
  { key: "name", label: "Coder", value: (card) => `${card.firstName} ${card.lastName}` },
  ...([
    ["kaironCharts", "Kairon charts"], ["manualCharts", "Manual charts"], ["adjustedTarget", "Adjusted target"],
    ["productiveMinutes", "Productive hours"], ["calculatedDays", "Days"], ["kaironEfficiencyPercent", "Kairon efficiency"],
    ["manualEfficiencyPercent", "Manual efficiency"], ["kaironCpd", "Kairon CPD"], ["manualCpd", "Manual CPD"], ["targetCpd", "Target CPD"],
  ] as const).map(([key, label]) => ({ key, label, value: (card: CodingDashboardCard) => numericSortValue(card.efficiency[key]), defaultDirection: "desc" as const })),
];

export function CodingDashboardPage() {
  const [tablePage, setTablePage] = useState(1);
  const [tableSort, setTableSort] = useState<TableSort>({ key: "name", direction: "asc" });
  const { user } = useAuth();
  const today = localDateValue();
  const currentMonth = today.slice(0, 7);
  const currentYear = Number(today.slice(0, 4));
  const fiscalStart = aprilStartValue(today);
  const periodCacheKey = `hph-dashboard-period:${user?.id ?? "anonymous"}`;
  const defaultPeriod = {
    dateMode: "month" as DateMode,
    day: today,
    month: currentMonth,
    year: currentYear,
    rangeStart: `${currentMonth}-01`,
    rangeEnd: today,
  };
  const cachedPeriod = loadPeriodPreference(periodCacheKey, defaultPeriod);
  const [dateMode, setDateMode] = useState<DateMode>(cachedPeriod.dateMode);
  const [day, setDay] = useState(cachedPeriod.day);
  const [month, setMonth] = useState(cachedPeriod.month);
  const [year, setYear] = useState(cachedPeriod.year);
  const [rangeStart, setRangeStart] = useState(cachedPeriod.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(cachedPeriod.rangeEnd);
  const [program, setProgram] = useState<Program>("ALL");
  const [cohortId, setCohortId] = useState<"ALL" | number>("ALL");
  const [leadId, setLeadId] = useState<"ALL" | number>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tableUserIds, setTableUserIds] = useState<number[] | null>(null);
  const [tableLeadId, setTableLeadId] = useState<"ALL" | number>("ALL");
  const [tableCohortId, setTableCohortId] = useState<"ALL" | number>("ALL");
  const [tableStage, setTableStage] = useState<TableStageFilter>("ALL");
  const [coderEfficiencyView, setCoderEfficiencyView] = useState<CoderEfficiencyView>("list");
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>({
    ...cachedPeriod,
    program: "ALL",
    cohortId: "ALL",
    leadId: "ALL",
  });

  const query = useMemo<CodingDashboardQuery>(() => {
    const next: CodingDashboardQuery = { includeDaily: true };
    if (dateMode === "from_start") {
      next.from = fiscalStart;
      next.to = today;
    }
    if (dateMode === "day") next.date = day;
    if (dateMode === "month") next.month = month;
    if (dateMode === "year") next.year = year;
    if (dateMode === "range") {
      next.from = rangeStart;
      next.to = rangeEnd;
    }
    if (program !== "ALL") next.program = program;
    if (cohortId !== "ALL") next.cohortId = cohortId;
    if (leadId !== "ALL") next.leadId = leadId;
    return next;
  }, [cohortId, dateMode, day, fiscalStart, leadId, month, program, rangeEnd, rangeStart, today, year]);

  const dashboard = useGetCodingDashboardQuery(query);
  const cohorts = useListTeamCohortsQuery();
  const users = useListUsersQuery("active");
  const coderOverview = useGetTeamCoderOverviewQuery({ page: 1, pageSize: 100 });
  const leads = useMemo(
    () =>
      (users.data ?? [])
        .filter((user) => user.role.roleType === "lead")
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [users.data],
  );
  const coderMetadata = useMemo(
    () => new Map((coderOverview.data?.items ?? []).map((item) => [item.coder.id, item])),
    [coderOverview.data],
  );
  const coderOptions = useMemo(
    () =>
      [...(dashboard.data ?? [])].sort((a, b) =>
        Number(isCardActive(b)) - Number(isCardActive(a)) ||
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
      ),
    [dashboard.data],
  );
  const filteredCoderCards = useMemo(() => {
    return (dashboard.data ?? []).filter((card) => {
      const metadata = coderMetadata.get(card.userId);
      const currentStage = metadata?.currentStage ?? "Unassigned";
      const matchesUser = tableUserIds === null || tableUserIds.includes(card.userId);
      const matchesLead = tableLeadId === "ALL" || card.leadId === tableLeadId || metadata?.lead?.id === tableLeadId || card.userId === tableLeadId;
      const matchesCohort = tableCohortId === "ALL" || metadata?.cohort?.id === tableCohortId;
      const matchesStage = tableStage === "ALL" || currentStage === tableStage;
      return matchesUser && matchesLead && matchesCohort && matchesStage;
    }).sort((a, b) =>
      Number(isCardActive(b)) - Number(isCardActive(a)) ||
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );
  }, [coderMetadata, dashboard.data, tableCohortId, tableLeadId, tableStage, tableUserIds]);
  const tableMetricTotals = metricTotals(filteredCoderCards.map(card => card.efficiency));
  const sortedCoderCards = sortTableRows(filteredCoderCards, efficiencyColumns, tableSort);
  const totalCoderPages = Math.max(1, Math.ceil(sortedCoderCards.length / CODER_PAGE_SIZE));
  const currentCoderPage = Math.min(tablePage, totalCoderPages);
  const visibleCoderCards = sortedCoderCards.slice((currentCoderPage - 1) * CODER_PAGE_SIZE, currentCoderPage * CODER_PAGE_SIZE);
  const tableFilterCount =
    Number(tableUserIds !== null) +
    Number(tableLeadId !== "ALL") +
    Number(tableCohortId !== "ALL") +
    Number(tableStage !== "ALL");

  const clearTableFilters = () => {
    setTablePage(1);
    setTableUserIds(null);
    setTableLeadId("ALL");
    setTableCohortId("ALL");
    setTableStage("ALL");
  };

  const totals = useMemo(
    () =>
      (dashboard.data ?? []).reduce(
        (result, card) => ({
          kairon: result.kairon + card.kairon.completed,
          manual: result.manual + card.manual.productionCount,
          downtime: result.downtime + Number(card.manual.techIssuesDowntimeHours),
          idle: result.idle + Number(card.manual.noInventoryIdleTimeHours),
          meeting: result.meeting + Number(card.manual.meetingEngagementHours),
          reportingDays: result.reportingDays + (card.manual.recordCount ?? 0),
          manualEfficiencyCharts: result.manualEfficiencyCharts + card.efficiency.manualCharts,
          kaironEfficiencyCharts: result.kaironEfficiencyCharts + card.efficiency.kaironCharts,
          adjustedTarget: result.adjustedTarget + Number(card.efficiency.adjustedTarget),
          calculatedDays: result.calculatedDays + card.efficiency.calculatedDays,
          insideMinutes: result.insideMinutes + card.efficiency.insideMinutes,
          loginDays: result.loginDays + card.efficiency.loginDays,
          productiveMinutes: result.productiveMinutes + card.efficiency.productiveMinutes,
          targetMinutes: result.targetMinutes + card.efficiency.targetMinutes,
        }),
        {
          kairon: 0,
          manual: 0,
          downtime: 0,
          idle: 0,
          meeting: 0,
          reportingDays: 0,
          manualEfficiencyCharts: 0,
          kaironEfficiencyCharts: 0,
          adjustedTarget: 0,
          calculatedDays: 0,
          insideMinutes: 0,
          loginDays: 0,
          productiveMinutes: 0,
          targetMinutes: 0,
        },
      ),
    [dashboard.data],
  );

  const chartDifference = totals.kairon - totals.manual;
  const averageDenominator = totals.loginDays || totals.reportingDays;
  const averageInside = averageDenominator ? totals.insideMinutes / 60 / averageDenominator : 0;
  const averageProductive = averageDenominator ? totals.productiveMinutes / 60 / averageDenominator : 0;
  const averageDowntime = averageDenominator ? totals.downtime / averageDenominator : 0;
  const averageIdle = averageDenominator ? totals.idle / averageDenominator : 0;
  const averageMeeting = averageDenominator ? totals.meeting / averageDenominator : 0;
  const teamManualEfficiency = totals.adjustedTarget
    ? Math.min(120, (totals.manualEfficiencyCharts / totals.adjustedTarget) * 100)
    : null;
  const teamKaironEfficiency = totals.adjustedTarget
    ? Math.min(120, (totals.kaironEfficiencyCharts / totals.adjustedTarget) * 100)
    : null;
  const teamManualCpd = totals.targetMinutes
    ? totals.manualEfficiencyCharts * 480 / totals.targetMinutes
    : null;
  const teamKaironCpd = totals.targetMinutes
    ? totals.kaironEfficiencyCharts * 480 / totals.targetMinutes
    : null;
  const teamTargetCpd = totals.targetMinutes
    ? totals.adjustedTarget * 480 / totals.targetMinutes
    : null;
  const periodLabel =
    dateMode === "from_start"
      ? `From ${new Date(`${fiscalStart}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : dateMode === "day"
      ? new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { dateStyle: "long" })
      : dateMode === "month"
        ? new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : dateMode === "year"
          ? String(year)
          : `${new Date(`${rangeStart}T00:00:00`).toLocaleDateString()} – ${new Date(`${rangeEnd}T00:00:00`).toLocaleDateString()}`;
  const cohortLabel = cohortId === "ALL" ? null : cohorts.data?.find((cohort) => cohort.id === cohortId)?.label ?? "Selected cohort";
  const lead = leadId === "ALL" ? null : leads.find((candidate) => candidate.id === leadId);
  const leadLabel = lead ? `${lead.first_name} ${lead.last_name}` : leadId === "ALL" ? null : "Selected lead";
  const activeFilterCount =
    Number(dateMode !== "month" || month !== currentMonth) +
    Number(program !== "ALL") +
    Number(cohortId !== "ALL") +
    Number(leadId !== "ALL");

  const openFilters = () => {
    setDraftFilters({ dateMode, day, month, year, rangeStart, rangeEnd, program, cohortId, leadId });
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setTablePage(1);
    setDateMode(draftFilters.dateMode);
    setDay(draftFilters.day);
    setMonth(draftFilters.month);
    setYear(draftFilters.year);
    setRangeStart(draftFilters.rangeStart);
    setRangeEnd(draftFilters.rangeEnd);
    setProgram(draftFilters.program);
    setCohortId(draftFilters.cohortId);
    setLeadId(draftFilters.leadId);
    savePeriodPreference(periodCacheKey, draftFilters);
    setFiltersOpen(false);
  };

  const resetDraftFilters = () => {
    setDraftFilters({
      dateMode: "month",
      day: today,
      month: currentMonth,
      year: currentYear,
      rangeStart: `${currentMonth}-01`,
      rangeEnd: today,
      program: "ALL",
      cohortId: "ALL",
      leadId: "ALL",
    });
  };

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Coding operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-content-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-content-muted">Kairon and Manual production overview for {periodLabel}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:max-w-2xl xl:justify-end">
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800">{periodLabel}</span>
          {program !== "ALL" && <span className="rounded-full bg-surface-inset px-3 py-1.5 text-xs text-content-secondary">Program: {program}</span>}
          {cohortLabel && <span className="rounded-full bg-surface-inset px-3 py-1.5 text-xs text-content-secondary">Cohort: {cohortLabel}</span>}
          {leadLabel && <span className="rounded-full bg-surface-inset px-3 py-1.5 text-xs text-content-secondary">Lead: {leadLabel}</span>}
          <Button type="button" variant="secondary" onClick={openFilters}>
            <span className="flex items-center gap-2"><FilterIcon /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
          </Button>
        </div>
      </section>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Dashboard filters"
        description="Choose a reporting period and narrow the team results. Changes apply together."
        widthClass="max-w-md"
      >
        <div className="flex min-h-full flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface-muted/60 p-4">
            <h3 className="text-sm font-semibold text-content-primary">Period</h3>
            <p className="mb-4 mt-1 text-xs text-content-muted">Date type and value are grouped into one filter.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Filter label="View by">
                <select
                  value={draftFilters.dateMode}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, dateMode: event.target.value as DateMode }))}
                  className={inputClassName}
                >
                  <option value="from_start">From start (April 1)</option>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="range">Date range</option>
                </select>
              </Filter>
              {draftFilters.dateMode === "day" && (
                <Filter label="Day">
                  <input type="date" max={today} value={draftFilters.day} onChange={(event) => setDraftFilters((current) => ({ ...current, day: event.target.value || today }))} className={inputClassName} />
                </Filter>
              )}
              {draftFilters.dateMode === "month" && (
                <Filter label="Month">
                  <input type="month" max={currentMonth} value={draftFilters.month} onChange={(event) => setDraftFilters((current) => ({ ...current, month: event.target.value || currentMonth }))} className={inputClassName} />
                </Filter>
              )}
              {draftFilters.dateMode === "year" && (
                <Filter label="Year">
                  <input type="number" min={2000} max={currentYear} value={draftFilters.year} onChange={(event) => setDraftFilters((current) => ({ ...current, year: Number(event.target.value) || currentYear }))} className={inputClassName} />
                </Filter>
              )}
              {draftFilters.dateMode === "range" && (
                <>
                  <Filter label="From">
                    <input type="date" max={draftFilters.rangeEnd || today} value={draftFilters.rangeStart} onChange={(event) => setDraftFilters((current) => ({ ...current, rangeStart: event.target.value || `${currentMonth}-01` }))} className={inputClassName} />
                  </Filter>
                  <Filter label="To">
                    <input type="date" min={draftFilters.rangeStart} max={today} value={draftFilters.rangeEnd} onChange={(event) => setDraftFilters((current) => ({ ...current, rangeEnd: event.target.value || today }))} className={inputClassName} />
                  </Filter>
                </>
              )}
              {draftFilters.dateMode === "from_start" && (
                <p className="self-end text-xs leading-5 text-content-muted">
                  Includes data from April 1 through today.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Team filters</h3>
              <p className="mt-1 text-xs text-content-muted">All options are inclusive unless you select a specific value.</p>
            </div>
            <Filter label="Program">
              <select value={draftFilters.program} onChange={(event) => setDraftFilters((current) => ({ ...current, program: event.target.value as Program }))} className={inputClassName}>
                <option value="ALL">All programs</option>
                <option value="PVP">PVP</option>
                <option value="FOUNDATION">Foundation</option>
              </select>
            </Filter>
            <Filter label="Cohort">
              <select
                value={draftFilters.cohortId}
                onChange={(event) => setDraftFilters((current) => ({ ...current, cohortId: event.target.value === "ALL" ? "ALL" : Number(event.target.value) }))}
                className={inputClassName}
                disabled={cohorts.isLoading || Boolean(cohorts.error)}
              >
                <option value="ALL">All cohorts</option>
                {(cohorts.data ?? []).map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
              </select>
            </Filter>
            <Filter label="Lead">
              <select value={draftFilters.leadId} onChange={(event) => setDraftFilters((current) => ({ ...current, leadId: event.target.value === "ALL" ? "ALL" : Number(event.target.value) }))} className={inputClassName}>
                <option value="ALL">All leads</option>
                {leads.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name}</option>)}
              </select>
            </Filter>
          </section>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="ghost" onClick={resetDraftFilters}>Reset all</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button>
              <Button type="button" onClick={applyFilters}>Apply filters</Button>
            </div>
          </div>
        </div>
      </Drawer>

      {program !== "ALL" && (
        <p className="rounded-md border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs text-brand-800">
          Program applies to both Kairon and Manual chart counts. Time and attendance metrics remain unchanged.
        </p>
      )}

      {dashboard.isLoading ? (
        <LoadingState label="Loading the dashboard…" />
      ) : dashboard.error ? (
        <ErrorState message={getErrorMessage(dashboard.error)} onRetry={dashboard.refetch} />
      ) : (
        <div className="flex flex-col gap-3">
          <article className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-content-secondary">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><MetricIcon kind="charts" /></span>
                  <h2 className="text-sm font-semibold">Chart production</h2>
                </div>
                <p className="mt-1 text-xs text-content-muted">Total charts in the selected period</p>
              </div>
              <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-medium text-content-secondary">{dashboard.data?.length ?? 0} people</span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <ProductionMetric label="Kairon charts" value={totals.kairon} />
              <ProductionMetric label="Manual charts" value={totals.manual} />
              <ProductionMetric label="Kairon − Manual" value={chartDifference} />
            </div>
          </article>

          <details className="rounded-xl border border-border bg-surface">
            <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-content-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">Summary details · Hours, efficiency and CPD</summary>
            <div className="grid gap-3 border-t border-border p-3 md:grid-cols-3">
          <article className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-content-secondary">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-bg text-warning"><MetricIcon kind="downtime" /></span>
              <h2 className="text-sm font-semibold">Productive hours</h2>
            </div>
            <WorkingHoursDonut
              inside={averageInside}
              productive={averageProductive}
              downtime={averageDowntime}
              meeting={averageMeeting}
              idle={averageIdle}
            />
          </article>

          <article className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-content-secondary">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-bg text-success"><MetricIcon kind="charts" /></span>
              <h2 className="text-sm font-semibold">Team efficiency</h2>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-3 py-3">
              <EfficiencyMetric label="Kairon" value={teamKaironEfficiency} />
              <EfficiencyMetric label="Manual" value={teamManualEfficiency} />
              <p className="text-xs text-content-muted">Weighted for the selected period</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <SmallMetric label="Adjusted target" value={totals.adjustedTarget.toFixed(0)} />
              <SmallMetric label="Calculated days" value={formatNumber(totals.calculatedDays)} />
            </div>
          </article>

          <article className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-content-secondary">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><MetricIcon kind="charts" /></span>
              <h2 className="text-sm font-semibold">Team CPD</h2>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-3 py-3">
              <EfficiencyMetric label="Kairon CPD" value={teamKaironCpd} suffix="" />
              <EfficiencyMetric label="Manual CPD" value={teamManualCpd} suffix="" />
              <EfficiencyMetric label="Target CPD" value={teamTargetCpd} suffix="" />
              <p className="text-xs text-content-muted">Charts normalized to the Daily Refresh 8-hour basis</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <SmallMetric label="Productive hours" value={(totals.productiveMinutes / 60).toFixed(0)} />
              <SmallMetric label="Calculated days" value={formatNumber(totals.calculatedDays)} />
            </div>
          </article>
            </div>
          </details>
        </div>
      )}

      {!dashboard.isLoading && !dashboard.error && (dashboard.data?.length ?? 0) > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-content-primary">Coder efficiency</h2>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    {filteredCoderCards.length} {filteredCoderCards.length === 1 ? "coder" : "coders"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-content-muted">Compare Kairon and Manual across the filtered team.</p>
              </div>
              <div className="flex items-center gap-2">
                {tableFilterCount > 0 && (
                  <Button type="button" variant="ghost" onClick={clearTableFilters}>
                    Clear {tableFilterCount} {tableFilterCount === 1 ? "filter" : "filters"}
                  </Button>
                )}
                <div className="inline-flex rounded-lg border border-border bg-surface-muted p-1" role="group" aria-label="Coder efficiency view">
                  <button
                    type="button"
                    onClick={() => setCoderEfficiencyView("graph")}
                    className={`flex h-9 w-9 items-center justify-center rounded-md transition ${coderEfficiencyView === "graph" ? "bg-surface text-brand-700 shadow-sm" : "text-content-muted hover:text-content-primary"}`}
                    aria-label="Show graph view"
                    title="Graph view"
                    aria-pressed={coderEfficiencyView === "graph"}
                  >
                    <GraphViewIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoderEfficiencyView("list")}
                    className={`flex h-9 w-9 items-center justify-center rounded-md transition ${coderEfficiencyView === "list" ? "bg-surface text-brand-700 shadow-sm" : "text-content-muted hover:text-content-primary"}`}
                    aria-label="Show list view"
                    title="List view"
                    aria-pressed={coderEfficiencyView === "list"}
                  >
                    <ListViewIcon />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3"><SearchableMultiSelect label="Users" noun="users" value={(tableUserIds ?? coderOptions.map(candidate => candidate.userId)).map(String)}
              options={coderOptions.map(candidate => ({value:String(candidate.userId),label:`${candidate.firstName} ${candidate.lastName}`}))}
              onChange={ids => {setTableUserIds(ids.map(Number));setTablePage(1);}} /></div>
            <details className="mt-3 rounded-lg border border-border bg-surface-muted/50">
              <summary className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-content-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">Filter coders{tableFilterCount > 0 ? ` (${tableFilterCount} active)` : ""}</summary>
            <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-4">
              <Filter label="Lead">
                <select
                  value={tableLeadId}
                  onChange={(event) => { setTableLeadId(event.target.value === "ALL" ? "ALL" : Number(event.target.value)); setTablePage(1); }}
                  className={`${inputClassName} w-full`}
                >
                  <option value="ALL">All leads</option>
                  {leads.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name}</option>)}
                </select>
              </Filter>
              <Filter label="Cohort">
                <select
                  value={tableCohortId}
                  onChange={(event) => { setTableCohortId(event.target.value === "ALL" ? "ALL" : Number(event.target.value)); setTablePage(1); }}
                  className={`${inputClassName} w-full`}
                  disabled={cohorts.isLoading || Boolean(cohorts.error)}
                >
                  <option value="ALL">All cohorts</option>
                  {(cohorts.data ?? []).map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
                </select>
              </Filter>
              <Filter label="Current stage">
                <select
                  value={tableStage}
                  onChange={(event) => { setTableStage(event.target.value as TableStageFilter); setTablePage(1); }}
                  className={`${inputClassName} w-full`}
                >
                  <option value="ALL">All stages</option>
                  {CODER_STAGES.map((stage) => <option key={stage} value={stage}>{stage === "Unassigned" ? "No current stage" : stage}</option>)}
                </select>
              </Filter>
            </div>
            </details>
          </div>
          {coderEfficiencyView === "graph" ? (
            <TeamPerformanceGraphs cards={filteredCoderCards} />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                <tr>
                  {efficiencyColumns.map((column) => <SortableHeader key={column.key} column={column} sort={tableSort} onSort={(nextSort) => { setTableSort(nextSort); setTablePage(1); }} className="px-4 py-3 font-medium" />)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleCoderCards.map((card) => {
                  const manualPercent = card.efficiency.manualEfficiencyPercent === null ? null : Number(card.efficiency.manualEfficiencyPercent);
                  const kaironPercent = card.efficiency.kaironEfficiencyPercent === null ? null : Number(card.efficiency.kaironEfficiencyPercent);
                  const metadata = coderMetadata.get(card.userId);
                  return (
                    <tr key={card.userId} className={isCardActive(card) ? undefined : "bg-surface-muted/70"}>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${isCardActive(card) ? "text-content-primary" : "text-content-secondary"}`}>
                            {card.firstName} {card.lastName}
                          </span>
                          {!isCardActive(card) && <Badge tone="neutral">Inactive</Badge>}
                        </div>
                        {!isCardActive(card) && card.lastWorkingDay && (
                          <div className="mt-1 text-xs text-content-muted">Last working day: {card.lastWorkingDay}</div>
                        )}
                        <div className="mt-2">
                          <StageBadge stage={metadata?.currentStage ?? null} />
                        </div>
                      </td>
                      <td data-metric="kairon" className="metric-value px-4 py-3 text-content-secondary">{card.efficiency.kaironCharts}</td>
                      <td data-metric="manual" className="metric-value px-4 py-3 text-content-secondary">{card.efficiency.manualCharts}</td>
                      <td data-metric="adjusted" className="metric-value px-4 py-3 text-content-secondary">{Number(card.efficiency.adjustedTarget).toFixed(0)}</td>
                      <td className="px-4 py-3 text-content-secondary">{(card.efficiency.productiveMinutes / 60).toFixed(0)}</td>
                      <td className="px-4 py-3 text-content-secondary">{card.efficiency.calculatedDays}</td>
                      <td className={`px-4 py-3 font-semibold ${kaironPercent !== null && kaironPercent >= 100 ? "text-success" : "text-content-primary"}`}>
                        {kaironPercent === null ? "—" : `${Math.round(kaironPercent)}%`}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${manualPercent !== null && manualPercent >= 100 ? "text-success" : "text-content-primary"}`}>
                        {manualPercent === null ? "—" : `${Math.round(manualPercent)}%`}
                      </td>
                      <td data-metric="kairon" className="metric-value px-4 py-3 font-semibold text-content-primary">{card.efficiency.kaironCpd === null ? "—" : displayCpd(card.efficiency.kaironCpd)}</td>
                      <td data-metric="manual" className="metric-value px-4 py-3 font-semibold text-content-primary">{card.efficiency.manualCpd === null ? "—" : displayCpd(card.efficiency.manualCpd)}</td>
                      <td data-metric="target" className="metric-value px-4 py-3 font-semibold text-content-primary">{card.efficiency.targetCpd === null ? "—" : displayCpd(card.efficiency.targetCpd)}</td>
                    </tr>
                  );
                })}
                {filteredCoderCards.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center">
                      <p className="font-medium text-content-primary">No coders match these table filters</p>
                      <p className="mt-1 text-sm text-content-muted">Try another user, lead, cohort, or stage.</p>
                      <Button type="button" variant="ghost" onClick={clearTableFilters} className="mt-3">Clear filters</Button>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr><th scope="row" className="px-4 py-3">Total · all matching coders</th>
                <td className="px-4 py-3">{displayNumber(tableMetricTotals.kaironCharts)}</td><td className="px-4 py-3">{displayNumber(tableMetricTotals.manualCharts)}</td>
                <td className="px-4 py-3">{displayNumber(filteredCoderCards.reduce((sum,card) => sum + Number(card.efficiency.adjustedTarget),0))}</td>
                <td className="px-4 py-3">{displayNumber(filteredCoderCards.reduce((sum,card) => sum + card.efficiency.productiveMinutes,0)/60)}</td>
                <td className="px-4 py-3">{displayNumber(filteredCoderCards.reduce((sum,card) => sum + card.efficiency.calculatedDays,0))}</td>
                {(["kaironEfficiencyPercent","manualEfficiencyPercent"] as const).map(key => <td key={key} className="px-4 py-3">{displayNumber(tableMetricTotals[key])}{tableMetricTotals[key] != null ? "%" : ""}</td>)}
                {(["kaironCpd","manualCpd","targetCpd"] as const).map(key => <td key={key} className="px-4 py-3">{displayCpd(tableMetricTotals[key])}</td>)}
              </tr></tfoot>
            </table>
          </div>
          <PaginationControls page={currentCoderPage} pageSize={CODER_PAGE_SIZE} total={sortedCoderCards.length} totalPages={totalCoderPages} onPageChange={setTablePage} />
          </>
          )}
        </section>
      )}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="text-xs font-medium text-content-secondary">{label}</span>{children}</label>;
}

function StageBadge({ stage }: { stage: string | null }) {
  const tone =
    stage === "Steady State" || stage === "M4"
      ? "success"
      : stage === "Training" || stage === "M3"
        ? "warning"
        : stage === "M1" || stage === "M2"
          ? "brand"
          : "neutral";
  return <Badge tone={tone}>{stage ?? "No current stage"}</Badge>;
}

function ProductionMetric({ label, value, wide = false }: { label: string; value: number; wide?: boolean }) {
  return (
    <div data-metric={metricIdentity(label)} className={`metric-block rounded-lg border border-border bg-surface-muted px-4 py-3 ${wide ? "sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:gap-4" : ""}`}>
      <p className="text-xs font-medium text-content-muted">{label}</p>
      <p className={`${wide ? "mt-1 sm:mt-0" : "mt-2"} text-3xl font-semibold tracking-tight text-content-primary`}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div data-metric={metricIdentity(label)} className="metric-block"><p className="text-xs text-content-muted">{label}</p><p className="mt-1 text-sm font-semibold text-content-primary">{value}</p></div>;
}

function EfficiencyMetric({ label, value, suffix = "%" }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div data-metric={metricIdentity(label)} className="metric-block flex items-end justify-between gap-3">
      <span className="text-sm text-content-muted">{label}</span>
      <span className={`text-2xl font-semibold tracking-tight ${value !== null && value >= 100 ? "text-success" : "text-content-primary"}`}>
        {value === null ? "—" : `${label.includes("CPD") ? displayCpd(value) : displayNumber(value)}${suffix}`}
      </span>
    </div>
  );
}

function WorkingHoursDonut({
  inside,
  productive,
  downtime,
  meeting,
  idle,
}: {
  inside: number;
  productive: number;
  downtime: number;
  meeting: number;
  idle: number;
}) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(productive / 8, 0), 1);

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 py-4">
      <div className="relative mx-auto h-36 w-36" aria-label={`Average productive time ${productive.toFixed(0)} hours of an eight-hour workday`}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-surface-inset)" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--color-chart-productive)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-semibold text-content-primary">{productive.toFixed(0)}h</span>
        </div>
      </div>
      <div className="grid gap-2 border-t border-border pt-4 text-xs">
        <HourStat colorClass="bg-chart-productive" label="Avg inside time" value={inside} />
        <HourStat colorClass="bg-chart-downtime" label="Avg downtime" value={downtime} />
        <HourStat colorClass="bg-chart-idle" label="Avg idle time" value={idle} />
        <HourStat colorClass="bg-chart-meeting" label="Avg meeting time" value={meeting} />
      </div>
    </div>
  );
}

function HourStat({ colorClass, label, value }: { colorClass: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorClass}`} />
      <span className="text-content-secondary">{label}</span>
      <span className="ml-auto font-semibold text-content-primary">{value.toFixed(0)}h</span>
    </div>
  );
}
