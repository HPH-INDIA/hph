import { useState } from "react";
import { SortableHeader, TableSortControls } from "@/components/ui/SortableHeader";
import { sortTableRows, type TableSort } from "@/components/ui/tableSort";
import { coderColumns } from "./performanceColumns";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import { EfficiencyValue } from "./EfficiencyValue";
import { numberLabel } from "./performanceView";
import { MemberPerformanceExport } from "./MemberPerformanceExport";

const headers = coderColumns.slice(1).map((column) => column.label);

export function CoderPerformanceTable({ members, caption, onPick, day = false, exportName }: {
  members: CoderPerformanceMember[];
  caption: string;
  onPick?: (userId: number) => void;
  day?: boolean;
  exportName?: string;
}) {
  const [sort, setSort] = useState<TableSort>({ key: "name", direction: "asc" });
  const sortedMembers = sortTableRows(members, coderColumns, sort);
  if (!members.length) return <p className="p-5 text-sm text-content-secondary">No coders in this selection.</p>;
  const identity = (member: CoderPerformanceMember) => <>
    {onPick ? <button type="button" onClick={() => onPick(member.userId)} className="rounded text-left font-medium text-brand-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500">{member.name}</button> : <span className="font-medium">{member.name}</span>}
    {!member.isActive && <div className="mt-1 text-xs text-content-secondary">Inactive</div>}
    {day && !member.efficiency && <span className="mt-1 block text-xs font-normal text-content-secondary">No records for this day</span>}
  </>;
  const values = (member: CoderPerformanceMember) => [
    numberLabel(member.efficiency?.manualCharts ?? 0), numberLabel(member.efficiency?.kaironCharts ?? 0),
    numberLabel(member.efficiency?.adjustedCpd, 2),
    numberLabel(member.efficiency?.manualCpd, 1), numberLabel(member.efficiency?.kaironCpd, 1), numberLabel(member.efficiency?.targetCpd, 1),
    <EfficiencyValue value={member.efficiency?.manualEfficiencyPercent ?? null} />,
    <EfficiencyValue value={member.efficiency?.kaironEfficiencyPercent ?? null} />,
  ];
  return <>
    {exportName && <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <p className="text-xs text-content-secondary">Totals for the selected period.{onPick ? " Select a coder’s name to focus their results." : ""}</p>
      <MemberPerformanceExport members={sortedMembers} exportName={exportName} />
    </div>}
    <div className="hidden min-w-0 overflow-x-auto sm:block" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[1120px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-xs text-content-secondary"><tr>{coderColumns.map((column, index) => <SortableHeader key={column.key} column={column} sort={sort} onSort={setSort} align={index ? "right" : "left"} className={`px-4 py-3 font-medium ${column.key === "adjustedCpd" ? "bg-brand-50 text-brand-600" : ""}`} />)}</tr></thead>
        <tbody className="divide-y divide-border">{sortedMembers.map((member) => <tr key={member.userId} className="hover:bg-brand-50/50">
          <th scope="row" className="px-4 py-3 font-normal">{identity(member)}</th>
          {values(member).map((value, index) => <td key={headers[index]} className={`px-4 py-3 text-right tabular-nums ${index === 2 ? "bg-brand-50 font-semibold text-brand-600" : ""}`}>{value}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className="border-b border-border px-4 py-3 sm:hidden"><TableSortControls columns={coderColumns} sort={sort} onSort={setSort} /></div>
    <div className="divide-y divide-border sm:hidden" aria-label={caption}>{sortedMembers.map((member) => <article key={member.userId} className="px-4 py-4">
      <div className="text-sm">{identity(member)}</div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">{values(member).map((value, index) => <div key={headers[index]} className={index === 2 ? "col-span-2 flex items-center justify-between gap-3 rounded-md bg-brand-50 px-3 py-2 text-brand-600" : ""}><dt className={`text-xs ${index === 2 ? "font-medium" : "text-content-secondary"}`}>{headers[index]}</dt><dd className={`${index === 2 ? "" : "mt-1"} text-sm font-semibold tabular-nums`}>{value}</dd></div>)}</dl>
    </article>)}</div>
  </>;
}
