import { useId, useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetLeadDashboardQuery } from "@/api/reportsApi";
import type { LeadDashboardSummary, LeadPerformanceSection, PeriodGoalSummary } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { DailyPerformance } from "./DailyPerformance";
import { PerformanceSummary } from "./PerformanceSummary";
import { chartLabel, numberLabel } from "./performanceView";
import { dateRangeLabel, defaultLeadFilters, leadDashboardQuery, leadFilterError, leadPeriodLabel, loadLeadFilters, localDayValue, saveLeadFilters, type LeadDateMode, type LeadFilters } from "./leadFilters";

const inputClass = "h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-content-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function LeadDashboardPage() {
  const { user } = useAuth();
  const today = localDayValue();
  const preferenceKey = `hph-lead-dashboard-period:${user?.id ?? "anonymous"}`;
  const [filters, setFilters] = useState(() => loadLeadFilters(preferenceKey, today));
  const dashboard = useGetLeadDashboardQuery(leadDashboardQuery(filters, today));
  return <LeadDashboardView
    name={[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
    today={today}
    filters={filters}
    onFiltersChange={(next) => { setFilters(next); saveLeadFilters(preferenceKey, next); }}
    data={dashboard.currentData}
    coderOptions={dashboard.currentData?.coderOptions ?? dashboard.data?.coderOptions ?? []}
    loading={dashboard.isFetching && !dashboard.currentData}
    error={dashboard.error ? getErrorMessage(dashboard.error) : undefined}
    onRetry={dashboard.refetch}
  />;
}

interface LeadDashboardViewProps {
  name: string;
  today: string;
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
  data?: LeadDashboardSummary;
  coderOptions: LeadDashboardSummary["coderOptions"];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}

export function LeadDashboardView({ name, today, filters, onFiltersChange, data, coderOptions, loading, error, onRetry }: LeadDashboardViewProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const periodLabel = leadPeriodLabel(filters, today);
  const coderName = filters.coderId === "ALL" ? "All coders" : coderOptions.find((coder) => coder.userId === filters.coderId)?.name ?? "Selected coder";
  const filterCount = Number(filters.dateMode !== "month" || filters.month !== today.slice(0, 7)) + Number(filters.coderId !== "ALL");
  const draftError = leadFilterError(draft, today);
  const dailyPeriod = data ? dateRangeLabel(data.from, data.to) : periodLabel;
  const periodKey = data ? `${data.from}-${data.to}-${data.selectedCoderId ?? "all"}` : periodLabel;

  return <div className="mx-auto flex min-w-0 max-w-screen-2xl flex-col gap-6 text-content-primary">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Lead workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">QA & coder performance</h1>
        <p className="mt-2 text-sm text-content-secondary">Your performance and your coders’ results, each with their own totals.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">{periodLabel}</span>
        <Button variant="secondary" onClick={() => { setDraft(filters); setFiltersOpen(true); }}>
          <span className="flex items-center gap-2"><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M7 14v6" strokeLinecap="round" /></svg>Filters{filterCount ? ` (${filterCount})` : ""}</span>
        </Button>
      </div>
    </header>

    <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Lead dashboard filters" description="Dates apply to both sections. Coder selection applies only to coder results." widthClass="max-w-md">
      <form className="flex min-h-full flex-col gap-5" onSubmit={(event) => { event.preventDefault(); if (!draftError) { onFiltersChange(draft); setFiltersOpen(false); } }}>
        <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
          <h3 className="text-sm font-semibold">Reporting period</h3>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">View by
            <select className={inputClass} value={draft.dateMode} onChange={(event) => setDraft({ ...draft, dateMode: event.target.value as LeadDateMode })}>
              <option value="from_start">From start (April 1)</option><option value="day">Day</option><option value="month">Month</option><option value="year">Year</option><option value="range">Date range</option>
            </select>
          </label>
          {draft.dateMode === "day" && <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">Day<input required type="date" min="2000-01-01" max={today} value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value })} className={inputClass} /></label>}
          {draft.dateMode === "month" && <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">Month<input required type="month" min="2000-01" max={today.slice(0, 7)} value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} className={inputClass} /></label>}
          {draft.dateMode === "year" && <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">Year<input required type="number" min={2000} max={Number(today.slice(0, 4))} value={draft.year || ""} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })} className={inputClass} /></label>}
          {draft.dateMode === "range" && <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">From<input required type="date" min="2000-01-01" max={draft.rangeEnd || today} value={draft.rangeStart} onChange={(event) => setDraft({ ...draft, rangeStart: event.target.value })} className={inputClass} /></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">To<input required type="date" min={draft.rangeStart || "2000-01-01"} max={today} value={draft.rangeEnd} onChange={(event) => setDraft({ ...draft, rangeEnd: event.target.value })} className={inputClass} /></label>
          </div>}
          {draft.dateMode === "from_start" && <p className="text-xs leading-relaxed text-content-secondary">From April 1 of the current financial year through today.</p>}
        </div>
        <CoderSelect label="Coders under you" value={draft.coderId} options={coderOptions} onChange={(coderId) => setDraft({ ...draft, coderId })} />
        <p className="text-xs leading-relaxed text-content-secondary">All coders combines your direct coders. Choose one coder to see their individual goals, charts, CPD, and efficiency.</p>
        {draftError && <p role="alert" className="text-sm text-danger">{draftError}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="ghost" onClick={() => setDraft(defaultLeadFilters(today))}>Reset all</Button>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button><Button type="submit" disabled={Boolean(draftError)}>Apply filters</Button></div>
        </div>
      </form>
    </Drawer>

    {error && <div className="space-y-3"><ErrorState message={error} onRetry={onRetry} />{filters.coderId !== "ALL" && <Button variant="secondary" onClick={() => onFiltersChange({ ...filters, coderId: "ALL" })}>Show all coders</Button>}</div>}
    {loading ? <LoadingState label="Loading QA and coder performance…" /> : !error && data ? <>
      <section aria-labelledby="qa-section-title" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="qa-section-title" className="text-lg font-semibold">QA · your performance</h2><p className="mt-1 text-xs text-content-secondary">{name} · Only your own records</p></div>
          <span className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-medium text-brand-800">Personal</span>
        </div>
        <LeadGoal goal={data.qa.goal} monthly={filters.dateMode === "month"} label="Your goal" />
        <PerformanceSummary summary={data.qa.efficiency} label="QA performance summary" note="Your own charts in this period" />
        <details key={`qa-${data.from}-${data.to}`} className="group rounded-lg border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-5 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">QA daily records <span aria-hidden="true" className="text-lg group-open:rotate-45">+</span></summary>
          <DailySection section={data.qa} title="QA daily performance" periodLabel={dailyPeriod} exportName={`qa-performance-${data.from}-to-${data.to}`} />
        </details>
      </section>

      <section aria-labelledby="coders-section-title" className="flex min-w-0 flex-col gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 id="coders-section-title" className="text-lg font-semibold">Coders under you</h2><p className="mt-1 text-xs text-content-secondary">{coderName} · {data.coders.goal.userCount} {data.coders.goal.userCount === 1 ? "coder" : "coders"} in this period · QA excluded</p></div>
          <div className="w-full sm:w-64"><CoderSelect label="Show coder results" value={filters.coderId} options={coderOptions} onChange={(coderId) => onFiltersChange({ ...filters, coderId })} /></div>
        </div>
        {data.coderOptions.length === 0 ? <EmptyState title="No coders in this period" description="Coders assigned directly to you will appear here. Your QA results are shown above." /> : <>
          <LeadGoal goal={data.coders.goal} monthly={filters.dateMode === "month"} label={filters.coderId === "ALL" ? "Combined coder goal" : `${coderName} · goal`} />
          <PerformanceSummary summary={data.coders.efficiency} label="Coder performance summary" note={filters.coderId === "ALL" ? "Combined coder charts · QA excluded" : `${coderName} · charts in this period`} />
          <p className="px-1 text-xs leading-relaxed text-content-secondary">Chart counts and adjusted daily targets are added across coders. CPD and efficiency use combined hours and targets.</p>
          <DailySection key={periodKey} section={data.coders} title={filters.coderId === "ALL" ? "Combined coder daily performance" : `${coderName} · daily performance`} periodLabel={dailyPeriod} exportName={`coder-performance-${filters.coderId}-${data.from}-to-${data.to}`} />
        </>}
      </section>
      <details className="rounded-lg border border-border bg-surface px-5 py-4 text-xs leading-relaxed text-content-secondary">
        <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">How lead totals work</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <p>QA includes only your own data. Coder results include only coders who report directly to you. With All coders selected, targets and chart counts are combined. A coder selection changes only the coder section.</p>
          <p>Adjusted target CPD uses saved manual records and excludes Huddle meetings from deductions. Calendar goals exclude weekends, office holidays, and full-leave days. Month mode shows a full-month goal; other modes show goals for the selected dates.</p>
          <p>Manual and Kairon CPD normalize charts to an 8-hour day using Daily Refresh hours after downtime, idle time, all meetings, and leave. Efficiency compares charts with the target for those hours and is capped at 120%. Team and period metrics use the combined source totals.</p>
          <p>Daily totals use available records. A dash means no value is available. Mixed stages means contributing coders had different stages on that date.</p>
        </div>
      </details>
    </> : null}
  </div>;
}

function CoderSelect({ label, value, options, onChange }: { label: string; value: LeadFilters["coderId"]; options: LeadDashboardSummary["coderOptions"]; onChange: (value: LeadFilters["coderId"]) => void }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">{label}
    <select value={value} onChange={(event) => onChange(event.target.value === "ALL" ? "ALL" : Number(event.target.value))} className={inputClass}>
      <option value="ALL">All coders</option>
      {value !== "ALL" && !options.some((option) => option.userId === value) && <option value={value}>Selected coder (unavailable)</option>}
      {options.map((coder) => <option key={coder.userId} value={coder.userId}>{coder.name}{coder.isActive ? "" : " (Inactive)"}</option>)}
    </select>
  </label>;
}

function LeadGoal({ goal, monthly, label }: { goal: PeriodGoalSummary; monthly: boolean; label: string }) {
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
      <span>{goal.eligibleDays} target workdays{goal.scope === "team" ? " across coders" : ""}</span><span>{goal.holidayCount} weekday holidays excluded</span><span>{goal.leaveDaysExcluded} full-leave days excluded</span>
      {target > 0 && remaining <= 0 && <span className="font-semibold text-brand-600">Goal achieved{remaining < 0 ? ` · ${chartLabel(-remaining)} charts above goal` : ""}</span>}
    </div>
  </article>;
}

function DailySection({ section, title, periodLabel, exportName }: { section: LeadPerformanceSection; title: string; periodLabel: string; exportName: string }) {
  return <DailyPerformance rows={section.efficiency.daily} month={section.efficiency.from.slice(0, 7)} periodLabel={periodLabel} title={title} description="Charts, saved adjusted targets, CPD, and efficiency for the selected dates." exportName={exportName} showYear />;
}
