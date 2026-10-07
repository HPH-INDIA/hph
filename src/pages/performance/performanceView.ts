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

export function numberLabel(value: number | string | null | undefined, decimals = 0) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(Number(value));
}

export function chartLabel(value: number | string | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value));
}

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

export function dailyCsv(rows: DailyEfficiency[]) {
  const headers = ["Date", "Stage", "Manual charts completed", "Kairon charts completed", "Adjusted target CPD",
    "Manual CPD", "Kairon CPD", "Target CPD", "Manual efficiency (%)", "Kairon efficiency (%)"];
  const body = rows.map((row) => [row.date, row.stage, row.manualCharts, row.kaironCharts,
    row.adjustedCpd, row.manualCpd, row.kaironCpd, row.targetCpd,
    row.manualEfficiencyPercent, row.kaironEfficiencyPercent]);
  return [headers, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function memberCsv(members: CoderPerformanceMember[], nameLabel: "Coder" | "Lead" = "Coder") {
  const headers = [nameLabel, "Manual charts completed", "Kairon charts completed", "Adjusted target CPD", "Manual CPD", "Kairon CPD",
    "Target CPD", "Manual efficiency (%)", "Kairon efficiency (%)"];
  const body = members.map(({ name, efficiency }) => [name,
    efficiency?.manualCharts ?? 0, efficiency?.kaironCharts ?? 0,
    efficiency?.adjustedCpd,
    efficiency?.manualCpd, efficiency?.kaironCpd, efficiency?.targetCpd,
    efficiency?.manualEfficiencyPercent, efficiency?.kaironEfficiencyPercent]);
  return [headers, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  // Keep names and labels as text when the CSV is opened in a spreadsheet.
  const safe = typeof value === "string" && /^\s*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
