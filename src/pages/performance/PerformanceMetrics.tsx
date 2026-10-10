import { adjustedTargetCpd, type PerformanceMetricField } from "./adjustedTargetMetrics";
import type { DailyEfficiency } from "@/api/types";
import { metricIdentity } from "@/components/ui/metricIdentity";
import type { CoderMetrics } from "@/api/coderPerformance";
import { EfficiencyValue } from "./EfficiencyValue";
import { numberLabel } from "./performanceView";

export function PerformanceMetricValue({ metrics, field, daily }: { metrics: CoderMetrics | null; field: PerformanceMetricField; daily?: DailyEfficiency[] }) {
  if (field === "kaironEfficiencyPercent" || field === "manualEfficiencyPercent") return <EfficiencyValue value={metrics?.[field] ?? null} />;
  if (field === "adjustedTargetCpd") return <span className="metric-value" data-metric="adjusted">{numberLabel(adjustedTargetCpd(metrics, daily), 2)}</span>;
  const isCount = field === "kaironCharts" || field === "manualCharts";
  return <span className="metric-value" data-metric={metricIdentity(field)}>{numberLabel(metrics?.[field] ?? (isCount ? 0 : null), isCount || field === "adjustedCpd" ? 0 : 2)}</span>;
}
