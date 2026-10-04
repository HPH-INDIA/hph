import { useState } from "react";

import type { DailyEfficiency } from "@/api/types";

import { EfficiencyValue } from "./EfficiencyValue";
import { dailyCsv, dayLabel, filterDays, monthLabel, numberLabel, type PerformanceFilter } from "./performanceView";

const controlClass = "min-h-10 rounded-md border border-border bg-surface text-sm text-content-secondary outline-none transition hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

export function DailyPerformance({ rows, month }: { rows: DailyEfficiency[]; month: string }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PerformanceFilter>("all");
  const [oldestFirst, setOldestFirst] = useState(false);
  const visible = filterDays(rows, filter, search, oldestFirst);
  const filtered = search.trim() !== "" || filter !== "all";

  function download() {
    const blob = new Blob(["\uFEFF", dailyCsv(visible)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `performance-${month}${filtered ? "-filtered" : ""}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() { setSearch(""); setFilter("all"); }

  return (
    <section aria-labelledby="daily-performance-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="daily-performance-title" className="text-base font-semibold">Daily performance</h2>
          <p className="mt-1 text-xs text-content-secondary">Your daily charts, targets, and efficiency in one place.</p>
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
        <button type="button" onClick={() => setOldestFirst((value) => !value)} aria-label={`Sort by date: ${oldestFirst ? "oldest" : "newest"} first`} className={`${controlClass} flex items-center justify-center gap-2 px-3`}>
          <svg viewBox="0 0 20 20" className={`h-4 w-4 ${oldestFirst ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3v14m-3-3 3 3 3-3m3-10h5m-5 5h3m-3 5h1" /></svg>
          {oldestFirst ? "Oldest first" : "Newest first"}
        </button>
      </div>

      {!visible.length ? <div className="border-t border-border px-5 py-12 text-center">
        <p className="text-sm font-semibold">{rows.length ? "No matching records" : "No records for this month"}</p>
        <p className="mt-2 text-sm text-content-secondary">{rows.length ? "Try a different date, stage, or efficiency filter." : `Your daily performance will appear here when records are available for ${monthLabel(month)}.`}</p>
        {rows.length > 0 && <button type="button" onClick={reset} className={`${controlClass} mt-4 px-4 font-medium`}>Clear filters</button>}
      </div> : <>
        <div className="hidden max-h-[580px] overflow-auto border-t border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:block" tabIndex={0} role="region" aria-label="Daily performance table; scroll to see more records and columns">
          <table className="w-full min-w-[1090px] border-separate border-spacing-0 text-sm tabular-nums">
            <caption className="sr-only">Daily performance for {monthLabel(month)}. Adjusted target CPD is calculated from saved manual records.</caption>
            <thead className="sticky top-0 z-20 bg-surface-muted text-xs text-content-secondary">
              <tr>
                <th scope="col" aria-sort={oldestFirst ? "ascending" : "descending"} className="sticky left-0 z-30 border-b border-border bg-surface-muted px-5 py-3 text-left font-medium">Date</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-left font-medium">Stage</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right font-medium">Manual charts<br />completed</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right font-medium">Kairon charts<br />completed</th>
                <th scope="col" className="border-b border-brand-200 bg-brand-50 px-3 py-3 text-right font-semibold text-brand-600">Adjusted<br />target CPD</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right font-medium">Manual<br />CPD</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right font-medium">Kairon<br />CPD</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right font-medium">Target<br />CPD</th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right font-medium">Manual<br />efficiency</th>
                <th scope="col" className="border-b border-border py-3 pl-3 pr-5 text-right font-medium">Kairon<br />efficiency</th>
              </tr>
            </thead>
            <tbody>{visible.map((row) => <tr key={row.date} className="group hover:bg-surface-muted">
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-border bg-surface px-5 py-3 text-left font-medium group-hover:bg-surface-muted"><time dateTime={row.date} title={row.date}>{dayLabel(row.date)}</time></th>
              <td className="border-b border-border px-3 py-3"><Stage value={row.stage} /></td>
              <td className="border-b border-border px-3 py-3 text-right font-semibold">{numberLabel(row.manualCharts)}</td>
              <td className="border-b border-border px-3 py-3 text-right font-semibold">{numberLabel(row.kaironCharts)}</td>
              <td className="border-b border-brand-100 bg-brand-50 px-3 py-3 text-right font-semibold text-brand-600">{numberLabel(row.adjustedCpd, 2)}</td>
              <td className="border-b border-border px-3 py-3 text-right">{numberLabel(row.manualCpd, 1)}</td>
              <td className="border-b border-border px-3 py-3 text-right">{numberLabel(row.kaironCpd, 1)}</td>
              <td className="border-b border-border px-3 py-3 text-right text-content-secondary">{numberLabel(row.targetCpd, 1)}</td>
              <td className="border-b border-border px-3 py-3 text-right"><EfficiencyValue value={row.manualEfficiencyPercent} /></td>
              <td className="border-b border-border py-3 pl-3 pr-5 text-right"><EfficiencyValue value={row.kaironEfficiencyPercent} /></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-border border-t border-border sm:hidden">
          {visible.map((row) => <MobileDay key={row.date} row={row} />)}
        </div>
      </>}

      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-muted px-5 py-3 text-xs text-content-secondary">
        <span role="status" aria-live="polite">{visible.length} of {rows.length} records · {monthLabel(month)}</span>
        {filtered && <button type="button" onClick={reset} className="rounded font-medium text-brand-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Clear filters</button>}
        {!filtered && <span>Adjusted CPD uses manual records · Huddle excluded</span>}
      </div>
    </section>
  );
}

function Stage({ value }: { value: string | null }) {
  return <span className="inline-block whitespace-nowrap rounded-full bg-surface-muted px-2.5 py-1 text-xs text-content-secondary">{value ?? "Unassigned"}</span>;
}

function MobileDay({ row }: { row: DailyEfficiency }) {
  return (
    <article className="px-5 py-4">
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold"><time dateTime={row.date}>{dayLabel(row.date)}</time></h3><Stage value={row.stage} /></div>
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
    </article>
  );
}
