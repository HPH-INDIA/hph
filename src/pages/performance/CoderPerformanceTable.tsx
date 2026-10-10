import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { MetricsTotalRow } from "./MetricsTotalRow";
import { useState } from "react";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { sortTableRows, type TableSort } from "@/components/ui/tableSort";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { coderColumns } from "./performanceColumns";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import { MemberPerformanceExport } from "./MemberPerformanceExport";
import { PerformanceMetricValue } from "./PerformanceMetrics";
import { metricKeys } from "./metricConfiguration";
import { EfficiencyFilterControl } from "./EfficiencyFilterControl";
import { defaultEfficiencyFilter, efficiencyBands, filterMembersByEfficiency, type EfficiencyFilter } from "./efficiencyFilter";

export function CoderPerformanceTable({ members, caption, onPick, day = false, exportName, nameLabel = "Coder", paginate = true, enableEfficiencyFilters = false, showUserSelector = true }: {
  members: CoderPerformanceMember[]; caption: string; onPick?: (userId: number) => void;
  day?: boolean; exportName?: string; nameLabel?: "Coder" | "Lead"; paginate?: boolean; enableEfficiencyFilters?: boolean; showUserSelector?: boolean;
}) {
  const [sort, setSort] = useState<TableSort>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [efficiencyFilter, setEfficiencyFilter] = useState<EfficiencyFilter>(defaultEfficiencyFilter);
  const [selectedUserIds, setSelectedUserIds] = useState<string[] | null>(null);
  const userIds = members.map(member => String(member.userId));
  const selectedIds = selectedUserIds === null ? userIds : selectedUserIds.filter(id => userIds.includes(id));
  const selectedMembers = !showUserSelector || selectedUserIds === null ? members : members.filter(member => selectedIds.includes(String(member.userId)));
  const filteredMembers = enableEfficiencyFilters ? filterMembersByEfficiency(selectedMembers, efficiencyFilter) : selectedMembers;
  const isFiltered = enableEfficiencyFilters && efficiencyFilter.band !== "all";
  const resetFilter = () => { setEfficiencyFilter(defaultEfficiencyFilter); setPage(1); };
  const columns = [{ ...coderColumns[0], label: nameLabel }, ...metricKeys.all.map((key) => coderColumns.find((column) => column.key === key)!)];
  const activeSort = columns.some((column) => column.key === sort.key) ? sort : { key: "name", direction: "asc" as const };
  const sortedMembers = sortTableRows(filteredMembers, coderColumns, activeSort);
  const pages = Math.max(1, Math.ceil(filteredMembers.length / 8));
  const currentPage = Math.min(page, pages);
  const visible = paginate ? sortedMembers.slice((currentPage - 1) * 8, currentPage * 8) : sortedMembers;
  if (!members.length) return <p className="p-5 text-sm text-content-secondary">No {nameLabel === "Lead" ? "QA leads" : "coders"} in this selection.</p>;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">{showUserSelector && <SearchableMultiSelect label={nameLabel === "Lead" ? "QA users" : "Coders"} noun="users" value={selectedIds}
        options={members.map(member => ({value:String(member.userId),label:member.name,detail:member.isActive ? undefined : "Inactive"}))}
        onChange={ids => {setSelectedUserIds(ids);setPage(1);}} />}<p className="text-xs text-content-secondary">All metrics</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {enableEfficiencyFilters && <EfficiencyFilterControl value={efficiencyFilter} onChange={value => {setEfficiencyFilter(value);setPage(1);}} />}
        {exportName && <MemberPerformanceExport members={sortedMembers} exportName={`${exportName}${isFiltered ? "-filtered" : ""}`} nameLabel={nameLabel} />}
      </div>
    </div>
    {isFiltered && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-brand-50 px-4 py-2 text-xs text-brand-800">
      <span data-metric={efficiencyFilter.source} className="metric-label">{efficiencyFilter.source === "kairon" ? "Kairon" : "Manual"} · {efficiencyBands.find((band) => band.value === efficiencyFilter.band)?.label} · {filteredMembers.length} of {members.length} match</span>
      <button type="button" onClick={resetFilter} className="min-h-8 rounded px-2 font-medium underline">Clear efficiency filter</button>
    </div>}
    <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="compact-data-table min-w-[980px] w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-xs text-content-secondary"><tr>{columns.map((column, index) => <SortableHeader key={column.key} column={column} sort={activeSort} onSort={(value) => { setSort(value); setPage(1); }} align={index ? "center" : "left"} className={`px-4 py-1.5 font-medium`} />)}</tr></thead>
        <tbody className="divide-y divide-border">{visible.map((member) => <tr key={member.userId} className="hover:bg-surface-muted">
          <th scope="row" className="px-4 py-1 text-left font-normal sm:py-1.5">
            {onPick ? <button type="button" onClick={() => onPick(member.userId)} className="min-h-11 rounded text-left font-medium sm:min-h-7 text-content-primary hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-500">{member.name}</button> : <span className="font-medium">{member.name}</span>}
            {!member.isActive && <span className="mt-1 block text-xs text-content-secondary">Inactive</span>}
            {day && !member.efficiency && <span className="mt-1 block text-xs font-normal text-content-secondary">No records for this day</span>}
          </th>
          {metricKeys.all.map((field) => <td key={field} className={`px-4 py-1.5 text-center tabular-nums`}><PerformanceMetricValue metrics={member.efficiency} daily={member.daily} field={field} /></td>)}
        </tr>)}{!visible.length && <tr><td colSpan={columns.length} className="px-4 py-8 text-center"><p className="font-medium">No people match the selected users and filters.</p><button type="button" onClick={() => {resetFilter();setSelectedUserIds(null);}} className="mt-2 min-h-10 rounded px-3 text-brand-700 underline">Reset table filters</button></td></tr>}</tbody>
      <MetricsTotalRow rows={sortedMembers.map(member => member.efficiency ? {...member.efficiency, ...(member.daily ? {daily:member.daily} : {})} : null)} />
      </table>
    </div>
    {paginate && <PaginationControls page={currentPage} pageSize={8} total={filteredMembers.length} totalPages={pages} onPageChange={setPage} />}
    {(!paginate || pages <= 1) && <p role="status" className="border-t border-border px-4 py-2 text-xs text-content-secondary">Showing all {filteredMembers.length}{isFiltered ? ` of ${members.length}` : ""} {nameLabel === "Lead" ? "QA leads" : "coders"} · Export includes all matching people and metrics.</p>}
  </>;
}
