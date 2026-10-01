import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/FormField";

import { isReportDate, isReportWindow, monthReportWindow, reportToday, shiftReportDay, shiftReportMonth, type ManualReportWindow } from "./manualReportSummary";

export type PeriodMode = "day" | "month" | "range";

interface ManualReportFiltersProps {
  mode: PeriodMode;
  value: ManualReportWindow;
  onModeChange: (mode: PeriodMode) => void;
  onChange: (window: ManualReportWindow) => void;
}

export function ManualReportFilters({ mode, value, onModeChange, onChange }: ManualReportFiltersProps) {
  const changeDay = (date: string) => {
    if (isReportDate(date)) onChange({ fromDate: date, toDate: date });
  };
  const changeMonth = (month: string) => {
    if (/^\d{4}-\d{2}$/.test(month) && isReportDate(`${month}-01`)) onChange(monthReportWindow(month));
  };
  const changeMode = (nextMode: PeriodMode) => {
    onModeChange(nextMode);
    if (nextMode === "day") changeDay(value.fromDate);
    if (nextMode === "month") changeMonth(value.fromDate.slice(0, 7));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-content-secondary">View by</span>
        <div role="group" aria-label="Report period" className="flex flex-col gap-2">
          {([["day", "Day"], ["month", "Month"], ["range", "Date range"]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => changeMode(key)}
              className={`w-full rounded-md border px-4 py-3 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${mode === key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border bg-surface text-content-secondary hover:bg-brand-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "day" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">Date
            <input type="date" value={value.fromDate} className={`${inputClasses} w-full`} onChange={(event) => changeDay(event.target.value)} />
          </label>
          <Button type="button" variant="secondary" className="w-full" onClick={() => changeDay(shiftReportDay(value.fromDate, -1))}>Previous day</Button>
          <Button type="button" variant="secondary" className="w-full" onClick={() => changeDay(shiftReportDay(value.fromDate, 1))}>Next day</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => changeDay(reportToday())}>Today</Button>
        </div>
      )}
      {mode === "month" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">Month
            <input type="month" value={value.fromDate.slice(0, 7)} className={`${inputClasses} w-full`} onChange={(event) => changeMonth(event.target.value)} />
          </label>
          <Button type="button" variant="secondary" className="w-full" onClick={() => changeMonth(shiftReportMonth(value.fromDate.slice(0, 7), -1))}>Previous month</Button>
          <Button type="button" variant="secondary" className="w-full" onClick={() => changeMonth(shiftReportMonth(value.fromDate.slice(0, 7), 1))}>Next month</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => changeMonth(reportToday().slice(0, 7))}>This month</Button>
        </div>
      )}
      {mode === "range" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">From date
            <input type="date" required value={value.fromDate} className={`${inputClasses} w-full`} onChange={(event) => onChange({ ...value, fromDate: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-content-secondary">To date
            <input type="date" required value={value.toDate} className={`${inputClasses} w-full`} onChange={(event) => onChange({ ...value, toDate: event.target.value })} />
          </label>
          {!isReportWindow(value) && <p role="alert" className="text-xs text-danger">Choose valid dates. The end date must be on or after the start date.</p>}
        </div>
      )}
    </div>
  );
}
