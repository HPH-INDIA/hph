import type { PerformanceMetricField } from "./adjustedTargetMetrics";

export type PerformanceMetric = "charts" | "cpd" | "efficiency" | "all";
export const metricOptions: { value: PerformanceMetric; label: string }[] = [
  { value: "charts", label: "Charts" }, { value: "cpd", label: "CPD" },
  { value: "efficiency", label: "Efficiency" }, { value: "all", label: "All metrics" },
];
export const metricKeys: Record<PerformanceMetric, PerformanceMetricField[]> = {
  charts: ["kaironCharts", "manualCharts"],
  cpd: ["kaironCpd", "manualCpd", "targetCpd", "adjustedTargetCpd"],
  efficiency: ["kaironEfficiencyPercent", "manualEfficiencyPercent"],
  all: ["kaironCharts", "manualCharts", "adjustedCpd", "adjustedTargetCpd", "kaironCpd", "manualCpd", "targetCpd", "kaironEfficiencyPercent", "manualEfficiencyPercent"],
};
