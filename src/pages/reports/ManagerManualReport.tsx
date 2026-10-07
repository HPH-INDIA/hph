import { useId, useRef, useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetManualTeamRangeQuery } from "@/api/reportsApi";
import type { ManualTeamRangeEntry, ManualTeamRangeGroup } from "@/api/types";
import { ManualRecordStatusIndicator } from "@/components/ui/ManualRecordStatusIndicator";
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

export function PeriodRecordsTable({ entries, caption, multipleDays }: { entries: ManualTeamRangeEntry[]; caption: string; multipleDays: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            {["User", ...(multipleDays ? ["Days submitted"] : []), "PVP", "Foundation", "Total", "Downtime (hours)", "Idle (hours)", "Leave (hours)", "Meeting (hours)", "Meetings", "Status"].map((title) => (
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
                <td className="px-3 py-3 tabular-nums text-content-secondary">{submitted ? number(counts.pvp) : "—"}</td>
                <td className="px-3 py-3 tabular-nums text-content-secondary">{submitted ? number(counts.foundation) : "—"}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-content-primary">{submitted ? number(counts.production) : "—"}</td>
                {(["techIssuesDowntimeHours", "noInventoryIdleTimeHours", "leaveHours", "meetingEngagementHours"] as const).map((field) => (
                  <td key={field} className="px-3 py-3 tabular-nums text-content-secondary">{submitted ? sumManualHours(records, field) : "—"}</td>
                ))}
                <td className="px-3 py-3 text-content-secondary">{formatManualMeetings(records)}</td>
                <td className="px-3 py-3">
                  {!submitted ? <span className="whitespace-nowrap text-content-muted">Not submitted</span> : records.length === 1 ? (
                    <div className="flex flex-col gap-1">
                      <ManualRecordStatusIndicator status={records[0].status} />
                      {records[0].status === "rejected" && records[0].rejectionReason && <span className="text-xs text-content-muted">{records[0].rejectionReason}</span>}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-xs">
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
      </table>
    </div>
  );
}

export function ManagerManualReport({ window }: { window: ManualReportWindow }) {
  const { user } = useAuth();
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
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

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-surface p-4">

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <div>
          <h3 className="font-semibold text-content-primary">All teams · {period}</h3>
          <p className="mt-1 text-xs text-content-muted">Totals combine all submitted records; approved charts are shown separately.</p>
        </div>
        {!isError && report && <ProductionCards teams={teams} label="All teams production" compact showApprovedCount />}
      </div>
      {isError && <ErrorState message={`Couldn’t load team records. ${getErrorMessage(error)}`} onRetry={refetch} />}
      {!isError && !report && <LoadingState label="Loading team production…" />}
      {!isError && report && (
        <>
          {isFetching && <p role="status" className="text-sm text-content-muted">Updating team production…</p>}
          {teams.length === 0 && <EmptyState title="No team members for this period" />}
          {activeTeam && (
            <div className="min-w-0" aria-busy={isFetching}>
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div role="tablist" aria-label="Lead teams" className="flex w-max min-w-full items-end border-b border-border-strong pt-2">
                  {teams.map((team, index) => {
                    const key = teamKey(team);
                    const isActive = team === activeTeam;
                    return (
                      <button key={key} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab"
                        id={`${tabsId}-tab-${key}`} aria-controls={`${tabsId}-panel`} aria-selected={isActive} tabIndex={isActive ? 0 : -1}
                        onClick={() => setSelectedTeamKey(key)}
                        onKeyDown={(event) => {
                          let nextIndex: number;
                          if (event.key === "ArrowRight") nextIndex = (index + 1) % teams.length;
                          else if (event.key === "ArrowLeft") nextIndex = (index - 1 + teams.length) % teams.length;
                          else if (event.key === "Home") nextIndex = 0;
                          else if (event.key === "End") nextIndex = teams.length - 1;
                          else return;
                          event.preventDefault();
                          setSelectedTeamKey(teamKey(teams[nextIndex]));
                          tabRefs.current[nextIndex]?.focus();
                        }}
                        className={`relative -mb-px -mr-px inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-t-md border border-border-strong px-5 py-3 text-sm transition-colors focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand-600 ${isActive ? "z-10 min-h-14 border-b-surface bg-surface font-semibold text-brand-700" : "min-h-11 bg-surface-muted font-medium text-content-secondary hover:bg-brand-50 hover:text-brand-700"}`}>
                        {team.lead ? userName(team.lead) : "Unassigned"} ({team.coders.length})
                      </button>
                    );
                  })}
                </div>
              </div>
              <section role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${teamKey(activeTeam)}`} tabIndex={0}
                className="flex flex-col gap-4 rounded-b-lg border-x border-b border-border-strong bg-surface p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
                  <div>
                    <h3 className="font-semibold text-content-primary">{activeName}</h3>
                    <p className="text-sm text-content-muted">{activeTeam.coders.filter((coder) => coder.records.length > 0).length} of {activeTeam.coders.length} coders submitted {multipleDays ? "in this period" : "for this day"} · {period}</p>
                  </div>
                  <ProductionCards teams={[activeTeam]} label="Selected team production" compact />
                </div>
                {activeTeam.lead && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-content-secondary">QA production · {multipleDays ? "Lead records" : "Lead daily record"}</h4>
                    <PeriodRecordsTable entries={[{ user: activeTeam.lead, records: activeTeam.leadRecords }]} caption={`QA production for ${activeName}, ${period}`} multipleDays={multipleDays} />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-content-secondary">Coder production</h4>
                  {activeTeam.coders.length === 0 ? <p className="text-sm text-content-muted">No coders assigned to this team for this period.</p> : (
                    <PeriodRecordsTable entries={activeTeam.coders} caption={`Coder production for ${activeName}, ${period}`} multipleDays={multipleDays} />
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
