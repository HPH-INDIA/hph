import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { displayNumber } from "@/utils/displayNumber";
import { useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetManualTeamRangeQuery } from "@/api/reportsApi";
import type { ManualTeamRangeEntry, ManualTeamRangeGroup } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/FormField";
import { ManualRecordStatusIndicator } from "@/components/ui/ManualRecordStatusIndicator";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { formatManualMeetings, manualTeamProduction, sumManualHours, sumManualProduction, type ManualReportWindow } from "./manualReportSummary";

const number = (value: number) => value.toLocaleString();
const teamKey = (team: ManualTeamRangeGroup) => team.lead ? `lead-${team.lead.id}` : "unassigned";
const userName = (user: ManualTeamRangeEntry["user"]) => `${user.firstName} ${user.lastName}`.trim();

function windowLabel(window: ManualReportWindow) {
  const format = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
  return window.fromDate === window.toDate ? format(window.fromDate) : `${format(window.fromDate)} – ${format(window.toDate)}`;
}

export function ProductionCards({ teams, label, compact = false, showApprovedCount = false }: { teams: ManualTeamRangeGroup[]; label: string; compact?: boolean; showApprovedCount?: boolean }) {
  const summary = manualTeamProduction(teams);
  const approved = showApprovedCount ? manualTeamProduction(teams, "approved") : null;
  return (
    <section aria-label={label} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {([
        { title: "Coder chart count", counts: summary.coders, qa: false },
        { title: "QA chart count", counts: summary.qa, qa: true },
      ]).map(({ title, counts, qa }) => (
        <article key={title} className={`min-w-0 rounded-lg border ${compact ? "p-3" : "p-4"} ${qa ? "border-brand-200 bg-brand-50" : "border-border bg-surface"}`}>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3">
            <div className="min-w-0">
              <h4 className={`${compact ? "text-xs" : "text-sm"} font-semibold text-content-secondary`}>{title}</h4>
              <p className={`mt-1 font-semibold tabular-nums ${compact ? "text-xl" : "text-2xl"} ${qa ? "text-brand-700" : "text-content-primary"}`}>{number(counts.production)}</p>
              {approved && <p className="mt-0.5 text-xs text-content-muted">Approved <strong className="font-semibold text-content-primary">{number(qa ? approved.qa.production : approved.coders.production)}</strong></p>}
            </div>
            <dl className="grid min-w-0 grid-cols-2 gap-2 border-l border-border pl-3">
              <div className="min-w-0">
                <dt className="text-xs text-content-muted">PVP</dt>
                <dd className={`${compact ? "text-lg" : "text-xl"} font-semibold tabular-nums text-content-primary`}>{number(counts.pvp)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-content-muted">Foundation</dt>
                <dd className={`${compact ? "text-lg" : "text-xl"} font-semibold tabular-nums text-content-primary`}>{number(counts.foundation)}</dd>
              </div>
            </dl>
          </div>
        </article>
      ))}
    </section>
  );
}

export function PeriodRecordsTable({ entries, caption, multipleDays, metric = "all", totalEntries = entries }: { totalEntries?: ManualTeamRangeEntry[]; entries: ManualTeamRangeEntry[]; caption: string; multipleDays: boolean; metric?: "all" | "production" | "time" }) {
  const totalRecords = totalEntries.flatMap(entry => entry.records);
  const production = sumManualProduction(totalRecords);
  const showProduction = metric !== "time";
  const showTime = metric !== "production";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            {["User", ...(multipleDays ? ["Days submitted"] : []), ...(showProduction ? ["PVP", "Foundation", "Total"] : []), ...(showTime ? ["Downtime (hours)", "Idle (hours)", "Leave (hours)", "Meeting (hours)", "Meetings"] : []), "Status"].map((title) => (
              <th key={title} scope="col" className="px-3 py-2 font-medium">{title}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map(({ user, records }) => {
            const counts = sumManualProduction(records);
            const submitted = records.length > 0;
            return (
              <tr key={user.id}>
                <th scope="row" className="px-3 py-3 font-medium text-content-primary">
                  <span className="block whitespace-nowrap">{userName(user)}</span>
                </th>
                {multipleDays && <td className="px-3 py-3 tabular-nums text-content-secondary">{new Set(records.map((record) => record.date)).size}</td>}
                {showProduction && <>
                  <td className="px-3 py-3 tabular-nums text-content-secondary">{submitted ? number(counts.pvp) : "—"}</td>
                  <td className="px-3 py-3 tabular-nums text-content-secondary">{submitted ? number(counts.foundation) : "—"}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-content-primary">{submitted ? number(counts.production) : "—"}</td>
                </>}
                {showTime && (["techIssuesDowntimeHours", "noInventoryIdleTimeHours", "leaveHours", "meetingEngagementHours"] as const).map((field) => (
                  <td key={field} className="px-3 py-3 tabular-nums text-content-secondary">{submitted ? displayNumber(sumManualHours(records, field)) : "—"}</td>
                ))}
                {showTime && <td className="max-w-xs px-3 py-3 text-content-secondary">{formatManualMeetings(records)}</td>}
                <td className="px-3 py-3">
                  {!submitted ? <span className="whitespace-nowrap text-content-muted">Not submitted</span> : records.length === 1 ? (
                    <div className="flex flex-col gap-1">
                      <ManualRecordStatusIndicator status={records[0].status} />
                      {records[0].status === "rejected" && records[0].rejectionReason && <span className="text-xs text-content-muted">{records[0].rejectionReason}</span>}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                      {(["approved", "pending", "rejected"] as const).map((status) => {
                        const count = records.filter((record) => record.status === status).length;
                        return count > 0 && <span key={status} className={`whitespace-nowrap ${status === "rejected" ? "text-danger" : "text-content-secondary"}`}>{count} {status}</span>;
                      })}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr><th scope="row" className="px-3 py-3">Total · all matching people</th>
          {multipleDays && <td className="px-3 py-3">{totalEntries.reduce((sum,entry) => sum + new Set(entry.records.map(record => record.date)).size,0)}</td>}
          {showProduction && (["pvp","foundation","production"] as const).map(key => <td key={key} className="px-3 py-3">{number(production[key])}</td>)}
          {showTime && (["techIssuesDowntimeHours","noInventoryIdleTimeHours","leaveHours","meetingEngagementHours"] as const).map(key => <td key={key} className="px-3 py-3">{displayNumber(sumManualHours(totalRecords,key))}</td>)}
          {showTime && <td>—</td>}<td>—</td>
        </tr></tfoot>
      </table>
    </div>
  );
}

export function ManagerManualReport({ window }: { window: ManualReportWindow }) {
  const { user } = useAuth();
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const [group, setGroup] = useState<"qa" | "coders">("coders");
  const [metric, setMetric] = useState<"production" | "time">("production");
  const [page, setPage] = useState(1);
  const { currentData, isFetching, isError, error, refetch } = useGetManualTeamRangeQuery(
    { ...window, viewerId: user?.id ?? 0, viewerRole: user?.role.roleType ?? null },
    { refetchOnMountOrArgChange: true, skip: !user },
  );
  const report = currentData?.fromDate === window.fromDate && currentData.toDate === window.toDate ? currentData : undefined;
  const teams = report?.teams ?? [];
  const activeTeam = teams.find((team) => teamKey(team) === selectedTeamKey) ?? teams[0];
  const period = windowLabel(window);
  const multipleDays = window.fromDate !== window.toDate;
  const activeName = activeTeam?.lead ? `${userName(activeTeam.lead)}’s team` : "Unassigned coders";
  const activeGroup = activeTeam?.lead ? group : "coders";
  const availableEntries = activeGroup === "qa" && activeTeam?.lead
    ? [{ user: activeTeam.lead, records: activeTeam.leadRecords }]
    : activeTeam?.coders ?? [];
  const [selectedUserIds, setSelectedUserIds] = useState<string[] | null>(null);
  const entries = selectedUserIds === null ? availableEntries : availableEntries.filter(entry => selectedUserIds.includes(String(entry.user.id)));
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedRecords = entries.flatMap((entry) => entry.records);
  const selectedTotal = sumManualProduction(selectedRecords).production;
  const selectedApproved = sumManualProduction(selectedRecords.filter((record) => record.status === "approved")).production;

  return (
    <div className="source-report">
      {!isError && report && <ProductionCards teams={teams} label="All teams manual production" compact showApprovedCount />}
    <section className="source-record-panel flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 data-metric="manual" className="metric-label font-semibold text-content-primary">Manual team records</h3>
          <p className="mt-1 text-xs text-content-muted">{period}</p>
        </div>

      </div>
      {isError && <ErrorState message={`Couldn’t load team records. ${getErrorMessage(error)}`} onRetry={refetch} />}
      {!isError && !report && <LoadingState label="Loading team production…" />}
      {!isError && report && teams.length === 0 && <EmptyState title="No team members for this period" />}
      {!isError && report && activeTeam && <>
        <div className="flex flex-wrap items-end gap-4 border-y border-border py-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-content-muted">
            Lead team
            <select className={inputClasses} value={teamKey(activeTeam)} onChange={(event) => { setSelectedTeamKey(event.target.value); setSelectedUserIds(null); setPage(1); }}>
              {teams.map((team) => <option key={teamKey(team)} value={teamKey(team)}>{team.lead ? userName(team.lead) : "Unassigned"} ({team.coders.length} coders)</option>)}
            </select>
          </label>
          <SearchableMultiSelect label="Users" noun="users" value={selectedUserIds ?? availableEntries.map(entry => String(entry.user.id))}
            options={availableEntries.map(entry => ({value:String(entry.user.id),label:userName(entry.user)}))} onChange={ids => {setSelectedUserIds(ids);setPage(1);}} />
          <div role="group" aria-label="Team records" className="flex gap-1 rounded-lg bg-surface-muted p-1">
            <Button type="button" variant={activeGroup === "qa" ? "primary" : "ghost"} disabled={!activeTeam.lead} aria-pressed={activeGroup === "qa"} onClick={() => { setGroup("qa"); setSelectedUserIds(null); setPage(1); }}>QA</Button>
            <Button type="button" variant={activeGroup === "coders" ? "primary" : "ghost"} aria-pressed={activeGroup === "coders"} onClick={() => { setGroup("coders"); setSelectedUserIds(null); setPage(1); }}>Coders ({activeTeam.coders.length})</Button>
          </div>
          <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-content-muted">
            Show metrics
            <select className={inputClasses} value={metric} onChange={(event) => setMetric(event.target.value as "production" | "time")}>
              <option value="production">Charts & status</option><option value="time">Time & meetings</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-content-primary">{activeName} · {activeGroup === "qa" ? "QA" : "Coder"} records</h4>
          <p className="text-xs text-content-muted">Submitted <strong className="text-content-primary">{number(selectedTotal)}</strong> · Approved <strong className="text-content-primary">{number(selectedApproved)}</strong></p>
        </div>
        {isFetching && <p role="status" className="text-xs text-content-muted">Updating team production…</p>}
        {entries.length === 0 ? <EmptyState title="No coders assigned to this team for this period" /> : <div className="source-table-scroll" tabIndex={0} role="region" aria-label="Manual team production records" aria-busy={isFetching}>
          <PeriodRecordsTable totalEntries={entries} entries={visibleEntries} caption={`${activeGroup === "qa" ? "QA" : "Coder"} records for ${activeName}, ${period}`} multipleDays={multipleDays} metric={metric} />
          <PaginationControls page={currentPage} pageSize={pageSize} total={entries.length} totalPages={totalPages} onPageChange={setPage} />
        </div>}
        <p className="text-xs text-content-muted">Submitted totals include pending and rejected entries. Approved totals remain separate. Switch metrics to see time and meeting details.</p>
      </>}
    </section>
    </div>
  );
}
