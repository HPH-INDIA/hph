import { metricTotals } from "./metricTotals";
import type { CoderMetrics } from "@/api/coderPerformance";
import { adjustedTargetCpd } from "./adjustedTargetMetrics";
import type { DailyEfficiency } from "@/api/types";
import type { CoderPerformanceMember } from "@/api/coderPerformance";

export type PerformanceFilter = "all" | "below" | "achieved" | "unavailable";

export function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function dayLabel(day: string, showYear = false) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: showYear ? "numeric" : undefined, timeZone: "UTC",
  });
}

export { displayNumber as numberLabel, displayNumber as chartLabel } from "@/utils/displayNumber";

export function filterDays(rows: DailyEfficiency[], filter: PerformanceFilter, search: string, oldestFirst: boolean) {
  const term = search.trim().toLowerCase();
  return rows.filter((row) => {
    const value = row.manualEfficiencyPercent == null ? null : Number(row.manualEfficiencyPercent);
    const matchesFilter = filter === "all"
      || (filter === "unavailable" && value === null)
      || (filter === "below" && value !== null && value < 100)
      || (filter === "achieved" && value !== null && value >= 100);
    const matchesSearch = !term || [row.date, dayLabel(row.date), row.stage ?? "Unassigned"]
      .some((value) => value.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  }).sort((a, b) => oldestFirst ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
}

/** Numeric CSV cells are always numbers; unavailable metrics export as zero.
 * Round only at serialization so aggregate rates retain their precision. */
function csvMetric(value: unknown, decimals = 0): number {
  const number = value == null || value === "" ? 0 : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(decimals));
}
function csvMetrics(metrics: CoderMetrics | null, daily?: DailyEfficiency[]) {
  return [csvMetric(metrics?.kaironCharts), csvMetric(metrics?.manualCharts), csvMetric(metrics?.adjustedCpd),
    csvMetric(adjustedTargetCpd(metrics, daily), 2), csvMetric(metrics?.kaironCpd, 2),
    csvMetric(metrics?.manualCpd, 2), csvMetric(metrics?.targetCpd, 2),
    csvMetric(metrics?.kaironEfficiencyPercent), csvMetric(metrics?.manualEfficiencyPercent)];
}
const metricHeaders = ["Kairon charts completed", "Manual charts completed", "Adjusted Targets", "Adjusted Target CPD",
  "Kairon CPD", "Manual CPD", "Target CPD", "Kairon efficiency (%)", "Manual efficiency (%)"];

export function dailyCsv(rows: DailyEfficiency[]) {
  const headers = ["Date", "Stage", ...metricHeaders];
  const body = rows.map(row => [row.date, row.stage ?? "Unassigned", ...csvMetrics(row)]);
  if (rows.length) body.push(["Total", "All matching records", ...csvMetrics(metricTotals(rows))]);
  return [headers, ...body].map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function memberCsv(members: CoderPerformanceMember[], nameLabel: "Coder" | "Lead" = "Coder") {
  const headers = [nameLabel, ...metricHeaders];
  const body = members.map(({name, efficiency, daily}) => [name, ...csvMetrics(efficiency, daily)]);
  if (members.length) body.push(["Total", ...csvMetrics(metricTotals(members.map(member => member.efficiency
    ? {...member.efficiency, ...(member.daily ? {daily:member.daily} : {})} : null)))]);
  return [headers, ...body].map(row => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  // Keep names and labels as text when the CSV is opened in a spreadsheet.
  const safe = typeof value === "string" && /^\s*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
