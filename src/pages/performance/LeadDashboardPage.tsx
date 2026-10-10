import { UserDetailsScreen, type DetailPerson } from "./UserDetailsScreen";
import { PerformanceTabs } from "./PerformanceTabs";
import { ReportGraphs } from "@/pages/reports/ReportGraphs";
import { useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetLeadDashboardQuery } from "@/api/reportsApi";
import type { LeadDashboardSummary, LeadPerformanceSection } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { DailyPerformance } from "./DailyPerformance";
import { PerformanceSummary } from "./PerformanceSummary";
import { TeamOverview } from "./TeamOverview";
import { LeadCoderPerformance } from "./LeadCoderPerformance";
import { PeriodGoalCard } from "./PeriodGoalCard";
import { ReportingPeriodFields } from "./ReportingPeriodFields";
import { dateRangeLabel, defaultLeadFilters, leadDashboardQuery, leadFilterError, leadPeriodLabel, loadLeadFilters, localDayValue, saveLeadFilters, type LeadFilters } from "./leadFilters";

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
  const [detailPerson, setDetailPerson] = useState<DetailPerson | null>(null);
  const [scope, setScope] = useState<"qa" | "coders">("coders");
  const [panel, setPanel] = useState<"records" | "daily" | "summary" | "trends">("records");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const periodLabel = leadPeriodLabel(filters, today);
  const coderName = filters.coderId === "ALL" ? "All coders" : coderOptions.find((coder) => coder.userId === filters.coderId)?.name ?? "Selected coder";
  const filterCount = Number(filters.dateMode !== "month" || filters.month !== today.slice(0, 7)) + Number(filters.coderId !== "ALL");
  const draftError = leadFilterError(draft, today);
  const dailyPeriod = data ? dateRangeLabel(data.from, data.to) : periodLabel;

  return <div className="lead-dashboard-fit mx-auto flex min-w-0 max-w-screen-2xl flex-col gap-3 text-content-primary">
    {detailPerson && <UserDetailsScreen key={detailPerson.userId} person={detailPerson} initialFilters={filters} onClose={() => setDetailPerson(null)} />}
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h1 className="sr-only">QA & coder performance</h1>
      <PerformanceTabs value={scope} onChange={setScope} items={[{ value: "qa", label: "QA · your performance" }, { value: "coders", label: "Coders under you" }]} label="Lead performance scope" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">{periodLabel}</span>
        <Button variant="secondary" onClick={() => { setDraft(filters); setFiltersOpen(true); }}>
          <span className="flex items-center gap-2"><svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M7 14v6" strokeLinecap="round" /></svg>Filters{filterCount ? ` (${filterCount})` : ""}</span>
        </Button>
      </div>
    </header>


    <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Lead dashboard filters" description="Dates apply to both sections. Coder selection applies only to coder results." widthClass="max-w-md">
      <form className="flex min-h-full flex-col gap-5" onSubmit={(event) => { event.preventDefault(); if (!draftError) { onFiltersChange(draft); setFiltersOpen(false); } }}>
        <ReportingPeriodFields draft={draft} today={today} onChange={setDraft} />
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

      <TeamOverview showRates summary={scope === "qa" ? data.qa.efficiency : data.coders.efficiency} people={scope === "qa" ? data.qa.goal.userCount : data.coders.goal.userCount} scope={scope === "qa" ? `${name} · own QA records` : `${coderName} · QA excluded`} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{scope === "qa" ? "Your QA performance" : "Coder performance"}</p>
        <PerformanceTabs value={panel === "daily" && scope === "qa" ? "records" : panel} onChange={setPanel}
          items={[{value:"records",label:scope === "qa" ? "Daily" : "People"}, ...(scope === "coders" ? [{value:"daily" as const,label:"Daily"}] : []), {value:"summary",label:"Goal & rates"}, {value:"trends",label:"Trends"}]}
          label="Lead performance view" compact />
      </div>
      <div className="lead-dashboard-results min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" role="region" aria-label="Lead performance results" tabIndex={0}>
      {scope === "coders" && data.coderOptions.length === 0 ? <EmptyState title="No coders in this period" description="Coders assigned directly to you will appear here. Select QA to see your own records." />
        : panel === "summary" ? <><PeriodGoalCard goal={scope === "qa" ? data.qa.goal : data.coders.goal} monthly={filters.dateMode === "month"} label={scope === "qa" ? "Your QA goal" : "Coder goal"} /><PerformanceSummary summary={scope === "qa" ? data.qa.efficiency : data.coders.efficiency} /></>
        : panel === "trends" ? <ReportGraphs sources={[(scope === "qa" ? data.qa : data.coders).efficiency.daily]} from={data.from} to={data.to} teamView={scope === "coders"} />
        : scope === "qa" ? <DailySection section={data.qa} title="QA daily performance" periodLabel={dailyPeriod} exportName={`qa-performance-${data.from}-to-${data.to}`} />
        : <LeadCoderPerformance view={panel === "daily" ? "day" : "coder"} data={data} onPick={(coderId) => { const coder = coderOptions.find(item => item.userId === coderId); if (coder) setDetailPerson({...coder, roleType: "employee", leadName: name}); }} />}
      </div>

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


function DailySection({ section, title, periodLabel, exportName }: { section: LeadPerformanceSection; title: string; periodLabel: string; exportName: string }) {
  return <DailyPerformance paginate={false} rows={section.efficiency.daily} month={section.efficiency.from.slice(0, 7)} periodLabel={periodLabel} title={title} description="Charts, saved adjusted targets, CPD, and efficiency for the selected dates." exportName={exportName} showYear />;
}
