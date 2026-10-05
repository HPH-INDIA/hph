import type { LeadDateMode, LeadFilters } from "./leadFilters";

export const performanceInputClass = "h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-content-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function ReportingPeriodFields({ draft, today, onChange }: { draft: LeadFilters; today: string; onChange: (value: LeadFilters) => void }) {
  const inputClass = performanceInputClass;
  return <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
          <h3 className="text-sm font-semibold">Reporting period</h3>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">View by
            <select className={inputClass} value={draft.dateMode} onChange={(event) => onChange({ ...draft, dateMode: event.target.value as LeadDateMode })}>
              <option value="from_start">From start (April 1)</option><option value="day">Day</option><option value="month">Month</option><option value="year">Year</option><option value="range">Date range</option>
            </select>
          </label>
          {draft.dateMode === "day" && <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">Day<input required type="date" min="2000-01-01" max={today} value={draft.day} onChange={(event) => onChange({ ...draft, day: event.target.value })} className={inputClass} /></label>}
          {draft.dateMode === "month" && <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">Month<input required type="month" min="2000-01" max={today.slice(0, 7)} value={draft.month} onChange={(event) => onChange({ ...draft, month: event.target.value })} className={inputClass} /></label>}
          {draft.dateMode === "year" && <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">Year<input required type="number" min={2000} max={Number(today.slice(0, 4))} value={draft.year || ""} onChange={(event) => onChange({ ...draft, year: Number(event.target.value) })} className={inputClass} /></label>}
          {draft.dateMode === "range" && <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">From<input required type="date" min="2000-01-01" max={draft.rangeEnd || today} value={draft.rangeStart} onChange={(event) => onChange({ ...draft, rangeStart: event.target.value })} className={inputClass} /></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">To<input required type="date" min={draft.rangeStart || "2000-01-01"} max={today} value={draft.rangeEnd} onChange={(event) => onChange({ ...draft, rangeEnd: event.target.value })} className={inputClass} /></label>
          </div>}
          {draft.dateMode === "from_start" && <p className="text-xs leading-relaxed text-content-secondary">From April 1 of the current financial year through today.</p>}
        </div>;
}
