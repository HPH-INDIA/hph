import { averageAdjustedTargets } from "./adjustedTargetMetrics";
import { UserDetailsScreen, type DetailPerson } from "./UserDetailsScreen";
import { ReportGraphs } from "@/pages/reports/ReportGraphs";
import { PerformanceTabs } from "./PerformanceTabs";
import { CoderPerformanceTable } from "./CoderPerformanceTable";
import { useState, type ReactNode } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetManagerDashboardQuery, useGetManagerCoderSelectionQuery, useGetManualTeamRangeQuery } from "@/api/reportsApi";
import type { LeadPerformanceSection, ManagerDashboardQuery, ManagerDashboardSummary, ManagerPerformanceMember } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { selectManagerTeams, selectManagerCoders } from "./managerTeamSelection";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { DailyPerformance } from "./DailyPerformance";
import { PerformanceSummary } from "./PerformanceSummary";
import { TeamOverview } from "./TeamOverview";
import { ManagerCoderDay } from "./ManagerCoderDay";
import { PeriodGoalCard } from "./PeriodGoalCard";
import { ReportingPeriodFields, performanceInputClass } from "./ReportingPeriodFields";
import { dateRangeLabel, leadPeriodLabel, loadLeadFilters, localDayValue, saveLeadFilters } from "./leadFilters";
import { changeManagerScope, defaultManagerFilters, managerDashboardQuery, managerFilterError, matchingCoders, type ManagerFilters, type ManagerView } from "./managerFilters";

const views: { value: ManagerView; label: string; description: string }[] = [
  { value: "teams", label: "Overview", description: "Explore each lead’s QA and coder performance." },
  { value: "coders", label: "Coders", description: "All coders across teams, shown together." },
  { value: "leads", label: "QA", description: "All QA leads across teams, shown together." },
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
  const [detailPerson, setDetailPerson] = useState<DetailPerson | null>(null);
  const [view, setView] = useState<ManagerView>("teams");
  const [draftView, setDraftView] = useState<ManagerView>("teams");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [teamScope, setTeamScope] = useState<"qa" | "coders">("coders");
  const [selectedTeamKeys, setSelectedTeamKeys] = useState<string[] | null>(null);
  const teams = data?.teams ?? [];
  const selectedKeys = selectedTeamKeys === null ? teams.slice(0, 1).map((team) => team.key) : selectedTeamKeys.filter((key) => teams.some((team) => team.key === key));
  const teamData = data ? view === "teams" ? selectManagerTeams(data, selectedKeys) : data : undefined;
  const [inlineCoderIds, setInlineCoderIds] = useState<string[] | null>(null);
  const teamCoders = (teamData?.members ?? []).filter(member => member.roleType === "employee");
  const coderIds = teamCoders.map(member => String(member.userId));
  const selectedCoderIds = inlineCoderIds === null ? coderIds : inlineCoderIds.filter(id => coderIds.includes(id));
  const hasCoderSelection = view === "teams" && teamScope === "coders" && selectedCoderIds.length !== coderIds.length;
  const inlineScope = managerDashboardQuery(filters, today);
  const coderDetails = useGetManagerCoderSelectionQuery({scope: inlineScope, coderIds: selectedCoderIds.map(Number).sort((a,b) => a-b)}, {skip: !hasCoderSelection || selectedCoderIds.length === 0});
  const selectedData = !hasCoderSelection ? teamData : teamData && (selectedCoderIds.length === 0 ? selectManagerCoders(teamData, []) : coderDetails.currentData ? selectManagerCoders(teamData, coderDetails.currentData) : undefined);
  const selectedTeamLabel = teamData?.teams.length === 1 ? teamData.teams[0].lead?.name ?? "Unassigned" : `${selectedKeys.length} selected teams`;
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
  const peopleFiltered = filters.leadId !== "ALL" || filters.coderId !== "ALL" || filters.cohortId !== "ALL";
  const changeView = (next: ManagerView) => {
    setView(next);
    // Team exploration belongs to Overview. Entering a people-wide tab starts
    // with everyone, while retaining the reporting period and program.
    if (next !== "teams" && next !== view) {
      onFiltersChange({ ...filters, leadId: "ALL", coderId: "ALL", cohortId: "ALL" });
    }
  };
  const pickMember = (member: ManagerPerformanceMember) => {
    setDetailPerson({ ...member, leadName: member.roleType === "employee" ? options.leadOptions.find(lead => lead.userId === member.leadId)?.name : undefined });
  };
  const performanceSection = (section: LeadPerformanceSection, role: "lead" | "employee", title: string, context: string, toolbar?: ReactNode) => <ManagerSection
    key={`${view}-${role}-${data?.from}-${data?.to}-${filters.coderId}-${filters.cohortId}-${filters.program}`}
    title={title} context={context} section={section} monthly={monthly} role={role} toolbar={toolbar} paginate={view === "teams"}
    members={(selectedData?.members ?? []).filter((member) => member.roleType === role)}
    onPickMember={pickMember} scope={inlineScope} />;

  const teamControls = <>
    <SearchableMultiSelect label="Lead / team" value={selectedKeys} onChange={(keys) => { setSelectedTeamKeys(keys); setInlineCoderIds(null); }}
      options={teams.map((item) => ({ value: item.key, label: item.lead?.name ?? "Unassigned", detail: `${item.coders.goal.userCount} coders` }))} />
    <SearchableMultiSelect label="Coders" noun="coders" value={selectedCoderIds}
      onChange={(ids) => { setInlineCoderIds(ids); setTeamScope("coders"); }}
      options={teamCoders.map(member => ({value: String(member.userId), label: member.name}))} />
    {view === "teams" && <PerformanceTabs value={teamScope} onChange={setTeamScope} items={[{ value: "qa", label: "QA" }, { value: "coders", label: "Coders" }]} label="Selected team scope" compact />}
  </>;
  return <div className="mx-auto flex min-w-0 max-w-screen-2xl flex-col gap-3 text-content-primary">
    {detailPerson && <UserDetailsScreen key={detailPerson.userId} person={detailPerson} initialFilters={filters} onClose={() => setDetailPerson(null)} />}
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h1 className="sr-only">Team performance</h1>
      <PerformanceTabs value={view} onChange={changeView} items={views} label="Performance scope" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">{period}</span>
        <Button variant="secondary" onClick={() => { setDraft(filters); setDraftView(view); setFiltersOpen(true); }}>Filters{filterCount ? ` (${filterCount})` : ""}</Button>
      </div>
    </header>

    {(leadName || coderName || cohortName || filters.program !== "ALL") && <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary" aria-label="Active dashboard filters">
      <span className="font-medium text-content-primary">Showing</span>
      {[views.find((item) => item.value === view)?.label, leadName ?? (selectedCoder ? "Unassigned coders" : "All teams"), coderName, cohortName, filters.program === "ALL" ? null : filters.program].filter(Boolean).map((label) => <span key={label} className="rounded-full border border-border bg-surface px-2.5 py-1">{label}</span>)}
      {filterCount > 0 && <button className="rounded px-2 py-1 font-medium text-brand-700 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => { onFiltersChange(defaultManagerFilters(today)); setView("teams"); setSelectedTeamKeys(null); }}>Reset filters</button>}
    </div>}
    {filters.coderId !== "ALL" && <p className="text-xs text-content-secondary">Coder results show {coderName ?? "the selected coder"}. {selectedCoder?.leadId ? "QA results show their lead’s own records." : "No lead is assigned to this coder."}</p>}
    {filters.program !== "ALL" && <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-xs text-brand-800">Showing {filters.program} charts. Targets and recorded hours cover all programs.</p>}

    <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Manager dashboard filters" description="Choose the reporting period and people to include." widthClass="max-w-md">
      <form className="flex min-h-full flex-col gap-5" onSubmit={(event) => { event.preventDefault(); if (!draftError) { onFiltersChange(draft); setView(draftView); setSelectedTeamKeys(null); setFiltersOpen(false); } }}>
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
    {loading ? <LoadingState label="Loading team performance…" /> : !error && data && teamData ? <>
      <TeamOverview showRates summary={view === "coders" ? data.coders.efficiency : view === "leads" ? data.qa.efficiency : data.overall}
        people={view === "coders" ? data.coders.goal.userCount : view === "leads" ? data.qa.goal.userCount : data.qa.goal.userCount + data.coders.goal.userCount}
        scope={view === "coders" ? peopleFiltered ? "Filtered coders" : "All coders" : view === "leads" ? peopleFiltered ? "Filtered QA leads" : "All QA leads" : peopleFiltered ? "Filtered people · QA + coders" : "Everyone · QA + coders"} />
      {hasCoderSelection && (!selectedData || (selectedCoderIds.length > 0 && coderDetails.error)) && <div className="flex flex-wrap items-center gap-3">{teamControls}</div>}
      {hasCoderSelection && selectedCoderIds.length > 0 && coderDetails.error ? <ErrorState message={getErrorMessage(coderDetails.error)} onRetry={coderDetails.refetch} /> : !selectedData ? <LoadingState label="Loading coder performance…" /> : teams.length === 0 ? <EmptyState title="No people match these filters" description="Choose another team, cohort, or reporting period to see performance." /> : view === "teams"
        ? teamScope === "qa" ? performanceSection(selectedData.qa, "lead", "QA performance", selectedTeamLabel, teamControls)
          : performanceSection(selectedData.coders, "employee", "Coder performance", coderName ?? selectedTeamLabel, teamControls)
        : view === "leads" ? performanceSection(selectedData.qa, "lead", "QA performance", peopleFiltered ? "Filtered QA leads" : "All QA leads across teams")
          : performanceSection(selectedData.coders, "employee", "Coder performance", coderName ?? (peopleFiltered ? "Filtered coders" : "All coders across teams"))}

    </> : null}
  </div>;
}

function selection(value: string): "ALL" | number { return value === "ALL" ? "ALL" : Number(value); }
function Select({ label, value, onChange, children }: { label: string; value: string | number; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">{label}<select className={performanceInputClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function ManagerSection({ title, context, section, monthly, members, role, onPickMember, scope, toolbar, paginate }: {
  title: string; context: string; section: LeadPerformanceSection; monthly: boolean;
  members: ManagerPerformanceMember[]; role: "lead" | "employee"; onPickMember: (member: ManagerPerformanceMember) => void;
  scope: ManagerDashboardQuery; toolbar?: ReactNode; paginate: boolean;
}) {
  const [panel, setPanel] = useState<"records" | "summary" | "trends" | "daily">("records");
  const { user } = useAuth();
  const manual = useGetManualTeamRangeQuery({ fromDate: section.efficiency.from, toDate: section.efficiency.to, viewerId: user?.id ?? 0, viewerRole: user?.role.roleType ?? null }, { skip: !user });
  const entries = (manual.currentData?.teams ?? []).flatMap(team => [...team.coders, ...(team.lead ? [{ user: team.lead, records: team.leadRecords }] : [])]);
  const enrichedMembers = members.map(member => ({ ...member, efficiency: { ...member.efficiency,
    adjustedDailyAverage: averageAdjustedTargets(entries.find(entry => entry.user.id === member.userId)?.records ?? []),
    adjustedRecordedDays: manual.currentData ? (entries.find(entry => entry.user.id === member.userId)?.records ?? []).filter(record => record.adjustedCpd != null).length : undefined,
  } }));
  const selectedIds = new Set(members.map(member => member.userId));
  const selectedRecords = entries.filter(entry => selectedIds.has(entry.user.id)).flatMap(entry => entry.records);
  const dailyRows = section.efficiency.daily.map(day => ({ ...day, adjustedRecordedDays: manual.currentData ? selectedRecords.filter(record => record.date === day.date && record.adjustedCpd != null).length : undefined, adjustedDailyAverage: averageAdjustedTargets(selectedRecords.filter(record => record.date === day.date)) }));
  const pickMember = (userId: number) => { const member = members.find((item) => item.userId === userId); if (member) onPickMember(member); };
  return <section aria-label={`${title} · ${context}`} className="flex min-w-0 flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-3">{toolbar ?? <p className="text-sm font-medium">{context} <span className="text-xs font-normal text-content-secondary">· {section.goal.userCount} people</span></p>}</div>
      <PerformanceTabs value={panel} onChange={setPanel} items={[{ value: "records", label: "People" }, { value: "daily", label: "Daily" }, { value: "summary", label: "Goal & rates" }, { value: "trends", label: "Trends" }]} label={`${title} view`} compact />
    </div>
    {manual.isFetching && <p role="status" className="text-xs text-content-muted">Loading per-day adjusted targets…</p>}
    {manual.isError && <p role="alert" className="text-xs text-danger">Adjusted Target CPD is unavailable. <button className="underline" onClick={() => manual.refetch()}>Retry</button></p>}
    {section.goal.userCount === 0 ? <EmptyState title={role === "lead" ? "No QA in this selection" : "No coders in this selection"} description="Select one or more teams, or adjust the filters to include more people." /> : panel === "summary" ? <>
      <PeriodGoalCard goal={section.goal} monthly={monthly} label={role === "lead" ? "QA goal" : "Coder goal"} />
      <PerformanceSummary summary={section.efficiency} label={`${title} performance summary`} />
    </> : panel === "trends" ? <ReportGraphs targetRecords={selectedRecords} sources={[section.efficiency.daily]} from={section.efficiency.from} to={section.efficiency.to} teamView />
      : panel === "daily" ? <DailyPerformance paginate={paginate} rows={dailyRows} month={section.efficiency.from.slice(0, 7)} periodLabel={dateRangeLabel(section.efficiency.from, section.efficiency.to)} title={`${title} · daily totals`} exportName={`manager-${role}-${section.efficiency.from}-to-${section.efficiency.to}`} showYear
        renderDayDetails={role === "employee" ? (date) => <ManagerCoderDay paginate={paginate} date={date} scope={scope} members={members} onPick={pickMember} /> : undefined} />
      : <div className="overflow-hidden rounded-xl border border-border bg-surface"><CoderPerformanceTable showUserSelector={!toolbar} paginate={false} enableEfficiencyFilters members={enrichedMembers} nameLabel={role === "lead" ? "Lead" : "Coder"} caption={`${title} · ${context}`} onPick={pickMember} exportName={`manager-${role}-${section.efficiency.from}-to-${section.efficiency.to}`} /></div>}
  </section>;
}
