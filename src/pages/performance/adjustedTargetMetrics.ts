import type { CoderMetrics } from "@/api/coderPerformance";
import type { DailyEfficiency } from "@/api/types";

export type PerformanceMetricField = keyof CoderMetrics | "adjustedTargetCpd";

/** Summary adjustedCpd is a period sum; daily adjustedCpd is one saved day's capacity. */
export function adjustedTargetCpd(metrics: CoderMetrics | null | undefined, daily?: DailyEfficiency[]): number | null {
  if (!metrics) return null;
  if (metrics.adjustedDailyAverage !== undefined) return metrics.adjustedDailyAverage;
  const rows = daily ?? (metrics as { daily?: DailyEfficiency[] }).daily;
  if (rows) {
    const known = rows.filter(row => row.adjustedCpd != null && Number.isFinite(Number(row.adjustedCpd)));
    return known.length ? known.reduce((sum, row) => sum + Number(row.adjustedCpd), 0) / known.length : null;
  }
  // A daily row already represents a per-day value. Never treat a period total as CPD.
  return "date" in metrics && metrics.adjustedCpd != null ? Number(metrics.adjustedCpd) : null;
}

export function averageAdjustedTargets(rows: { adjustedCpd?: string | null }[]): number | null {
  const known = rows.filter(row => row.adjustedCpd != null && Number.isFinite(Number(row.adjustedCpd)));
  return known.length ? known.reduce((sum, row) => sum + Number(row.adjustedCpd), 0) / known.length : null;
}
