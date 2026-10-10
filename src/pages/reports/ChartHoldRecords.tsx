import type { KaironChartRecord, KaironHoldSummary, KaironHoldSort } from "@/api/types";
import { holdAgeGroup } from "./chartHoldAge";
import { holdFocus, holdSortColumns } from "./chartHoldsView";

export function ChartHoldRecords({ records, users, showTeam, sortBy, sortDirection, onSort }: {
  records: KaironChartRecord[]; users: KaironHoldSummary["users"]; showTeam: boolean;
  sortBy: KaironHoldSort; sortDirection: "asc" | "desc"; onSort: (column: KaironHoldSort) => void;
}) {
  const people = new Map(users.map((user) => [user.id, user]));
  return <div className="max-h-[640px] overflow-auto" tabIndex={0} role="region" aria-label="Held chart records">
    <table className="w-full min-w-[980px] text-left text-sm">
      <caption className="sr-only">Current charts on hold matching the selected filters. Sorted by {holdSortColumns.find((column) => column.key === sortBy)?.label}, {sortDirection === "asc" ? "ascending" : "descending"}.</caption>
      <thead className="sticky top-0 z-10 bg-surface-muted text-xs text-content-secondary"><tr>
        {holdSortColumns.map(({ key, label }) => <th key={key} scope="col" aria-sort={sortBy === key ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className={`whitespace-nowrap px-5 py-3.5 font-medium ${key === "age" || key === "tat" ? "text-right" : ""}`}><button type="button" onClick={() => onSort(key)} className={`inline-flex items-center gap-2 rounded hover:text-brand-700 ${holdFocus} ${sortBy === key ? "text-brand-700" : ""}`} aria-label={`Sort by ${label}, ${sortBy === key && sortDirection === "asc" ? "descending" : "ascending"}`}>{label}<span aria-hidden="true">{sortBy === key ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</span></button></th>)}
      </tr></thead>
      <tbody className="divide-y divide-border bg-surface">{records.map((record) => {
        const owner = record.userId ? people.get(record.userId) : undefined;
        const lead = owner?.leadId ? people.get(owner.leadId) : undefined;
        const ageGroup = holdAgeGroup(record.age);
        return <tr key={record.id} className="transition-colors hover:bg-brand-50/30">
          <th scope="row" className="whitespace-nowrap px-5 py-4 font-medium tabular-nums text-content-primary">#{record.id}</th>
          <td className="px-5 py-4"><span className="block whitespace-nowrap font-medium text-content-primary">{owner?.name ?? record.codingAnalyst}</span>
            {showTeam && <span className="mt-1 block whitespace-nowrap text-xs text-content-muted">{lead ? `${lead.name} · team` : owner ? "Unassigned team" : "—"}</span>}
          </td>
          <td className="px-5 py-4"><span className="block text-content-secondary">{record.program}</span><span className="mt-1 inline-block rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-content-muted">{record.level}</span></td>
          <td className="whitespace-nowrap px-5 py-4 tabular-nums text-content-secondary">{record.created}</td>
          <td className="max-w-52 px-5 py-4 text-content-secondary">{record.practice || "—"}</td>
          <td className="min-w-40 max-w-72 px-5 py-4 text-content-secondary"><span className="block break-words">{record.lastAction ?? "—"}</span><span className="mt-1 block text-xs text-content-muted">{record.actions} {record.actions === 1 ? "action" : "actions"}</span></td>
          <td className="whitespace-nowrap px-5 py-4 text-right"><span className="block font-medium tabular-nums text-content-primary">{record.age != null && record.age >= 0 ? record.age : "—"}</span><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${ageGroup.tone}`}>{ageGroup.label}</span></td>
          <td className="px-5 py-4 text-right tabular-nums text-content-secondary">{record.tat ?? "—"}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
