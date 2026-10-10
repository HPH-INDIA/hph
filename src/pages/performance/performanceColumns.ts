import { adjustedTargetCpd } from "./adjustedTargetMetrics";
import type { DailyEfficiency } from "@/api/types";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import { numericSortValue, type SortColumn } from "@/components/ui/tableSort";

export const dailyColumns: SortColumn<DailyEfficiency>[] = [
  { key: "date", label: "Date", value: (row) => row.date, defaultDirection: "desc" },
  { key: "stage", label: "Stage", value: (row) => row.stage ?? "Unassigned" },
  ...([
    ["kaironCharts", "Kairon charts completed"], ["manualCharts", "Manual charts completed"],
    ["adjustedCpd", "Adjusted Targets"], ["kaironCpd", "Kairon CPD"], ["manualCpd", "Manual CPD"],
    ["targetCpd", "Target CPD"], ["kaironEfficiencyPercent", "Kairon efficiency"], ["manualEfficiencyPercent", "Manual efficiency"],
  ] as const).map(([key, label]) => ({ key, label, value: (row: DailyEfficiency) => numericSortValue(row[key]), defaultDirection: "desc" as const })),
  { key: "adjustedTargetCpd", label: "Adjusted Target CPD", value: (row) => adjustedTargetCpd(row), defaultDirection: "desc" },
];

export const coderColumns: SortColumn<CoderPerformanceMember>[] = [
  { key: "name", label: "Coder", value: (row) => row.name },
  ...([
    ["kaironCharts", "Kairon charts completed"], ["manualCharts", "Manual charts completed"],
    ["adjustedCpd", "Adjusted Targets"], ["kaironCpd", "Kairon CPD"],
    ["manualCpd", "Manual CPD"], ["targetCpd", "Target CPD"], ["kaironEfficiencyPercent", "Kairon efficiency"], ["manualEfficiencyPercent", "Manual efficiency"],
  ] as const).map(([key, label]) => ({ key, label, value: (row: CoderPerformanceMember) => numericSortValue(row.efficiency?.[key] ?? (key === "kaironCharts" || key === "manualCharts" ? 0 : null)), defaultDirection: "desc" as const })),
  { key: "adjustedTargetCpd", label: "Adjusted Target CPD", value: (row) => adjustedTargetCpd(row.efficiency, row.daily), defaultDirection: "desc" },
];
