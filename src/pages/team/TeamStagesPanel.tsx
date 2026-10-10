import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetTeamCoderOverviewQuery, useListTeamCohortsQuery } from "@/api/cohortsApi";
import { getErrorMessage } from "@/api/apiError";
import type { CoderStageFilter, FoundationProgress, StagePeriod, TeamCoderOverviewItem, TeamLeadSummary } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { inputClasses } from "@/components/ui/FormField";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";

const MAIN_STAGES: CoderStageFilter[] = ["Training", "M1", "M2", "M3", "M4", "Steady State"];
const FOUNDATION_STAGES = ["W1", "W2", "W3", "W4", "Steady State"];

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function rangeLabel(period: StagePeriod | undefined) {
  if (!period) return "";
  return `${dateLabel(period.startDate)} – ${period.endDate ? dateLabel(period.endDate) : period.stageCode === "Training" ? "end awaiting first completion" : "onward"}`;
}

function foundationLabel(progress: FoundationProgress) {
  switch (progress.eligibility) {
    case "eligible": return progress.currentStage ? `Foundation ${progress.currentStage}` : "Foundation not started";
    case "foundation_first": return "No weekly substages · Foundation first";
    case "same_day_unknown": return "Same-day first completions · order unknown";
    default: return "Awaiting first Foundation completion";
  }
}

function StageTimeline({ title, codes, periods, asOf, left, firstCompleted, joinedOn }: {
  title: string; codes: string[]; periods: StagePeriod[]; asOf: string; left: boolean;
  firstCompleted?: string | null; joinedOn?: string | null;
}) {
  return <section className="min-w-0">
    <h3 className="mb-3 text-sm font-semibold text-content-primary">{title}</h3>
    <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {codes.map((code) => {
        const period = periods.find((p) => p.stageCode === code);
        const current = period && period.startDate <= asOf && (!period.endDate || period.endDate >= asOf);
        const planned = period && period.startDate > asOf;
        let missing = left ? "Not reached before leaving" : "Awaiting first completed chart";
        if (code === "Training") missing = joinedOn && firstCompleted === joinedOn ? "Production began on joining date" : "Joining date not recorded";
        return <li key={code} className={`rounded-lg border p-3 ${current ? "border-brand-500 bg-brand-50" : "border-border bg-surface"}`}>
          <div className="text-sm font-semibold text-content-primary">{code}</div>
          <div className="mt-2 text-xs leading-5 text-content-secondary">{period ? rangeLabel(period) : missing}</div>
          {current && <div className="mt-2 text-xs font-medium text-brand-700">{left ? "At last working day" : "Current"}</div>}
          {planned && <div className="mt-2 text-xs text-content-muted">Scheduled</div>}
        </li>;
      })}
    </ol>
  </section>;
}

function StageDetails({ row }: { row: TeamCoderOverviewItem }) {
  return <div className="space-y-5 p-5">
    <StageTimeline title="Main stage timeline" codes={MAIN_STAGES} periods={row.periods} asOf={row.stageAsOf}
      left={!!row.coder.lastWorkingDay} firstCompleted={row.firstCompleted} joinedOn={row.joinedOn} />
    {row.foundation.eligibility === "eligible" ? <StageTimeline title="Foundation timeline · independent of the main stage"
      codes={FOUNDATION_STAGES} periods={row.foundation.periods} asOf={row.stageAsOf} left={!!row.coder.lastWorkingDay} />
      : <p className="text-sm text-content-secondary">{foundationLabel(row.foundation)}. {row.foundation.eligibility === "foundation_first" && "Later PVP completions do not start W1–W4."}</p>}
    <dl className="grid gap-3 text-xs sm:grid-cols-3">
      <div><dt className="text-content-muted">First completed Kairon chart</dt><dd>{dateLabel(row.firstCompleted)}</dd></div>
      <div><dt className="text-content-muted">First completed PVP chart</dt><dd>{dateLabel(row.foundation.firstPvpCompleted)}</dd></div>
      <div><dt className="text-content-muted">First completed Foundation chart</dt><dd>{dateLabel(row.foundation.firstFoundationCompleted)}</dd></div>
    </dl>
    {row.dataIssue && <p className="text-sm text-warning">{row.dataIssue}</p>}
    <p className="text-xs text-content-muted">{row.refreshedAt ? `Evidence refreshed ${new Date(row.refreshedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST.` : "Awaiting the first completed Kairon refresh."} Date ranges are inclusive. Stages advance by calendar date, even between imports.</p>
  </div>;
}

export function TeamStagesPanel({ leads, canManageTargets }: { leads: TeamLeadSummary[]; canManageTargets: boolean }) {
  const [page, setPage] = useState(1);
  const [cohortId, setCohortId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [stageCode, setStageCode] = useState<CoderStageFilter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const [draft, setDraft] = useState({ cohortId, leadId, stageCode });
  const filterCount = [cohortId, leadId, stageCode].filter((value) => value !== null).length;
  const openFilters = () => {
    setDraft({ cohortId, leadId, stageCode });
    setFiltersOpen(true);
  };
  const [expanded, setExpanded] = useState<number | null>(null);
  const cohorts = useListTeamCohortsQuery();
  const overview = useGetTeamCoderOverviewQuery({ page, pageSize: 25, cohortId, leadId, stageCode },
    { pollingInterval: 60_000, refetchOnFocus: true, refetchOnMountOrArgChange: true });
  if (overview.isLoading || cohorts.isLoading) return <LoadingState label="Loading stages…" />;
  if (overview.error) return <ErrorState message={getErrorMessage(overview.error)} onRetry={overview.refetch} />;
  if (cohorts.error) return <ErrorState message={getErrorMessage(cohorts.error)} onRetry={cohorts.refetch} />;
  const result = overview.data;
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-content-primary">{result?.total ?? 0} employees</p>
        <p className="text-xs text-content-muted">{filterCount ? `${filterCount} filter${filterCount === 1 ? "" : "s"} applied` : "All cohorts, leads, and stages"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={openFilters}>Filters{filterCount ? ` (${filterCount})` : ""}</Button>
        <Button variant="secondary" onClick={() => overview.refetch()} isLoading={overview.isFetching}>Refresh stages</Button>
        {canManageTargets && <Button variant="secondary" onClick={() => navigate("/team/stage-targets")}>Stage targets</Button>}
      </div>
    </div>
    <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Stage filters" description="Filter employees by cohort, lead, or main stage." widthClass="max-w-md">
      <div className="flex flex-col gap-5">
      <label className="text-xs font-medium text-content-secondary">Cohort
        <select aria-label="Cohort" className={`${inputClasses} mt-1 block`} value={draft.cohortId ?? "ALL"} onChange={(e) => setDraft({ ...draft, cohortId: e.target.value === "ALL" ? null : Number(e.target.value) })}>
          <option value="ALL">All cohorts</option><option value={0}>Unassigned / BAU</option>
          {(cohorts.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-content-secondary">Lead
        <select aria-label="Lead" className={`${inputClasses} mt-1 block`} value={draft.leadId ?? "ALL"} onChange={(e) => setDraft({ ...draft, leadId: e.target.value === "ALL" ? null : Number(e.target.value) })}>
          <option value="ALL">All leads</option><option value={0}>Unassigned</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-content-secondary">Main stage
        <select aria-label="Main stage" className={`${inputClasses} mt-1 block`} value={draft.stageCode ?? "ALL"} onChange={(e) => setDraft({ ...draft, stageCode: e.target.value === "ALL" ? null : e.target.value as CoderStageFilter })}>
          <option value="ALL">All stages</option>
          {MAIN_STAGES.map((s) => <option key={s}>{s}</option>)}<option value="Unassigned">No current stage</option>
        </select>
      </label>
        <div className="flex flex-wrap gap-2 border-t border-border pt-5">
          <Button onClick={() => {
            setCohortId(draft.cohortId); setLeadId(draft.leadId); setStageCode(draft.stageCode);
            setPage(1); setExpanded(null); setFiltersOpen(false);
          }}>Apply filters</Button>
          <Button variant="secondary" onClick={() => setDraft({ cohortId: null, leadId: null, stageCode: null })}>Reset</Button>
          <Button variant="ghost" onClick={() => setFiltersOpen(false)}>Cancel</Button>
        </div>
      </div>
    </Drawer>
    {!result?.items.length ? <EmptyState title="No coders match these filters" /> : <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase text-content-muted"><tr>
          {["Employee / joining date", "Main stage", "Foundation stage", "Timeline"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">{result.items.map((row) => <Fragment key={row.coder.id}>
          <tr>
            <td className="px-4 py-4 align-top"><div className="font-medium text-content-primary">{row.coder.firstName} {row.coder.lastName}</div>
              <div className="mt-1 text-xs text-content-muted">Joined {dateLabel(row.joinedOn)} · {row.coder.roleType}</div>
              {!row.coder.isActive && <div className="mt-1 text-xs font-medium text-warning">Left · last working day {dateLabel(row.coder.lastWorkingDay)}</div>}
            </td>
            <td className="px-4 py-4 align-top"><span className="font-semibold text-brand-700">{row.currentStage ?? "No current stage"}</span>
              <div className="mt-1 max-w-60 text-xs text-content-muted">{rangeLabel(row.periods.find((p) => p.stageCode === row.currentStage))}</div>
              {row.dailyTarget !== null && <div className="mt-2 text-xs">Main target: {row.dailyTarget} charts/day</div>}
            </td>
            <td className="px-4 py-4 align-top"><div className="max-w-64 font-medium text-content-secondary">{foundationLabel(row.foundation)}</div>
              <div className="mt-1 max-w-60 text-xs text-content-muted">{rangeLabel(row.foundation.periods.find((p) => p.stageCode === row.foundation.currentStage))}</div>
              {row.foundation.dailyTarget !== null && <div className="mt-2 text-xs">Foundation target: {row.foundation.dailyTarget} charts/day</div>}
            </td>
            <td className="px-4 py-4 align-top"><button type="button" className="font-medium text-brand-700 hover:underline" aria-expanded={expanded === row.coder.id} aria-controls={`stages-${row.coder.id}`} onClick={() => setExpanded(expanded === row.coder.id ? null : row.coder.id)}>{expanded === row.coder.id ? "Hide dates" : "View dates"}</button></td>
          </tr>
          {expanded === row.coder.id && <tr id={`stages-${row.coder.id}`} className="bg-surface-muted/50"><td colSpan={4}><StageDetails row={row} /></td></tr>}
        </Fragment>)}</tbody>
      </table></div>
      <PaginationControls page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} onPageChange={setPage} />
    </div>}
    <section aria-labelledby="stage-information-title" className="rounded-lg border border-border bg-surface p-4 text-sm text-content-secondary">
      <h2 id="stage-information-title" className="mb-2 font-semibold text-content-primary">Main stages and Foundation progress</h2>
      <p>Training starts on the joining date. The first completed Kairon chart starts M1; M1–M4 each last 30 calendar days.</p>
      <p className="mt-1">For PVP-first coders, the first completed Foundation chart starts four 7-day weeks, then Foundation Steady State. The main stage continues separately.</p>
      <p className="mt-3 text-xs text-content-muted">For former employees, the stage and target shown are those at their last working day. PVP uses the main-stage target. Eligible Foundation work uses its weekly target. Combined adjusted charts/day weights the completed mix by these rates and applies time deductions.</p>
    </section>
  </div>;
}
