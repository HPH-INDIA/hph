import { useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import {
  useGetKaironCompletedCountsQuery,
  useGetKaironCompletedRecordsQuery,
  useGetKaironLeadTeamRangeQuery,
  useGetKaironTeamHoldsQuery,
  useGetKaironTeamRecordsQuery,
} from "@/api/reportsApi";
import type { KaironChartRecord, KaironChartSummary, KaironCompletedDailyCount, ManualTeamUser } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { ManualReportFilters, type PeriodMode } from "./ManualReportFilters";
import { isReportWindow, reportToday, type ManualReportWindow } from "./manualReportSummary";

const number = (value: number) => value.toLocaleString();

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

export type KaironTeamMember = { user: ManualTeamUser; summary: KaironChartSummary };

export function KaironProductionCards({ coders, lead }: { coders: KaironChartSummary; lead: KaironChartSummary }) {
  return (
    <section aria-label="Team Kairon production" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {([
        { title: "Coder chart count", summary: coders, qa: false },
        { title: "QA chart count", summary: lead, qa: true },
      ]).map(({ title, summary, qa }) => (
        <article key={title} className={`min-w-0 rounded-lg border p-3 ${qa ? "border-brand-200 bg-brand-50" : "border-border bg-surface"}`}>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3">
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-content-secondary">{title}</h4>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${qa ? "text-brand-700" : "text-content-primary"}`}>{number(summary.total)}</p>
            </div>
            <dl className="grid min-w-0 grid-cols-2 gap-2 border-l border-border pl-3">
              <div className="min-w-0">
                <dt className="text-xs text-content-muted">PVP</dt>
                <dd className="text-lg font-semibold tabular-nums text-content-primary">{number(summary.pvp)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-content-muted">Foundation</dt>
                <dd className="text-lg font-semibold tabular-nums text-content-primary">{number(summary.foundation)}</dd>
              </div>
            </dl>
          </div>
        </article>
      ))}
    </section>
  );
}

export function KaironTeamTable({ members, caption, onSelect }: {
  members: KaironTeamMember[];
  caption: string;
  onSelect: (member: KaironTeamMember) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[620px] table-fixed text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-2/5" />
          <col className="w-1/5" />
          <col className="w-1/5" />
          <col className="w-1/5" />
        </colgroup>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 text-right font-medium">PVP</th>
            <th className="px-4 py-3 text-right font-medium">Foundation</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {members.map((member) => (
            <tr key={member.user.id} role="button" tabIndex={0}
              aria-label={`View ${member.user.firstName} ${member.user.lastName}'s completed charts`}
              className="cursor-pointer transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-600"
              onClick={() => onSelect(member)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(member);
                }
              }}>
              <th scope="row" className="px-4 py-3 text-left font-medium text-content-primary">
                {member.user.firstName} {member.user.lastName}
                <span className="block text-xs font-normal text-content-muted">{member.user.empId}</span>
              </th>
              <td className="px-4 py-3 text-right tabular-nums text-content-secondary">{number(member.summary.pvp)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-content-secondary">{number(member.summary.foundation)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-content-primary">{number(member.summary.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartRecordsTable({ records, showCompleted = false }: { records: KaironChartRecord[]; showCompleted?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={`w-full ${showCompleted ? "min-w-[850px]" : "min-w-[720px]"} text-left text-sm`}>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Upload</th>
            <th className="px-4 py-3 font-medium">Program</th>
            <th className="px-4 py-3 font-medium">Level</th>
            <th className="px-4 py-3 font-medium">Created</th>
            {showCompleted && <th className="px-4 py-3 font-medium">Completed</th>}
            <th className="px-4 py-3 font-medium">Last action</th>
            <th className="px-4 py-3 font-medium">Practice</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {records.map((record) => (
            <tr key={record.id}>
              <td className="px-4 py-3 text-content-secondary">#{record.batchId}</td>
              <td className="px-4 py-3 text-content-secondary">{record.program}</td>
              <td className="px-4 py-3 text-content-secondary">{record.level}</td>
              <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{record.created}</td>
              {showCompleted && <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{record.completed ?? "—"}</td>}
              <td className="px-4 py-3 text-content-secondary">{record.lastAction ?? "—"}</td>
              <td className="px-4 py-3 text-content-secondary">{record.practice ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayCountTable({ days, onSelect }: {
  days: KaironCompletedDailyCount[];
  onSelect: (day: KaironCompletedDailyCount) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Completed date</th>
            <th className="px-4 py-3 text-right font-medium">Charts completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {days.map((day) => (
            <tr key={day.date} role="button" tabIndex={0}
              aria-label={`View charts completed on ${dateLabel(day.date)}`}
              className="cursor-pointer transition-colors hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-600"
              onClick={() => onSelect(day)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(day);
                }
              }}>
              <th scope="row" className="px-4 py-3 text-left font-medium text-content-primary">{dateLabel(day.date)}</th>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-content-primary">{number(day.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KaironCoderReport() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [selectedDay, setSelectedDay] = useState<KaironCompletedDailyCount | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const { currentData, isFetching, isError, refetch } = useGetKaironCompletedCountsQuery(
    { page, pageSize: 25 }, { refetchOnMountOrArgChange: true },
  );
  const {
    currentData: dayRecords,
    isFetching: dayRecordsFetching,
    isError: dayRecordsError,
    refetch: refetchDayRecords,
  } = useGetKaironCompletedRecordsQuery(
    { completedDate: selectedDay?.date ?? "", userId: user?.id ?? 0, page: recordPage, pageSize: 25 },
    { skip: !selectedDay || !user, refetchOnMountOrArgChange: true },
  );
  const days = currentData?.items ?? [];
  const openDay = (day: KaironCompletedDailyCount) => {
    setSelectedDay(day);
    setRecordPage(1);
  };

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-content-primary">My Kairon records</h2>
        <p className="text-sm text-content-muted">Review your completed chart totals day by day.</p>
      </div>
      <Drawer open={selectedDay !== null} onClose={() => setSelectedDay(null)}
        title={selectedDay ? `Completed charts · ${dateLabel(selectedDay.date)}` : "Completed charts"}
        description={`${number(selectedDay?.count ?? 0)} completed charts`}
        widthClass="max-w-6xl">
        <div className="flex min-w-0 flex-col gap-4">
          {dayRecordsError && <ErrorState message="Couldn't load charts for this day." onRetry={refetchDayRecords} />}
          {!dayRecordsError && dayRecordsFetching && !dayRecords && <LoadingState label="Loading completed charts…" />}
          {!dayRecordsError && dayRecords?.items.length === 0 && <EmptyState title="No completed charts for this day" />}
          {!dayRecordsError && dayRecords && dayRecords.items.length > 0 && (
            <>
              <ChartRecordsTable records={dayRecords.items} />
              <PaginationControls page={dayRecords.page} pageSize={dayRecords.pageSize}
                total={dayRecords.total} totalPages={dayRecords.totalPages} onPageChange={setRecordPage} />
            </>
          )}
        </div>
      </Drawer>
      {isError && <ErrorState message="Couldn't load your completed dates." onRetry={refetch} />}
      {!isError && isFetching && !currentData && <LoadingState label="Loading completed dates…" />}
      {!isError && currentData && days.length === 0 && <EmptyState title="No completed charts available" />}
      {!isError && currentData && days.length > 0 && (
        <>
          <DayCountTable days={days} onSelect={openDay} />
          <PaginationControls
            page={currentData.page} pageSize={currentData.pageSize} total={currentData.total}
            totalPages={currentData.totalPages}
            onPageChange={(nextPage) => {
              setSelectedDay(null);
              setPage(nextPage);
            }}
          />
        </>
      )}
    </section>
  );
}

export function KaironLeadReport() {
  const { user } = useAuth();
  const [holdPage, setHoldPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<KaironTeamMember | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [window, setWindow] = useState<ManualReportWindow>(() => ({ fromDate: reportToday(), toDate: reportToday() }));
  const [appliedMode, setAppliedMode] = useState<PeriodMode>("day");
  const [draftWindow, setDraftWindow] = useState(window);
  const [draftMode, setDraftMode] = useState<PeriodMode>(appliedMode);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { currentData, isFetching, isError, error, refetch } = useGetKaironLeadTeamRangeQuery(
    window, { skip: !user, refetchOnMountOrArgChange: true },
  );
  const {
    currentData: holds,
    isFetching: holdsFetching,
    isError: holdsError,
    refetch: refetchHolds,
  } = useGetKaironTeamHoldsQuery(
    { page: holdPage, pageSize: 25 }, { skip: !user, refetchOnMountOrArgChange: true },
  );
  const {
    currentData: memberRecords,
    isFetching: memberRecordsFetching,
    isError: memberRecordsError,
    refetch: refetchMemberRecords,
  } = useGetKaironTeamRecordsQuery(
    { ...window, userId: selectedMember?.user.id ?? 0, page: recordPage, pageSize: 25 },
    { skip: !selectedMember, refetchOnMountOrArgChange: true },
  );
  const matchesWindow = currentData?.fromDate === window.fromDate && currentData.toDate === window.toDate;
  const missingSummary = Boolean(matchesWindow && (!currentData?.leadSummary || currentData.coders.some((coder) => !coder.summary)));
  const report = matchesWindow && !missingSummary ? currentData : undefined;
  const dayView = window.fromDate === window.toDate;
  const coderSummary = report?.coders.reduce<KaironChartSummary>((total, coder) => ({
    pvp: total.pvp + coder.summary.pvp,
    foundation: total.foundation + coder.summary.foundation,
    onHold: total.onHold + coder.summary.onHold,
    total: total.total + coder.summary.total,
  }), { pvp: 0, foundation: 0, onHold: 0, total: 0 });
  const closeFilters = () => {
    setDraftWindow(window);
    setDraftMode(appliedMode);
    setFiltersOpen(false);
  };
  const applyFilters = () => {
    if (!isReportWindow(draftWindow)) return;
    setWindow(draftWindow);
    setAppliedMode(draftMode);
    setSelectedMember(null);
    setRecordPage(1);
    setFiltersOpen(false);
  };
  const openMemberRecords = (member: KaironTeamMember) => {
    setSelectedMember(member);
    setRecordPage(1);
  };

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-content-primary">Kairon team records</h2>
          <p className="text-sm text-content-muted">Review completed charts for your team. Current holds appear below.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => {
          setDraftWindow(window);
          setDraftMode(appliedMode);
          setFiltersOpen(true);
        }}>Filters</Button>
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

      <Drawer open={selectedMember !== null} onClose={() => setSelectedMember(null)}
        title={selectedMember ? `${selectedMember.user.firstName} ${selectedMember.user.lastName} · Completed charts` : "Completed charts"}
        description={`${windowLabel(window)} · ${number(selectedMember?.summary.total ?? 0)} completed charts`}
        widthClass="max-w-6xl">
        <div className="flex min-w-0 flex-col gap-4">
          {memberRecordsError && <ErrorState message="Couldn't load this team member's charts." onRetry={refetchMemberRecords} />}
          {!memberRecordsError && memberRecordsFetching && !memberRecords && <LoadingState label="Loading completed charts…" />}
          {!memberRecordsError && memberRecords?.items.length === 0 && <EmptyState title="No completed charts for this period" />}
          {!memberRecordsError && memberRecords && memberRecords.items.length > 0 && (
            <>
              <ChartRecordsTable records={memberRecords.items} showCompleted />
              <PaginationControls page={memberRecords.page} pageSize={memberRecords.pageSize}
                total={memberRecords.total} totalPages={memberRecords.totalPages} onPageChange={setRecordPage} />
            </>
          )}
        </div>
      </Drawer>

      {isError && <ErrorState message={`Couldn't load Kairon team records. ${getErrorMessage(error)}`} onRetry={refetch} />}
      {!isError && missingSummary && <ErrorState message="The Kairon chart summary is not available on this server yet. Try again after the backend update." onRetry={refetch} />}
      {!isError && !missingSummary && !report && <LoadingState label="Loading Kairon team records…" />}
      {!isError && report && (
        <div className="flex min-w-0 flex-col gap-6" aria-busy={isFetching}>
          {isFetching && <p role="status" className="text-sm text-content-muted">Updating Kairon records…</p>}
          <section className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-surface p-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
              <div>
                <h3 className="font-semibold text-content-primary">My team · {windowLabel(window)}</h3>
                <p className="text-sm text-content-muted">{report.coders.filter((coder) => coder.summary.total > 0).length} of {report.coders.length} coders completed charts {dayView ? "on this day" : "in this period"}.</p>
              </div>
              {coderSummary && <KaironProductionCards coders={coderSummary} lead={report.leadSummary} />}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <h4 className="text-sm font-semibold text-content-secondary">My {dayView ? "daily record" : "records"}</h4>
              <KaironTeamTable members={[{ user: report.lead, summary: report.leadSummary }]}
                caption={`Lead Kairon records for ${windowLabel(window)}`} onSelect={openMemberRecords} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <h4 className="text-sm font-semibold text-content-secondary">Coder {dayView ? "daily records" : "records"}</h4>
              {report.coders.length === 0 ? (
                <EmptyState title="No coders in your team" />
              ) : (
                <KaironTeamTable members={report.coders.map((coder) => ({ user: coder.user, summary: coder.summary }))}
                  caption={`Coder Kairon records for ${windowLabel(window)}`} onSelect={openMemberRecords} />
              )}
            </div>
          </section>
          <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4" aria-label="On hold charts">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-semibold text-content-primary">On hold charts</h3>
                <p className="text-sm text-content-muted">Current holds for you and your coders, regardless of the selected dates.</p>
              </div>
              {holds && <p className="text-sm font-semibold tabular-nums text-content-primary">{number(holds.total)} charts</p>}
            </div>
            {holdsError && <ErrorState message="Couldn't load charts on hold." onRetry={refetchHolds} />}
            {!holdsError && holdsFetching && !holds && <LoadingState label="Loading charts on hold…" />}
            {!holdsError && holds?.items.length === 0 && <EmptyState title="No charts on hold" />}
            {!holdsError && holds && holds.items.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead className="bg-surface-muted text-xs uppercase tracking-wide text-content-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Analyst</th>
                        <th className="px-4 py-3 font-medium">Program</th>
                        <th className="px-4 py-3 font-medium">Level</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                        <th className="px-4 py-3 text-right font-medium">Age (days)</th>
                        <th className="px-4 py-3 font-medium">Last action</th>
                        <th className="px-4 py-3 font-medium">Practice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-surface">
                      {holds.items.map((record) => (
                        <tr key={record.id}>
                          <th scope="row" className="px-4 py-3 text-left font-medium text-content-primary">{record.codingAnalyst}</th>
                          <td className="px-4 py-3 text-content-secondary">{record.program}</td>
                          <td className="px-4 py-3 text-content-secondary">{record.level}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{record.created}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-content-secondary">{record.age ?? "—"}</td>
                          <td className="px-4 py-3 text-content-secondary">{record.lastAction ?? "—"}</td>
                          <td className="px-4 py-3 text-content-secondary">{record.practice ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={holds.page} pageSize={holds.pageSize} total={holds.total}
                  totalPages={holds.totalPages} onPageChange={setHoldPage}
                />
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
