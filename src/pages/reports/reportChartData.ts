import { officeHolidayDates } from "./officeHolidayCalendar";
import type { DailyEfficiency } from "@/api/types";

export type CpdTargetRecord = { date: string; dailyTarget?: number | null; adjustedCpd?: string | null };

export type GraphInterval = "day" | "week" | "month";
export interface ReportChartRow {
  date: string;
  label: string;
  target: number | null;
  adjusted: number | null;
  manual: number | null;
  kairon: number | null;
  targetCpd: number | null;
  adjustedCpd: number | null;
  manualCpd: number | null;
  kaironCpd: number | null;
  idle: number;
  downtime: number;
  meeting: number;
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function intervalKey(date: string, interval: GraphInterval) {
  if (interval === "day") return date;
  if (interval === "month") return date.slice(0, 7);
  const monday = new Date(`${date}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return dateKey(monday);
}

export function intervalLabel(key: string, interval: GraphInterval) {
  const date = new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);
  const label = date.toLocaleDateString("en-US", { month: "short", ...(interval === "month" ? { year: "numeric" } : { day: "numeric" }), timeZone: "UTC" });
  return interval === "week" ? `Week of ${label}` : label;
}

/** Upright two-line axis labels; full date remains in the tooltip/readout. */
export function axisDateLabel(key: string, interval: GraphInterval) {
  const date = new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);
  const month = date.toLocaleDateString("en-US", {month: "short", timeZone: "UTC"});
  return interval === "month" ? {top: month, bottom: String(date.getUTCFullYear())}
    : {top: `${interval === "week" ? "Wk " : ""}${date.getUTCDate()}`, bottom: month};
}

function sumKnown(values: Array<number | string | null | undefined>) {
  const known = values.filter((value) => value != null && Number.isFinite(Number(value)));
  return known.length ? known.reduce<number>((sum, value) => sum + Number(value), 0) : null;
}
function meanKnown(values: Array<number | string | null | undefined>) {
  const known = values.filter((value) => value != null && Number.isFinite(Number(value)));
  const total = sumKnown(known);
  return total === null ? null : total / known.length;
}

// All charts consume this exact ordered domain. Missing weekdays keep their slot;
// weekend records stay visible without adding empty weekends to the timeline.
export function buildReportChartRows(sources: DailyEfficiency[][], from: string, to: string, interval: GraphInterval, compactNonWorkingDays = false, targetRecords?: CpdTargetRecord[]): ReportChartRow[] {
  const days = new Map<string, DailyEfficiency[]>();
  for (const rows of sources) for (const row of rows) {
    if (row.date < from || row.date > to) continue;
    const day = days.get(row.date) ?? [];
    day.push(row);
    days.set(row.date, day);
  }
  for (const day = new Date(`${from}T00:00:00Z`); dateKey(day) <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6 && !days.has(dateKey(day))) days.set(dateKey(day), []);
  }
  const groups = new Map<string, DailyEfficiency[]>();
  for (const [date, rows] of [...days.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const nonWorking = weekday === 0 || weekday === 6 || officeHolidayDates.has(date);
    if (compactNonWorkingDays && nonWorking && !rows.some(row => row.kaironCharts > 0 || row.manualCharts > 0)) continue;
    const key = intervalKey(date, interval);
    groups.set(key, [...(groups.get(key) ?? []), ...rows]);
  }
  // Aggregated team rows contain sums, not one person's daily targets.
  // Separate individual records supply the CPD denominator without changing production.
  const targetGroups = new Map<string, CpdTargetRecord[]>();
  for (const record of targetRecords ?? []) {
    if (record.date < from || record.date > to) continue;
    const dayRows = days.get(record.date);
    const weekday = new Date(`${record.date}T00:00:00Z`).getUTCDay();
    if (compactNonWorkingDays && (weekday === 0 || weekday === 6 || officeHolidayDates.has(record.date))
      && !dayRows?.some(row => row.kaironCharts > 0 || row.manualCharts > 0)) continue;
    const key = intervalKey(record.date, interval);
    targetGroups.set(key, [...(targetGroups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([date, rows]) => {
    const targets = targetRecords === undefined ? rows : targetGroups.get(date) ?? [];
    const capacityRows = rows.filter((row) => row.targetMinutes !== null);
    const minutes = capacityRows.reduce((sum, row) => sum + row.targetMinutes!, 0);
    const actualCpd = (key: "manualCharts" | "kaironCharts") => minutes > 0
      ? capacityRows.reduce((sum, row) => sum + row[key], 0) * 480 / minutes : null;
    return {
      date, label: intervalLabel(date, interval),
      target: sumKnown(rows.map((row) => row.dailyTarget)),
      adjusted: sumKnown(rows.map((row) => row.adjustedTarget)),
      manual: rows.length ? rows.reduce((sum, row) => sum + row.manualCharts, 0) : null,
      kairon: rows.length ? rows.reduce((sum, row) => sum + row.kaironCharts, 0) : null,
      targetCpd: meanKnown(targets.map((row) => row.dailyTarget)),
      // Use the saved manual CPD, which follows the existing Huddle exception.
      adjustedCpd: meanKnown(targets.map((row) => row.adjustedCpd)),
      manualCpd: actualCpd("manualCharts"), kaironCpd: actualCpd("kaironCharts"),
      idle: rows.reduce((sum, row) => sum + row.idleMinutes / 60, 0),
      downtime: rows.reduce((sum, row) => sum + row.downtimeMinutes / 60, 0),
      meeting: rows.reduce((sum, row) => sum + row.meetingMinutes / 60, 0),
    };
  });
}

export function chartGeometry(widths: number[], count: number) {
  const narrowest = Math.max(81, Math.min(...widths));
  const visibleCount = Math.max(1, Math.min(count, 12, Math.floor((narrowest - 80) / 58)));
  return {
    visibleCount,
    maxStart: Math.max(0, count - visibleCount),
    charts: widths.map((width) => {
      // Scale horizontal margins too: a date has the same relative viewport
      // position in the full-width lost-hours chart and both narrower charts.
      const left = 52 * width / narrowest;
      const right = 28 * width / narrowest;
      const step = Math.max(1, (width - left - right) / visibleCount);
      return { step, left, right, width: Math.max(width, left + right + count * step) };
    }),
  };
}
