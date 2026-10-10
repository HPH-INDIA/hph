import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { useState } from "react";

import { getErrorMessage } from "@/api/apiError";
import { useGetKaironManagerTeamRangeQuery, useGetKaironTeamRecordsQuery } from "@/api/reportsApi";
import type { KaironChartSummary, KaironManagerTeamRange } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { ActionScreen } from "@/components/ui/ActionScreen";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateViews";
import { useAuth } from "@/features/auth/useAuth";

import { KaironProductionCards, KaironTeamTable, type KaironTeamMember } from "./KaironRoleReports";
import { type ManualReportWindow } from "./manualReportSummary";

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

export function KaironManagerReport({ window }: { window: ManualReportWindow }) {
  const { user } = useAuth();
  const [selectedTeamKeys, setSelectedTeamKeys] = useState<string[] | null>(null);
  const [selectedMember, setSelectedMember] = useState<KaironTeamMember | null>(null);
  const [recordPage, setRecordPage] = useState(1);
  const [group, setGroup] = useState<"coders" | "qa">("coders");
  const { currentData, isFetching, isError, error, refetch } = useGetKaironManagerTeamRangeQuery(
    window, { skip: !user, refetchOnMountOrArgChange: true },
  );
  const { currentData: records, isFetching: recordsFetching, isError: recordsError, refetch: refetchRecords } = useGetKaironTeamRecordsQuery(
    { ...window, userId: selectedMember?.user.id ?? 0, page: recordPage, pageSize: 25 },
    { skip: !selectedMember, refetchOnMountOrArgChange: true },
  );
  const report = currentData?.fromDate === window.fromDate && currentData.toDate === window.toDate ? currentData : undefined;
  const teams = report?.teams ?? [];
  const selectedKeys = selectedTeamKeys ?? (teams[0] ? [teamKey(teams[0])] : []);
  const selectedTeams = teams.filter(team => selectedKeys.includes(teamKey(team)));
  const members: KaironTeamMember[] = selectedTeams.flatMap(team => group === "qa"
    ? team.lead ? [{ user: team.lead, summary: team.leadSummary }] : []
    : team.coders);
  const selectionLabel = selectedTeams.map(teamName).join(", ");
  const allCoders = sumSummaries(teams.flatMap((team) => team.coders.map((coder) => coder.summary)));
  const allQa = sumSummaries(teams.filter((team) => team.lead).map((team) => team.leadSummary));
  const period = windowLabel(window);

  const openMember = (member: KaironTeamMember) => {
    setSelectedMember(member);
    setRecordPage(1);
  };
  return (
    <section className="source-report kairon-manager-fit flex min-w-0 flex-col gap-3">
      <ActionScreen open={selectedMember !== null} onClose={() => setSelectedMember(null)}
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
      </ActionScreen>
      {!isError && report && <KaironProductionCards coders={allCoders} lead={allQa} />}
      {isError && <ErrorState message={`Couldn’t load Kairon records. ${getErrorMessage(error)}`} onRetry={refetch} />}
      {!isError && !report && <LoadingState label="Loading Kairon team production…" />}
      {!isError && report && !teams.length && <EmptyState title="No team members for this period" />}
      {report && teams.length > 0 && <section className="source-record-panel rounded-xl border border-border bg-surface p-4">
        <div className="source-table-scroll" tabIndex={0} role="region" aria-label="Kairon team production records">
          <KaironTeamTable key={`${selectedTeams.map(teamKey).join(",")}-${group}`} toolbar={        <>
          <SearchableMultiSelect label="Lead team" noun="teams"
            value={selectedTeams.map(teamKey)} onChange={setSelectedTeamKeys}
            options={teams.map(team => ({ value: teamKey(team), label: teamName(team), detail: `${team.coders.length} coders` }))} />
          <div role="group" aria-label="Kairon team records" className="flex gap-1 rounded-lg bg-surface-muted p-1">
            <Button variant={group === "coders" ? "primary" : "ghost"} aria-pressed={group === "coders"} onClick={() => setGroup("coders")}>Coders</Button>
            <Button variant={group === "qa" ? "primary" : "ghost"} aria-pressed={group === "qa"} onClick={() => setGroup("qa")}>QA</Button>
          </div>
          {isFetching && <span role="status" className="text-xs text-content-muted">Updating…</span>}
        </>} members={members}
            caption={`Kairon ${group} records for ${selectionLabel || "no selected teams"}, ${period}`} onSelect={openMember} />
        </div>
      </section>}
    </section>
  );
}
