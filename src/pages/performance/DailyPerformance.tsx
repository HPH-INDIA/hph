import { Button } from "@/components/ui/Button";
import { EfficiencyFilterControl } from "./EfficiencyFilterControl";
import { defaultEfficiencyFilter, efficiencyBands, filterMembersByEfficiency, type EfficiencyFilter } from "./efficiencyFilter";
import { MetricsTotalRow } from "./MetricsTotalRow";
import { Fragment, useId, useState, type ReactNode } from "react";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { sortTableRows, type TableSort } from "@/components/ui/tableSort";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { dailyColumns } from "./performanceColumns";
import type { DailyEfficiency } from "@/api/types";
import { dailyCsv, dayLabel, monthLabel } from "./performanceView";
import { PerformanceMetricValue } from "./PerformanceMetrics";
import { metricKeys } from "./metricConfiguration";

const controlClass = "min-h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
export function DailyPerformance({ rows, month, periodLabel = monthLabel(month), title = "Daily performance", description = "Compare daily charts, targets, and efficiency.", exportName = `performance-${month}`, showYear = false, renderDayDetails, embedded = false, paginate = true }: {
  rows: DailyEfficiency[]; month: string; periodLabel?: string; title?: string; description?: string; exportName?: string;
  showYear?: boolean; renderDayDetails?: (date: string) => ReactNode; embedded?: boolean; paginate?: boolean;
}) {
  const titleId = useId();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<EfficiencyFilter>(defaultEfficiencyFilter);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TableSort>({ key: "date", direction: "desc" });
  const columns = [dailyColumns[0], dailyColumns[1], ...metricKeys.all.map((key) => dailyColumns.find((column) => column.key === key)!)];
  const activeSort = columns.some((column) => column.key === sort.key) ? sort : { key: "date", direction: "desc" as const };
  const matchingRows = filterMembersByEfficiency(rows.map((row, index) => ({userId:index,name:row.date,isActive:true,efficiency:row})), filter).map(member => rows[member.userId]);
  const visible = sortTableRows(matchingRows, dailyColumns, activeSort);
  const filtered = filter.band !== "all";
  const pages = Math.max(1, Math.ceil(visible.length / 8));
  const currentPage = Math.min(page, pages);
  const paged = paginate ? visible.slice((currentPage - 1) * 8, currentPage * 8) : visible;
  const toggleDay = (date: string) => setExpandedDay((current) => current === date ? null : date);
  function download() {
    const url = URL.createObjectURL(new Blob(["\uFEFF", dailyCsv(visible)], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${exportName}${filtered ? "-filtered" : ""}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function reset() { setFilter(defaultEfficiencyFilter); setPage(1); }
  return <section aria-labelledby={titleId} className={embedded ? "min-w-0 overflow-hidden border-t border-border bg-surface" : "min-w-0 overflow-hidden rounded-xl border border-border bg-surface"}>
    <h2 id={titleId} className="sr-only">{title}</h2>
    <p className="sr-only">{description}</p>
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-content-secondary"><span>All metrics</span><span>{periodLabel}</span></div>
      <div className="flex flex-wrap items-center gap-2">
        <EfficiencyFilterControl value={filter} onChange={value => {setFilter(value);setPage(1);setExpandedDay(null);}} />
        <Button type="button" variant="secondary" onClick={download} disabled={!visible.length}>Export CSV</Button>
      </div>
    </div>
    {filtered && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-brand-50 px-4 py-2 text-xs text-brand-800">
      <span data-metric={filter.source} className="metric-label">{filter.source === "kairon" ? "Kairon" : "Manual"} · {efficiencyBands.find(band => band.value === filter.band)?.label} · {visible.length} of {rows.length} match</span>
      <button type="button" onClick={reset} className="min-h-8 rounded px-2 font-medium underline">Clear efficiency filter</button>
    </div>}
    {!visible.length ? <div className="border-t border-border px-5 py-10 text-center"><h3 className="text-sm font-semibold">{rows.length ? "No matching records" : "No records for this period"}</h3><p className="mt-2 text-sm text-content-secondary">{rows.length ? "Change the reporting period in Filters or clear the efficiency filter." : `Daily performance will appear for ${periodLabel} when records are available.`}</p>{rows.length > 0 && <button type="button" onClick={reset} className={`${controlClass} mt-4`}>Clear filters</button>}</div> : <div className="overflow-x-auto border-t border-border" tabIndex={0} role="region" aria-label="Daily performance records">
      <table className="min-w-[980px] w-full text-sm tabular-nums"><caption className="sr-only">Daily performance for {periodLabel}</caption><thead className="bg-surface-muted text-xs text-content-secondary"><tr>{columns.map((column, index) => <SortableHeader key={column.key} column={column} sort={activeSort} onSort={(value) => { setSort(value); setPage(1); }} align={index < 2 ? "left" : "center"} className={`px-3 py-3 font-medium ${column.key === "stage" ? "hidden sm:table-cell" : ""}`} />)}</tr></thead>
      <tbody>{paged.map((row) => <Fragment key={row.date}><tr className="border-t border-border hover:bg-surface-muted"><th scope="row" className="px-3 py-3 text-left font-medium">{renderDayDetails ? <button type="button" aria-expanded={expandedDay === row.date} aria-controls={`${titleId}-${row.date}`} onClick={() => toggleDay(row.date)} className="min-h-10 rounded text-left text-content-primary hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-500"><span aria-hidden="true">{expandedDay === row.date ? "−" : "+"} </span>{dayLabel(row.date, showYear)}</button> : <time dateTime={row.date}>{dayLabel(row.date, showYear)}</time>}<span className="mt-1 block text-xs text-content-muted sm:hidden">{row.stage ?? "Unassigned"}</span></th><td className="hidden px-3 py-3 text-xs text-content-secondary sm:table-cell">{row.stage ?? "Unassigned"}</td>{metricKeys.all.map((field) => <td key={field} className="px-3 py-3 text-center"><PerformanceMetricValue metrics={row} field={field} /></td>)}</tr>
      {renderDayDetails && expandedDay === row.date && <tr><td colSpan={columns.length} className="border-t border-border bg-surface-muted p-3"><div id={`${titleId}-${row.date}`} className="overflow-hidden rounded-lg border border-border bg-surface"><div className="flex items-center justify-between px-4 py-3"><h3 className="text-sm font-semibold">Coders · {dayLabel(row.date, true)}</h3><button type="button" onClick={() => setExpandedDay(null)} className="min-h-10 rounded px-3 text-sm text-brand-700">Close breakdown</button></div>{renderDayDetails(row.date)}</div></td></tr>}</Fragment>)}</tbody><MetricsTotalRow rows={visible} daily /></table>
    </div>}
    {paginate && <PaginationControls page={currentPage} pageSize={8} total={visible.length} totalPages={pages} onPageChange={(value) => { setPage(value); setExpandedDay(null); }} />}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-content-secondary"><span role="status">{visible.length} of {rows.length} records · {periodLabel}</span>{filtered ? <button type="button" onClick={reset} className="min-h-8 rounded text-brand-700 underline">Clear filters</button> : <span>Export includes all matching records and metrics.</span>}</div>
  </section>;
}
