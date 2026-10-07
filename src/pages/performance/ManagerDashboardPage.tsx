import { SortableHeader } from "@/components/ui/SortableHeader";
import { sortTableRows, type TableSort } from "@/components/ui/tableSort";
import { coderColumns } from "./performanceColumns";
import { useId, useRef, useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetManagerDashboardQuery } from "@/api/reportsApi";
import type { LeadPerformanceSection, ManagerDashboardQuery, ManagerDashboardSummary, ManagerPerformanceMember } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { DailyPerformance } from "./DailyPerformance";
import { EfficiencyValue } from "./EfficiencyValue";
import { PerformanceSummary } from "./PerformanceSummary";
import { TeamOverview } from "./TeamOverview";
import { CoderPerformancePanel } from "./CoderPerformancePanel";
import { ManagerCoderDay } from "./ManagerCoderDay";
import { PeriodGoalCard } from "./PeriodGoalCard";
import { ReportingPeriodFields, performanceInputClass } from "./ReportingPeriodFields";
import { dateRangeLabel, leadPeriodLabel, loadLeadFilters, localDayValue, saveLeadFilters } from "./leadFilters";
import { changeManagerScope, defaultManagerFilters, managerDashboardQuery, managerFilterError, matchingCoders, type ManagerFilters, type ManagerView } from "./managerFilters";
import { numberLabel } from "./performanceView";

const views: { value: ManagerView; label: string; description: string }[] = [
  { value: "teams", label: "Teams by lead", description: "Explore each lead’s QA and coder performance." },
  { value: "coders", label: "Only coders", description: "Combined coder results across the selected teams." },
  { value: "leads", label: "Only leads", description: "QA performance across the selected leads." },
  { value: "both", label: "Both", description: "All selected teams, with separate QA and coder totals." },
];
type Options = Pick<ManagerDashboardSummary, "leadOptions" | "coderOptions" | "cohortOptions">;
const emptyOptions: Options = { leadOptions: [], coderOptions: [], cohortOptions: [] };

export function ManagerDashboardPage() {
  const { user } = useAuth();
  const today = localDayValue();
  const preferenceKey = `hph-dashboard-period:${user?.id ?? "anonymous"}`;
  const [filters, setFilters] = useState<ManagerFilters>(() => ({ ...loadLeadFilters(preferenceKey, today), leadId: "ALL", cohortId: "ALL", program: "ALL" }));
  const dashboard = useGetManagerDashboardQuery(managerDashboardQuery(filters, today));
  return <ManagerDashboardView today={today} filters={filters}
    onFiltersChange={(next) => { setFilters(next); saveLeadFilters(preferenceKey, next); }}
    data={dashboard.currentData} options={dashboard.currentData ?? dashboard.data ?? emptyOptions}
    loading={dashboard.isFetching && !dashboard.currentData}
    error={dashboard.error ? getErrorMessage(dashboard.error) : undefined} onRetry={dashboard.refetch} />;
}

interface ManagerDashboardViewProps {
  today: string;
  filters: ManagerFilters;
  onFiltersChange: (filters: ManagerFilters) => void;
  data?: ManagerDashboardSummary;
  options: Options;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}

export function ManagerDashboardView({ today, filters, onFiltersChange, data, options, loading, error, onRetry }: ManagerDashboardViewProps) {
  const [view, setView] = useState<ManagerView>("teams");
  const [draftView, setDraftView] = useState<ManagerView>("teams");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const tabsId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const teams = data?.teams ?? [];
  const team = teams.find((item) => item.key === selectedTeamKey) ?? teams[0];
  const period = leadPeriodLabel(filters, today);
  const availableCoders = matchingCoders(options.coderOptions, draft);
  const draftError = managerFilterError(draft, today);
  const selectedCoder = options.coderOptions.find((coder) => coder.userId === filters.coderId);
  const coderName = selectedCoder?.name;
  const scopeLeadId = filters.leadId === "ALL" ? selectedCoder?.leadId : filters.leadId;
  const leadName = options.leadOptions.find((lead) => lead.userId === scopeLeadId)?.name;
  const cohortName = options.cohortOptions.find((cohort) => cohort.id === filters.cohortId)?.label;
  const filterCount = Number(filters.dateMode !== "month" || filters.month !== today.slice(0, 7)) + Number(filters.leadId !== "ALL") + Number(filters.coderId !== "ALL") + Number(filters.cohortId !== "ALL") + Number(filters.program !== "ALL") + Number(view !== "teams");
  const monthly = filters.dateMode === "month";
  const pickMember = (member: ManagerPerformanceMember) => {
    setSelectedTeamKey(null);
    onFiltersChange({ ...filters, coderId: member.roleType === "employee" ? member.userId : "ALL", leadId: member.leadId ?? "ALL" });
  };
  const performanceSection = (section: LeadPerformanceSection, role: "lead" | "employee", title: string, context: string, teamId?: number | null) => <ManagerSection
    key={`${role}-${teamId ?? "all"}-${data?.from}-${data?.to}-${filters.coderId}-${filters.cohortId}-${filters.program}`}
    title={title} context={context} section={section} monthly={monthly} role={role}
    members={(data?.members ?? []).filter((member) => member.roleType === role && (teamId === undefined || (teamId === null ? !member.leadId : member.leadId === teamId)))}
    onPickMember={pickMember} scope={{ ...managerDashboardQuery(filters, today), ...(teamId != null ? { leadId: teamId } : {}) }} />;

  return <div className="mx-auto flex min-w-0 max-w-screen-2xl flex-col gap-5 text-content-primary">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Manager workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Team performance</h1>
        <p className="mt-2 text-sm text-content-secondary">Your leads, their QA work, and the coders they support.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">{period}</span>
        <Button variant="secondary" onClick={() => { setDraft(filters); setDraftView(view); setFiltersOpen(true); }}>Filters{filterCount ? ` (${filterCount})` : ""}</Button>
      </div>
    </header>

    <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary" aria-label="Active dashboard filters">
      <span className="font-medium text-content-primary">Showing</span>
      {[views.find((item) => item.value === view)?.label, leadName ?? (selectedCoder ? "Unassigned coders" : "All teams"), coderName, cohortName, filters.program === "ALL" ? null : filters.program].filter(Boolean).map((label) => <span key={label} className="rounded-full border border-border bg-surface px-2.5 py-1">{label}</span>)}
      {filterCount > 0 && <button className="rounded px-2 py-1 font-medium text-brand-700 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => { onFiltersChange(defaultManagerFilters(today)); setView("teams"); setSelectedTeamKey(null); }}>Reset filters</button>}
    </div>
    {filters.coderId !== "ALL" && <p className="text-xs text-content-secondary">Coder results show {coderName ?? "the selected coder"}. {selectedCoder?.leadId ? "QA results show their lead’s own records." : "No lead is assigned to this coder."}</p>}
    {filters.program !== "ALL" && <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-xs text-brand-800">Showing {filters.program} charts. Targets and recorded hours cover all programs.</p>}

    <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Manager dashboard filters" description="Choose the reporting period and people to include." widthClass="max-w-md">
      <form className="flex min-h-full flex-col gap-5" onSubmit={(event) => { event.preventDefault(); if (!draftError) { onFiltersChange(draft); setView(draftView); setSelectedTeamKey(null); setFiltersOpen(false); } }}>
        <div className="space-y-2">
          <Select label="Dashboard view" value={draftView} onChange={(value) => setDraftView(value as ManagerView)}>
            {views.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <p className="text-xs leading-relaxed text-content-secondary">{views.find((item) => item.value === draftView)?.description}</p>
        </div>
        <ReportingPeriodFields draft={draft} today={today} onChange={(periodFilters) => setDraft({ ...draft, ...periodFilters })} />
        <Select label="Lead / team" value={draft.leadId} onChange={(value) => setDraft(changeManagerScope(draft, { leadId: selection(value) }, options.coderOptions))}>
          <option value="ALL">All teams</option>{options.leadOptions.map((lead) => <option key={lead.userId} value={lead.userId}>{lead.name}{lead.isActive ? "" : " (Inactive)"}</option>)}
        </Select>
        <Select label="Cohort" value={draft.cohortId} onChange={(value) => setDraft(changeManagerScope(draft, { cohortId: selection(value) }, options.coderOptions))}>
          <option value="ALL">All cohorts</option>{options.cohortOptions.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
        </Select>
        <Select label="Coder" value={draft.coderId} onChange={(value) => setDraft({ ...draft, coderId: selection(value) })}>
          <option value="ALL">All coders</option>{availableCoders.map((coder) => <option key={coder.userId} value={coder.userId}>{coder.name}{coder.isActive ? "" : " (Inactive)"}</option>)}
          {draft.coderId !== "ALL" && !availableCoders.some((coder) => coder.userId === draft.coderId) && <option value={draft.coderId}>Selected coder (unavailable)</option>}
        </Select>
        <p className="-mt-3 text-xs leading-relaxed text-content-secondary">All coders combines the selected teams. Choose a coder to see their results alongside their lead’s QA records.</p>
        <Select label="Program" value={draft.program} onChange={(value) => setDraft({ ...draft, program: value as ManagerFilters["program"] })}><option value="ALL">All programs</option><option value="PVP">PVP</option><option value="FOUNDATION">Foundation</option></Select>
        {draftError && <p role="alert" className="text-sm text-danger">{draftError}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="ghost" onClick={() => { setDraft(defaultManagerFilters(today)); setDraftView("teams"); }}>Reset all</Button>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button><Button type="submit" disabled={Boolean(draftError)}>Apply filters</Button></div>
        </div>
      </form>
    </Drawer>

    {error && <ErrorState message={error} onRetry={onRetry} />}
    {loading ? <LoadingState label="Loading team performance…" /> : !error && data ? <>
      <TeamOverview summary={view === "coders" ? data.coders.efficiency : view === "leads" ? data.qa.efficiency : data.overall}
        people={view === "coders" ? data.coders.goal.userCount : view === "leads" ? data.qa.goal.userCount : data.qa.goal.userCount + data.coders.goal.userCount}
        scope={view === "coders" ? "Selected coders" : view === "leads" ? "Selected QA leads" : "Selected teams · QA + coders"} />
      {teams.length === 0 ? <EmptyState title="No people match these filters" description="Choose another team, cohort, or reporting period to see performance." /> : view === "teams" && team ? <section className="min-w-0 rounded-lg border border-border bg-surface p-3 shadow-sm sm:p-5" aria-label="Performance by lead">
        <div role="tablist" aria-label="Lead teams" className="flex gap-1 overflow-x-auto border-b border-border pb-2">
          {teams.map((item, index) => <button key={item.key} ref={(element) => { tabRefs.current[index] = element; }} id={`${tabsId}-${item.key}`} role="tab" type="button"
            aria-selected={team.key === item.key} aria-controls={`${tabsId}-panel`} tabIndex={team.key === item.key ? 0 : -1}
            onClick={() => setSelectedTeamKey(item.key)} onKeyDown={(event) => {
              const target = event.key === "ArrowRight" ? (index + 1) % teams.length : event.key === "ArrowLeft" ? (index - 1 + teams.length) % teams.length : event.key === "Home" ? 0 : event.key === "End" ? teams.length - 1 : null;
              if (target !== null) { event.preventDefault(); setSelectedTeamKey(teams[target].key); tabRefs.current[target]?.focus(); }
            }} className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${team.key === item.key ? "bg-brand-50 text-brand-700" : "text-content-secondary hover:bg-surface-muted"}`}>
            {item.lead?.name ?? "Unassigned"}<span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs tabular-nums">{item.coders.goal.userCount}</span>
          </button>)}
        </div>
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${team.key}`} className="flex min-w-0 flex-col gap-6 pt-5">
          <div><h2 className="text-lg font-semibold">{team.lead ? `${team.lead.name}’s team` : "Unassigned coders"}</h2><p className="mt-1 text-xs text-content-secondary">{team.coders.goal.userCount} {team.coders.goal.userCount === 1 ? "coder" : "coders"} in this selection · {dateRangeLabel(data.from, data.to)}</p></div>
          {performanceSection(team.qa, "lead", "QA section", team.lead?.name ?? "No lead assigned", team.lead?.userId ?? null)}
          {performanceSection(team.coders, "employee", "Coders section", coderName ?? "All coders in this team", team.lead?.userId ?? null)}
        </div>
      </section> : <div className="flex min-w-0 flex-col gap-6">
        {view !== "coders" && performanceSection(data.qa, "lead", "QA section", "Combined performance of the selected leads")}
        {view !== "leads" && performanceSection(data.coders, "employee", "Coders section", coderName ?? "Combined performance of the selected coders")}
      </div>}
      <details className="rounded-lg border border-border bg-surface px-5 py-4 text-xs leading-relaxed text-content-secondary">
        <summary className="cursor-pointer text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-500">How manager totals work</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2"><p>QA includes the leads’ own records. Coder totals include their reporting coders. The two sections keep their goals, chart counts, CPD, and efficiency separate. A coder selection narrows the dashboard to that coder and their lead’s QA.</p>
          <p>Chart counts and saved adjusted targets are added. CPD and efficiency use combined source hours and targets; efficiency is capped at 120%. Adjusted target CPD uses saved manual records, with no deduction for Huddle meetings.</p>
          <p>Month mode uses full-month goals. Other date modes use the selected dates. Goals exclude weekends, office holidays, and full-leave days. Program selection filters completed charts; stage targets and recorded hours remain shared across programs.</p>
          <p>Team membership follows current reporting assignments. Inactive people remain available for periods through their last working day. A dash means no value is available.</p></div>
      </details>
    </> : null}
  </div>;
}

function selection(value: string): "ALL" | number { return value === "ALL" ? "ALL" : Number(value); }
function Select({ label, value, onChange, children }: { label: string; value: string | number; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">{label}<select className={performanceInputClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function ManagerSection({ title, context, section, monthly, members, role, onPickMember, scope }: {
  title: string; context: string; section: LeadPerformanceSection; monthly: boolean;
  members: ManagerPerformanceMember[]; role: "lead" | "employee"; onPickMember: (member: ManagerPerformanceMember) => void;
  scope: ManagerDashboardQuery;
}) {
  const id = useId();
  const pickCoder = (userId: number) => {
    const member = members.find((item) => item.userId === userId);
    if (member) onPickMember(member);
  };
  return <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 id={id} className="text-base font-semibold">{title}</h3><p className="mt-1 text-xs text-content-secondary">{context}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${role === "lead" ? "bg-brand-100 text-brand-800" : "bg-surface-muted text-content-secondary"}`}>{section.goal.userCount} {role === "lead" ? (section.goal.userCount === 1 ? "QA lead" : "QA leads") : (section.goal.userCount === 1 ? "coder" : "coders")}</span></div>
    {section.goal.userCount === 0 ? <EmptyState title={role === "lead" ? "No QA in this selection" : "No coders in this selection"} description="Adjust the filters to include more people." /> : <>
      <PeriodGoalCard goal={section.goal} monthly={monthly} label={role === "lead" ? "QA goal" : "Coder goal"} />
      <PerformanceSummary summary={section.efficiency} label={`${title} performance summary`} />
      {role === "employee" ? <CoderPerformancePanel key={JSON.stringify(scope)} members={members} rows={section.efficiency.daily}
        from={section.efficiency.from} to={section.efficiency.to} periodLabel={dateRangeLabel(section.efficiency.from, section.efficiency.to)} onPick={pickCoder}
        exportName={`manager-coders-${section.efficiency.from}-to-${section.efficiency.to}`}
        renderDayDetails={(date) => <ManagerCoderDay date={date} scope={scope} members={members} onPick={pickCoder} />} /> : <>
      <MemberTable members={members} role={role} onPick={onPickMember} />
      <details className="group min-w-0 rounded-lg border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-5 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">{role === "lead" ? "QA" : "Coder"} daily performance<span className="text-lg group-open:rotate-45" aria-hidden="true">+</span></summary>
        <DailyPerformance rows={section.efficiency.daily} month={section.efficiency.from.slice(0, 7)} periodLabel={dateRangeLabel(section.efficiency.from, section.efficiency.to)} title={`${title} · daily totals`} description="Daily chart counts, saved adjusted targets, CPD, and efficiency." exportName={`manager-${role}-${members.length === 1 ? members[0].userId : "combined"}-${section.efficiency.from}-to-${section.efficiency.to}`} showYear />
      </details>
      </>}
    </>}
  </section>;
}
function MemberTable({ members, role, onPick }: { members: ManagerPerformanceMember[]; role: "lead" | "employee"; onPick: (member: ManagerPerformanceMember) => void }) {
  const [sort, setSort] = useState<TableSort>({ key: "name", direction: "asc" });
  const columns = coderColumns.map((column) => column.key === "name" ? { ...column, label: role === "lead" ? "Lead" : "Coder" } : column);
  const sortedMembers = sortTableRows(members, columns, sort);
  return <div className="min-w-0 overflow-x-auto rounded-lg border border-border bg-surface" tabIndex={0} role="region" aria-label={role === "lead" ? "Lead performance table" : "Coder performance table"}>
    <table className="w-full min-w-[980px] text-left text-sm">
      <caption className="sr-only">{role === "lead" ? "QA lead" : "Coder"} results for the selected period. Select a name to filter the dashboard.</caption>
      <thead className="bg-surface-muted text-xs text-content-secondary"><tr>{columns.map((column, index) => <SortableHeader key={column.key} column={column} sort={sort} onSort={setSort} align={index ? "right" : "left"} className="px-4 py-3 font-medium" />)}</tr></thead>
      <tbody className="divide-y divide-border">{sortedMembers.map((member) => <tr key={member.userId} className="hover:bg-brand-50/50">
        <th scope="row" className="px-4 py-3 font-normal"><button onClick={() => onPick(member)} className="rounded text-left font-medium text-brand-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500">{member.name}</button>{!member.isActive && <div className="mt-1 text-xs text-content-secondary">Inactive</div>}</th>
        {[member.efficiency.manualCharts, member.efficiency.kaironCharts, member.efficiency.manualCpd, member.efficiency.kaironCpd, member.efficiency.targetCpd].map((value, index) => <td key={index} className="px-4 py-3 text-right tabular-nums">{numberLabel(value, index < 2 ? 0 : 1)}</td>)}
        <td className="px-4 py-3 text-right"><EfficiencyValue value={member.efficiency.manualEfficiencyPercent} /></td><td className="px-4 py-3 text-right"><EfficiencyValue value={member.efficiency.kaironEfficiencyPercent} /></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
