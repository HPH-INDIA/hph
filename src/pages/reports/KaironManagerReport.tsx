import { useId, useRef, useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetKaironManagerTeamRangeQuery, useGetKaironTeamRecordsQuery } from "@/api/reportsApi";
import type { KaironChartSummary, KaironManagerTeamRange } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";
import { KaironUploadFormPage } from "@/pages/kairon/KaironUploadFormPage";

import { KaironProductionCards, KaironTeamTable, type KaironTeamMember } from "./KaironRoleReports";
import { ManualReportFilters, type PeriodMode } from "./ManualReportFilters";
import { isReportWindow, reportToday, type ManualReportWindow } from "./manualReportSummary";

const number = (value: number) => value.toLocaleString();
const teamKey = (team: KaironManagerTeamRange["teams"][number]) => team.lead ? `lead-${team.lead.id}` : "unassigned";
const teamName = (team: KaironManagerTeamRange["teams"][number]) => team.lead
  ? `${team.lead.firstName} ${team.lead.lastName}`.trim() : "Unassigned";

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function windowLabel(window: ManualReportWindow) {
  return window.fromDate === window.toDate
    ? dateLabel(window.fromDate)
    : `${dateLabel(window.fromDate)} – ${dateLabel(window.toDate)}`;
}

function sumSummaries(summaries: KaironChartSummary[]): KaironChartSummary {
  return summaries.reduce((total, summary) => ({
    pvp: total.pvp + summary.pvp,
    foundation: total.foundation + summary.foundation,
    onHold: total.onHold + summary.onHold,
    total: total.total + summary.total,
  }), { pvp: 0, foundation: 0, onHold: 0, total: 0 });
}

export function KaironManagerReport() {
  const { user, hasFeature } = useAuth();
  const canWrite = hasFeature("reports", "write");
  const [window, setWindow] = useState<ManualReportWindow>(() => ({ fromDate: reportToday(), toDate: reportToday() }));
  const [draftWindow, setDraftWindow] = useState(window);
  const [draftMode, setDraftMode] = useState<PeriodMode>("day");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<KaironTeamMember | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { currentData, isFetching, isError, error, refetch } = useGetKaironManagerTeamRangeQuery(
    window, { skip: !user, refetchOnMountOrArgChange: true },
  );
  const { currentData: records, isFetching: recordsFetching, isError: recordsError, refetch: refetchRecords } = useGetKaironTeamRecordsQuery(
    { ...window, userId: selectedMember?.user.id ?? 0, page: recordPage, pageSize: 25 },
    { skip: !selectedMember, refetchOnMountOrArgChange: true },
  );
  const report = currentData?.fromDate === window.fromDate && currentData.toDate === window.toDate ? currentData : undefined;
  const teams = report?.teams ?? [];
  const activeTeam = teams.find((team) => teamKey(team) === selectedTeamKey) ?? teams[0];
  const allCoders = sumSummaries(teams.flatMap((team) => team.coders.map((coder) => coder.summary)));
  const allQa = sumSummaries(teams.filter((team) => team.lead).map((team) => team.leadSummary));
  const period = windowLabel(window);
  const dayView = window.fromDate === window.toDate;

  const closeFilters = () => {
    setDraftWindow(window);
    setFiltersOpen(false);
  };
  const applyFilters = () => {
    if (!isReportWindow(draftWindow)) return;
    setWindow(draftWindow);
    setSelectedMember(null);
    setRecordPage(1);
    setFiltersOpen(false);
  };
  const openMember = (member: KaironTeamMember) => {
    setSelectedMember(member);
    setRecordPage(1);
  };
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-content-primary">Kairon team records</h2>
          <p className="text-sm text-content-muted">View completed charts by lead and team.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filters</Button>
          {canWrite && <Button type="button" variant="secondary" onClick={() => setUploadOpen(true)}>Upload Kairon file</Button>}
        </div>
      </div>

      <Drawer open={filtersOpen} onClose={closeFilters} title="Kairon report filters"
        description="Choose a day, month, or custom date range." widthClass="max-w-md">
        <div className="flex flex-col gap-6">
          <ManualReportFilters mode={draftMode} value={draftWindow} onModeChange={setDraftMode} onChange={setDraftWindow} />
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5">
            <Button type="button" className="w-full" disabled={!isReportWindow(draftWindow)} onClick={applyFilters}>Apply filters</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={closeFilters}>Cancel</Button>
          </div>
        </div>
      </Drawer>
      <Drawer open={uploadOpen && canWrite} onClose={() => setUploadOpen(false)} title="Upload Kairon file"
        description="Upload a completed CSV batch for one reporting date." widthClass="max-w-2xl">
        <KaironUploadFormPage embedded onCancel={() => setUploadOpen(false)} onStarted={() => setUploadOpen(false)} />
      </Drawer>
      <Drawer open={selectedMember !== null} onClose={() => setSelectedMember(null)}
        title={selectedMember ? `${selectedMember.user.firstName} ${selectedMember.user.lastName} · Completed charts` : "Completed charts"}
        description={`${period} · ${number(selectedMember?.summary.total ?? 0)} completed charts`} widthClass="max-w-6xl">
        <div className="flex min-w-0 flex-col gap-4">
          {recordsError && <ErrorState message="Couldn't load this team member's charts." onRetry={refetchRecords} />}
          {!recordsError && recordsFetching && !records && <LoadingState label="Loading completed charts…" />}
          {!recordsError && records?.items.length === 0 && <EmptyState title="No completed charts for this period" />}
          {!recordsError && records && records.items.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Upload</th>
                      <th className="px-4 py-3 font-medium">Program</th>
                      <th className="px-4 py-3 font-medium">Level</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Completed</th>
                      <th className="px-4 py-3 font-medium">Last action</th>
                      <th className="px-4 py-3 font-medium">Practice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {records.items.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 text-content-secondary">#{record.batchId}</td>
                        <td className="px-4 py-3 text-content-secondary">{record.program}</td>
                        <td className="px-4 py-3 text-content-secondary">{record.level}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{record.created}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{record.completed ?? "—"}</td>
                        <td className="px-4 py-3 text-content-secondary">{record.lastAction ?? "—"}</td>
                        <td className="px-4 py-3 text-content-secondary">{record.practice ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={records.page} pageSize={records.pageSize} total={records.total}
                totalPages={records.totalPages} onPageChange={setRecordPage} />
            </>
          )}
        </div>
      </Drawer>
      <section className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-surface p-4">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
          <div>
            <h3 className="font-semibold text-content-primary">All teams · {period}</h3>
            <p className="mt-1 text-xs text-content-muted">Completed Kairon charts for your leads and coders in this period.</p>
          </div>
          {!isError && report && <KaironProductionCards coders={allCoders} lead={allQa} />}
        </div>
        {isError && <ErrorState message={`Couldn't load Kairon team records. ${getErrorMessage(error)}`} onRetry={refetch} />}
        {!isError && !report && <LoadingState label="Loading Kairon team production…" />}
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
                          {teamName(team)} ({team.coders.length})
                        </button>
                      );
                    })}
                  </div>
                </div>
                <section role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${teamKey(activeTeam)}`} tabIndex={0}
                  className="flex flex-col gap-4 rounded-b-lg border-x border-b border-border-strong bg-surface p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                  <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
                    <div>
                      <h3 className="font-semibold text-content-primary">{activeTeam.lead ? `${teamName(activeTeam)}’s team` : "Unassigned coders"}</h3>
                      <p className="text-sm text-content-muted">{activeTeam.coders.filter((coder) => coder.summary.total > 0).length} of {activeTeam.coders.length} coders completed charts {dayView ? "on this day" : "in this period"}.</p>
                    </div>
                    <KaironProductionCards coders={sumSummaries(activeTeam.coders.map((coder) => coder.summary))} lead={activeTeam.leadSummary} />
                  </div>
                  {activeTeam.lead && <div className="flex min-w-0 flex-col gap-2">
                    <h4 className="text-sm font-semibold text-content-secondary">QA production · {dayView ? "Lead daily record" : "Lead records"}</h4>
                    <KaironTeamTable members={[{ user: activeTeam.lead, summary: activeTeam.leadSummary }]}
                      caption={`QA Kairon records for ${teamName(activeTeam)}, ${period}`} onSelect={openMember} />
                  </div>}
                  <div className="flex min-w-0 flex-col gap-2">
                    <h4 className="text-sm font-semibold text-content-secondary">Coder production</h4>
                    {activeTeam.coders.length === 0 ? <EmptyState title="No coders in this team" /> : (
                      <KaironTeamTable members={activeTeam.coders} caption={`Coder Kairon records for ${teamName(activeTeam)}, ${period}`} onSelect={openMember} />
                    )}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}
