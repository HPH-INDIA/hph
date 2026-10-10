import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getErrorMessage } from "@/api/apiError";
import { useGetKaironHoldsQuery, useGetKaironHoldSummaryQuery } from "@/api/reportsApi";
import type { KaironHoldQuery, KaironHoldSummary, KaironHoldView } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/FormField";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ChartHoldCards, HoldArrow } from "./ChartHoldCards";
import { ChartHoldAges } from "./ChartHoldAges";
import { holdAgeGroups } from "./chartHoldAge";
import { ChartHoldRecords } from "./ChartHoldRecords";
import { holdDateError, holdFocus, holdSearch, readHoldSearch, updateHoldFilters, type HoldRole } from "./chartHoldsView";

const fieldClass = `${inputClasses} w-full min-w-0`;
const labelClass = "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-content-secondary";

export function ChartHoldsPage() {
  const { user } = useAuth();
  const role = user?.role.roleType;
  if (!user || (role !== "employee" && role !== "lead" && role !== "manager")) return <NotFoundPage />;
  return <HoldWorkspace key={user.id} viewerId={user.id} role={role} />;
}

function HoldWorkspace({ viewerId, role }: { viewerId: number; role: HoldRole }) {
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { pageRef.current?.scrollIntoView({ block: "start" }); }, []);
  const [params, setParams] = useSearchParams();
  const source = params.get("source") === "kairon" ? "kairon" : "dashboard";
  const query = readHoldSearch(params, role);
  const { page = 1, pageSize = 25, sortBy = "created", sortDirection = "desc", ...filters } = query;
  const view = filters.view!;
  const dateError = holdDateError(filters);
  const inventory = useGetKaironHoldSummaryQuery({ viewerId, filters: {} }, { refetchOnMountOrArgChange: true });
  const summary = useGetKaironHoldSummaryQuery({ viewerId, filters }, { skip: Boolean(dateError), refetchOnMountOrArgChange: true });
  const records = useGetKaironHoldsQuery({ viewerId, filters: query }, { skip: Boolean(dateError), refetchOnMountOrArgChange: true });
  const options = inventory.currentData;
  const data = !dateError && !records.error ? records.currentData : undefined;
  const breakdown = !dateError && !summary.error ? summary.currentData : undefined;
  const people = options?.users ?? [];
  const leads = people.filter((person) => person.roleType === "lead");
  const users = people.filter((person) =>
    (view === "all" || person.roleType === (view === "coders" ? "employee" : "lead")) &&
    (!filters.leadId || (filters.leadId === "unassigned" ? person.leadId === null : person.leadId === Number(filters.leadId))),
  );
  const showTeam = role === "manager" && view !== "leads";
  const busy = inventory.isFetching || summary.isFetching || records.isFetching;
  const update = (patch: Partial<KaironHoldQuery>, replace = true) => setParams(holdSearch(updateHoldFilters(query, patch), source), { replace, preventScrollReset: true });
  const clear = () => setParams(holdSearch({ view, pageSize, sortBy, sortDirection }, source), { replace: true, preventScrollReset: true });
  const userName = people.find((person) => person.id === filters.userId)?.name ?? "Selected user";
  const leadName = leads.find((person) => person.id === Number(filters.leadId))?.name ?? (filters.leadId === "unassigned" ? "Unassigned coders" : "Selected team");
  const selectedAge = holdAgeGroups.find((group) => group.key === filters.ageBucket);
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(selectedAge ? [{ key: "age", label: `${selectedAge.label} · ${selectedAge.range}`, clear: () => update({ ageBucket: undefined }) }] : []),
    ...(filters.createdFrom ? [{ key: "from", label: `From ${filters.createdFrom}`, clear: () => update({ createdFrom: undefined }) }] : []),
    ...(filters.createdTo ? [{ key: "to", label: `To ${filters.createdTo}`, clear: () => update({ createdTo: undefined }) }] : []),
    ...(filters.leadId ? [{ key: "lead", label: leadName, clear: () => update({ leadId: undefined }) }] : []),
    ...(filters.userId ? [{ key: "user", label: userName, clear: () => update({ userId: undefined }) }] : []),
    ...(filters.practice || filters.withoutPractice ? [{ key: "practice", label: filters.practice ?? "No practice specified", clear: () => update({ practice: undefined, withoutPractice: undefined }) }] : []),
  ];

  return <div ref={pageRef} className="mx-auto flex min-w-0 scroll-mt-8 max-w-screen-2xl flex-col gap-6 text-content-primary">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Link to={source === "kairon" ? "/reports?tab=kairon" : "/"} className={`mb-4 inline-flex items-center gap-2 rounded text-xs font-medium text-content-secondary hover:text-brand-700 ${holdFocus}`}><HoldArrow back />{source === "kairon" ? "Back to Kairon" : "Back to dashboard"}</Link>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Chart holds</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Current inventory</span></div>
        <p className="mt-2 text-sm text-content-secondary">Explore held charts by {role === "employee" ? "creation date and practice" : "creation date, team, user, and practice"}.</p>
      </div>
      <Button variant="secondary" disabled={busy} onClick={() => { void inventory.refetch(); if (!dateError) { void records.refetch(); void summary.refetch(); } }}>
        <svg aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></svg>
        Refresh
      </Button>
    </header>

    <section aria-label="Hold inventory views" className="flex flex-col gap-2">
      {inventory.error ? <ErrorState message={`Couldn't load hold totals. ${getErrorMessage(inventory.error)}`} onRetry={inventory.refetch} />
        : <ChartHoldCards role={role} summary={options} selectedView={view} href={(value) => `?${holdSearch({ view: value }, source)}`} onSelect={(value) => update({ view: value }, false)} />}
      <p className="text-xs text-content-muted">Inventory totals include all creation dates. Filters below apply to the breakdown and chart list.</p>
    </section>

    <section aria-label="Hold filters" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><svg aria-hidden="true" className="h-4 w-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 17h16M8 4v6m8 4v6" /></svg><h2 className="text-sm font-semibold">Filter charts</h2>{chips.length > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{chips.length}</span>}</div>
        <button type="button" disabled={!chips.length} onClick={clear} className={`rounded text-xs font-medium text-brand-700 hover:underline disabled:text-content-muted disabled:no-underline ${holdFocus}`}>Reset filters</button>
      </div>
      <div className={`grid gap-3 sm:grid-cols-2 ${showTeam ? "xl:grid-cols-5" : role === "employee" ? "lg:grid-cols-3" : "xl:grid-cols-4"}`}>
        <label className={labelClass}>Created from<input type="date" className={fieldClass} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "hold-date-error" : undefined} value={filters.createdFrom ?? ""} max={filters.createdTo}
          onChange={(event) => update({ createdFrom: event.target.value || undefined })} /></label>
        <label className={labelClass}>Created to<input type="date" className={fieldClass} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "hold-date-error" : undefined} value={filters.createdTo ?? ""} min={filters.createdFrom}
          onChange={(event) => update({ createdTo: event.target.value || undefined })} /></label>
        {showTeam && <label className={labelClass}>Lead team<select className={fieldClass} value={filters.leadId ?? ""} onChange={(event) => update({ leadId: event.target.value || undefined })}>
          <option value="">All lead teams</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
          {people.some((person) => person.leadId === null) && <option value="unassigned">Unassigned coders</option>}
          {filters.leadId && filters.leadId !== "unassigned" && !leads.some((lead) => lead.id === Number(filters.leadId)) && <option value={filters.leadId}>Selected team (unavailable)</option>}
        </select></label>}
        {role !== "employee" && <label className={labelClass}>User<select className={fieldClass} value={filters.userId ?? ""} onChange={(event) => update({ userId: event.target.value ? Number(event.target.value) : undefined })}>
          <option value="">All {view === "coders" ? "coders" : view === "leads" ? "QA leads" : "users"}</option>{users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          {filters.userId && !users.some((person) => person.id === filters.userId) && <option value={filters.userId}>Selected user (unavailable)</option>}
        </select></label>}
        <label className={labelClass}>Practice<select className={fieldClass} value={filters.withoutPractice ? "none" : filters.practice ? `practice:${filters.practice}` : ""}
          onChange={(event) => update({ practice: event.target.value.startsWith("practice:") ? event.target.value.slice(9) : undefined, withoutPractice: event.target.value === "none" || undefined })}>
          <option value="">All practices</option><option value="none">No practice specified</option>{options?.practices.map((practice) => <option key={practice} value={`practice:${practice}`}>{practice}</option>)}
          {filters.practice && !options?.practices.includes(filters.practice) && <option value={`practice:${filters.practice}`}>{filters.practice}</option>}
        </select></label>
      </div>
      {dateError && <p id="hold-date-error" role="alert" className="mt-3 text-sm text-danger">{dateError}</p>}
      {chips.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4" aria-label="Active hold filters">{chips.map((chip) => <button key={chip.key} type="button" onClick={chip.clear} aria-label={`Remove filter: ${chip.label}`} className={`inline-flex max-w-full items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-800 hover:bg-brand-100 ${holdFocus}`}><span className="truncate">{chip.label}</span><span aria-hidden="true">×</span></button>)}</div>}
    </section>

    {breakdown?.ageBuckets && <ChartHoldAges counts={breakdown.ageBuckets} selected={filters.ageBucket} onSelect={(ageBucket) => update({ ageBucket })} />}

    {!dateError && summary.error && <ErrorState message="Couldn't load the hold breakdown." onRetry={summary.refetch} />}
    {breakdown && role !== "employee" && <HoldBreakdown summary={breakdown} view={view} teamView={role === "manager" && view === "all"}
      selectedId={role === "manager" && view === "all" ? filters.leadId : filters.userId}
      onPick={(id) => update(role === "manager" && view === "all" ? { leadId: filters.leadId === String(id) ? undefined : String(id) } : { userId: filters.userId === Number(id) ? undefined : Number(id) })} />}

    <section aria-label="Chart hold results" className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-busy={records.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3"><h2 className="text-base font-semibold">Held charts</h2><span role="status" className="text-sm tabular-nums text-content-muted">{dateError ? "Check date filters" : data ? `${data.total.toLocaleString()} ${data.total === 1 ? "record" : "records"}` : records.error ? "Unavailable" : "Loading…"}</span></div>
        <label className="flex items-center gap-2 text-xs text-content-muted">Rows per page<select className="min-h-9 rounded-md border border-border bg-surface px-2 text-sm text-content-primary focus-visible:ring-2 focus-visible:ring-brand-500" value={pageSize} onChange={(event) => update({ pageSize: Number(event.target.value) })}>{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      {dateError ? <div className="p-6"><EmptyState title="Check the creation-date range" description="Correct or reset the dates to load held charts." /></div>
        : records.error ? <div className="p-5"><ErrorState message={`Couldn't load held charts. ${getErrorMessage(records.error)}`} onRetry={records.refetch} /></div>
          : !data ? <div className="p-6"><LoadingState label="Loading held charts…" /></div>
            : data.items.length === 0 ? <div className="flex flex-col items-center gap-3 p-8"><EmptyState title={data.total ? "No charts on this page" : "No holds match these filters"} description={data.total ? "The inventory changed. Return to the first page." : "Try another date range, user, or practice."} /><Button variant="secondary" onClick={data.total ? () => setParams(holdSearch({ ...query, page: 1 }, source), { replace: true }) : clear}>{data.total ? "First page" : "Reset filters"}</Button></div>
              : <ChartHoldRecords key={`${page}:${pageSize}:${sortBy}:${sortDirection}`} records={data.items} users={people} showTeam={role === "manager"} sortBy={sortBy} sortDirection={sortDirection} onSort={(column) => update({ sortBy: column, sortDirection: sortBy === column && sortDirection === "asc" ? "desc" : "asc" })} />}
      {data && data.total > 0 && <>
        <PaginationControls page={page} pageSize={pageSize} total={data.total} totalPages={data.totalPages} onPageChange={(next) => setParams(holdSearch({ ...query, page: next }, source), { preventScrollReset: true })} />
        {data.totalPages === 1 && <p className="border-t border-border px-5 py-3 text-xs text-content-muted">Showing {data.items.length} of {data.total} {data.total === 1 ? "chart" : "charts"}</p>}
      </>}
    </section>
  </div>;
}

function HoldBreakdown({ summary, view, teamView, selectedId, onPick }: {
  summary: KaironHoldSummary; view: KaironHoldView; teamView: boolean;
  selectedId?: string | number; onPick: (id: string | number) => void;
}) {
  const groups = (teamView
    ? [...new Set(summary.users.map((person) => person.leadId))].map((leadId) => ({
      id: leadId ?? "unassigned", name: summary.users.find((person) => person.id === leadId)?.name ?? "Unassigned coders",
      count: summary.users.filter((person) => person.leadId === leadId).reduce((total, person) => total + person.count, 0),
    }))
    : summary.users.filter((person) => person.roleType === (view === "coders" ? "employee" : "lead")))
    .filter((group) => group.count > 0).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  if (!groups.length) return null;
  const title = teamView ? "By lead team" : view === "coders" ? "By coder" : "By QA lead";
  return <details open className="group rounded-xl border border-border bg-surface">
    <summary className={`flex cursor-pointer list-none items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden ${holdFocus}`}><span>{title}<span className="ml-2 text-xs font-normal text-content-muted">{groups.length} {teamView ? "teams" : "people"} with holds</span></span><span aria-hidden="true" className="text-content-muted transition-transform group-open:rotate-180">⌄</span></summary>
    <div className="grid max-h-52 gap-2 overflow-y-auto px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">{groups.map((group) => <button key={group.id} type="button" aria-pressed={String(selectedId) === String(group.id)} onClick={() => onPick(group.id)} className={`min-w-0 rounded-lg border p-3 text-left transition-colors hover:border-brand-300 ${holdFocus} ${String(selectedId) === String(group.id) ? "border-brand-300 bg-brand-50" : "border-border bg-surface"}`}>
      <span className="flex items-center justify-between gap-3"><span className="truncate text-xs font-medium text-content-secondary">{group.name}</span><span className="text-sm font-semibold tabular-nums text-content-primary">{group.count.toLocaleString()}</span></span>
      <span aria-hidden="true" className="mt-2.5 block h-1 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-brand-400" style={{ width: `${group.count / summary.total * 100}%` }} /></span>
    </button>)}</div>
  </details>;
}
