import type { CoderMetrics } from "@/api/coderPerformance";

type TotalInput = CoderMetrics & { targetMinutes?: number | null; adjustedTarget?: string | null; adjustedRecordedDays?: number; daily?: { adjustedCpd?: string | null }[] };
const known = (value: unknown): value is number | string => value != null && Number.isFinite(Number(value));
export function metricTotals(inputs: (TotalInput | null)[]): CoderMetrics {
  const rows = inputs.filter((row): row is TotalInput => row !== null);
  const sum = (field: "manualCharts" | "kaironCharts") => rows.reduce((total, row) => total + row[field], 0);
  const adjusted = rows.filter(row => known(row.adjustedCpd));
  const adjustedTotal = adjusted.reduce((total, row) => total + Number(row.adjustedCpd), 0);
  const capacityRows = rows.filter(row => known(row.targetMinutes));
  const efficiencyRows = rows.filter(row => known(row.adjustedTarget));
  const minutes = capacityRows.reduce((total, row) => total + Number(row.targetMinutes), 0);
  const capacity = efficiencyRows.reduce((total, row) => total + Number(row.adjustedTarget), 0);
  const rate = (field: "kaironCharts" | "manualCharts") => minutes > 0 ? String(capacityRows.reduce((total, row) => total + row[field], 0) * 480 / minutes) : null;
  const efficiency = (field: "kaironCharts" | "manualCharts") => capacity > 0 ? String(Math.min(120, efficiencyRows.reduce((total, row) => total + row[field], 0) * 100 / capacity)) : null;
  const counts = adjusted.map(row => row.adjustedRecordedDays ?? (row.daily ? row.daily.filter(day => known(day.adjustedCpd)).length : "date" in row ? 1 : null));
  const days = counts.reduce<number>((total, count) => total + (count ?? 0), 0);
  return { kaironCharts:sum("kaironCharts"), manualCharts:sum("manualCharts"), adjustedCpd:adjusted.length ? String(adjustedTotal) : null,
    adjustedDailyAverage: counts.every(count => count !== null) && days > 0 ? adjustedTotal / days : null,
    kaironCpd:rate("kaironCharts"), manualCpd:rate("manualCharts"), targetCpd:minutes > 0 && capacityRows.every(row => known(row.adjustedTarget)) ? String(capacityRows.reduce((total, row) => total + Number(row.adjustedTarget), 0) * 480 / minutes) : null,
    kaironEfficiencyPercent:efficiency("kaironCharts"), manualEfficiencyPercent:efficiency("manualCharts") };
}
