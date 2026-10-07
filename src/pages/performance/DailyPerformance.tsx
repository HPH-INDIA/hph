import { Fragment, useId, useState, type ReactNode } from "react";

import { SortableHeader, TableSortControls } from "@/components/ui/SortableHeader";
import { sortTableRows, type TableSort } from "@/components/ui/tableSort";
import { dailyColumns } from "./performanceColumns";

import type { DailyEfficiency } from "@/api/types";

import { EfficiencyValue } from "./EfficiencyValue";
import { dailyCsv, dayLabel, filterDays, monthLabel, numberLabel, type PerformanceFilter } from "./performanceView";

const controlClass = "min-h-10 rounded-md border border-border bg-surface text-sm text-content-secondary outline-none transition hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export function DailyPerformance({ rows, month, periodLabel = monthLabel(month), title = "Daily performance", description = "Your daily charts, targets, and efficiency in one place.", exportName = `performance-${month}`, showYear = false, renderDayDetails, embedded = false }: {
  rows: DailyEfficiency[];
  month: string;
  periodLabel?: string;
  title?: string;
  description?: string;
  exportName?: string;
  showYear?: boolean;
  renderDayDetails?: (date: string) => ReactNode;
  embedded?: boolean;
}) {
  const titleId = useId();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const toggleDay = (date: string) => setExpandedDays((current) => {
    const next = new Set(current);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PerformanceFilter>("all");
  const [sort, setSort] = useState<TableSort>({ key: "date", direction: "desc" });
  const visible = sortTableRows(filterDays(rows, filter, search, false), dailyColumns, sort);
  const filtered = search.trim() !== "" || filter !== "all";

  function download() {
    const blob = new Blob(["\uFEFF", dailyCsv(visible)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${exportName}${filtered ? "-filtered" : ""}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() { setSearch(""); setFilter("all"); }

  return (
    <section aria-labelledby={titleId} className={embedded ? "min-w-0 overflow-hidden border-t border-border bg-surface" : "min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-content-secondary">{description}</p>
        </div>
        <button type="button" onClick={download} disabled={!visible.length} className={`${controlClass} flex items-center gap-2 px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40`}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4" /></svg>
          Export CSV
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3 px-5 py-4">
        <label className="flex min-w-0 flex-1 basis-44 flex-col gap-1.5 text-xs font-medium text-content-secondary">
          Search records
          <span className="relative">
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-3 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search date or stage" className={`${controlClass} w-full py-2 pl-9 pr-3 font-normal placeholder:text-content-muted`} />
          </span>
        </label>
        <label className="flex flex-1 basis-40 flex-col gap-1.5 text-xs font-medium text-content-secondary sm:flex-none">
          Manual efficiency
          <select value={filter} onChange={(event) => setFilter(event.target.value as PerformanceFilter)} className={`${controlClass} py-2 pl-3 pr-7 font-normal`}>
            <option value="all">All records</option>
            <option value="below">Below target (&lt;100%)</option>
            <option value="achieved">Target met (≥100%)</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <div className="w-full sm:hidden"><TableSortControls columns={dailyColumns} sort={sort} onSort={setSort} /></div>
      </div>

      {!visible.length ? <div className="border-t border-border px-5 py-12 text-center">
        <p className="text-sm font-semibold">{rows.length ? "No matching records" : "No records for this period"}</p>
        <p className="mt-2 text-sm text-content-secondary">{rows.length ? "Try a different date, stage, or efficiency filter." : `Your daily performance will appear here when records are available for ${periodLabel}.`}</p>
        {rows.length > 0 && <button type="button" onClick={reset} className={`${controlClass} mt-4 px-4 font-medium`}>Clear filters</button>}
      </div> : <>
        <div className="hidden max-h-[580px] overflow-auto border-t border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:block" tabIndex={0} role="region" aria-label="Daily performance table; scroll to see more records and columns">
          <table className="w-full min-w-[1090px] border-separate border-spacing-0 text-sm tabular-nums">
            <caption className="sr-only">Daily performance for {periodLabel}. Adjusted target CPD is calculated from saved manual records.</caption>
            <thead className="sticky top-0 z-20 bg-surface-muted text-xs text-content-secondary">
              <tr>
                {dailyColumns.map((column, index) => <SortableHeader key={column.key} column={column} sort={sort} onSort={setSort} align={index < 2 ? "left" : "right"}
                  className={`border-b px-3 py-3 font-medium ${index === 0 ? "sticky left-0 z-30 bg-surface-muted pl-5" : ""} ${column.key === "adjustedCpd" ? "border-brand-200 bg-brand-50 text-brand-600" : "border-border"} ${index === dailyColumns.length - 1 ? "pr-5" : ""}`} />)}
              </tr>
            </thead>
            <tbody>{visible.map((row) => <Fragment key={row.date}><tr onClick={renderDayDetails ? () => toggleDay(row.date) : undefined} className={`group hover:bg-surface-muted ${renderDayDetails ? "cursor-pointer" : ""} ${expandedDays.has(row.date) ? "bg-brand-50" : ""}`}>
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-border bg-surface px-5 py-3 text-left font-medium group-hover:bg-surface-muted">{renderDayDetails
                ? <button type="button" aria-expanded={expandedDays.has(row.date)} aria-controls={`${titleId}-desktop-${row.date}`} aria-label={`${expandedDays.has(row.date) ? "Hide" : "Show"} coders for ${dayLabel(row.date, true)}`} onClick={(event) => { event.stopPropagation(); toggleDay(row.date); }} className="flex items-center gap-2 rounded py-1 text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><DayChevron expanded={expandedDays.has(row.date)} /><time dateTime={row.date}>{dayLabel(row.date, showYear)}</time></button>
                : <time dateTime={row.date} title={row.date}>{dayLabel(row.date, showYear)}</time>}</th>
              <td className="border-b border-border px-3 py-3"><Stage value={row.stage} /></td>
              <td className="border-b border-border px-3 py-3 text-right font-semibold">{numberLabel(row.manualCharts)}</td>
              <td className="border-b border-border px-3 py-3 text-right font-semibold">{numberLabel(row.kaironCharts)}</td>
              <td className="border-b border-brand-100 bg-brand-50 px-3 py-3 text-right font-semibold text-brand-600">{numberLabel(row.adjustedCpd, 2)}</td>
              <td className="border-b border-border px-3 py-3 text-right">{numberLabel(row.manualCpd, 1)}</td>
              <td className="border-b border-border px-3 py-3 text-right">{numberLabel(row.kaironCpd, 1)}</td>
              <td className="border-b border-border px-3 py-3 text-right text-content-secondary">{numberLabel(row.targetCpd, 1)}</td>
              <td className="border-b border-border px-3 py-3 text-right"><EfficiencyValue value={row.manualEfficiencyPercent} /></td>
              <td className="border-b border-border py-3 pl-3 pr-5 text-right"><EfficiencyValue value={row.kaironEfficiencyPercent} /></td>
            </tr>{renderDayDetails && expandedDays.has(row.date) && <tr><td colSpan={10} className="border-b border-brand-200 bg-brand-50 p-3">
              <div id={`${titleId}-desktop-${row.date}`} className="overflow-hidden rounded-lg border border-brand-200 bg-surface">
                <div className="flex items-center justify-between gap-3 px-4 py-3"><h3 className="text-sm font-semibold">Coders · {dayLabel(row.date, true)}</h3><button type="button" onClick={() => toggleDay(row.date)} aria-label={`Close coder details for ${dayLabel(row.date, true)}`} className="rounded px-2 py-1 text-xs font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500">Collapse</button></div>
                {renderDayDetails(row.date)}
              </div>
            </td></tr>}</Fragment>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-border border-t border-border sm:hidden">
          {visible.map((row) => <MobileDay key={row.date} row={row} showYear={showYear} expanded={expandedDays.has(row.date)} onToggle={renderDayDetails ? () => toggleDay(row.date) : undefined} detailsId={`${titleId}-mobile-${row.date}`}>
            {renderDayDetails && expandedDays.has(row.date) ? renderDayDetails(row.date) : null}
          </MobileDay>)}
        </div>
      </>}

      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-muted px-5 py-3 text-xs text-content-secondary">
        <span role="status" aria-live="polite">{visible.length} of {rows.length} records · {periodLabel}</span>
        {filtered && <button type="button" onClick={reset} className="rounded font-medium text-brand-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Clear filters</button>}
        {!filtered && <span>Adjusted CPD uses manual records · Huddle excluded</span>}
      </div>
    </section>
  );
}

function Stage({ value }: { value: string | null }) {
  return <span className="inline-block whitespace-nowrap rounded-full bg-surface-muted px-2.5 py-1 text-xs text-content-secondary">{value ?? "Unassigned"}</span>;
}

function DayChevron({ expanded }: { expanded: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m7.5 5 5 5-5 5" /></svg>;
}

function MobileDay({ row, showYear, expanded, onToggle, detailsId, children }: { row: DailyEfficiency; showYear: boolean; expanded: boolean; onToggle?: () => void; detailsId: string; children?: ReactNode }) {
  return (
    <article className="px-5 py-4">
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold"><time dateTime={row.date}>{dayLabel(row.date, showYear)}</time></h3><Stage value={row.stage} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-content-secondary">
        <div><dt>Manual charts completed</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-content-primary">{numberLabel(row.manualCharts)}</dd></div>
        <div><dt>Kairon charts completed</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-content-primary">{numberLabel(row.kaironCharts)}</dd></div>
        <div className="col-span-2 flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-brand-600"><dt className="font-medium">Adjusted target CPD</dt><dd className="text-sm font-semibold tabular-nums">{numberLabel(row.adjustedCpd, 2)}</dd></div>
      </dl>
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded py-1 text-xs font-medium text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
          CPD & efficiency <span className="text-base group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 text-xs text-content-secondary">
          <div><dt>Manual CPD</dt><dd className="mt-1 font-semibold tabular-nums text-content-primary">{numberLabel(row.manualCpd, 1)}</dd></div>
          <div><dt>Kairon CPD</dt><dd className="mt-1 font-semibold tabular-nums text-content-primary">{numberLabel(row.kaironCpd, 1)}</dd></div>
          <div><dt>Target CPD</dt><dd className="mt-1 font-semibold tabular-nums text-content-primary">{numberLabel(row.targetCpd, 1)}</dd></div>
          <div><dt>Manual efficiency</dt><dd className="mt-1"><EfficiencyValue value={row.manualEfficiencyPercent} /></dd></div>
          <div className="col-span-2"><dt>Kairon efficiency</dt><dd className="mt-1"><EfficiencyValue value={row.kaironEfficiencyPercent} /></dd></div>
        </dl>
      </details>
      {onToggle && <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailsId} aria-label={`${expanded ? "Hide" : "Show"} coders for ${dayLabel(row.date, true)}`} className="mt-4 flex min-h-10 w-full items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500">{expanded ? "Hide coder breakdown" : "View coder breakdown"}<DayChevron expanded={expanded} /></button>}
      {expanded && children && <div id={detailsId} className="mt-3 overflow-hidden rounded-lg border border-brand-200 bg-surface"><h4 className="bg-brand-50 px-4 py-3 text-sm font-semibold">Coders · {dayLabel(row.date, true)}</h4>{children}</div>}
    </article>
  );
}
