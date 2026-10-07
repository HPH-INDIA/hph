import type { DailyEfficiency } from "@/api/types";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import { numericSortValue, type SortColumn } from "@/components/ui/tableSort";

export const dailyColumns: SortColumn<DailyEfficiency>[] = [
  { key: "date", label: "Date", value: (row) => row.date, defaultDirection: "desc" },
  { key: "stage", label: "Stage", value: (row) => row.stage ?? "Unassigned" },
  ...([
    ["manualCharts", "Manual charts completed"], ["kaironCharts", "Kairon charts completed"],
    ["adjustedCpd", "Adjusted target CPD"], ["manualCpd", "Manual CPD"], ["kaironCpd", "Kairon CPD"],
    ["targetCpd", "Target CPD"], ["manualEfficiencyPercent", "Manual efficiency"], ["kaironEfficiencyPercent", "Kairon efficiency"],
  ] as const).map(([key, label]) => ({ key, label, value: (row: DailyEfficiency) => numericSortValue(row[key]), defaultDirection: "desc" as const })),
];

export const coderColumns: SortColumn<CoderPerformanceMember>[] = [
  { key: "name", label: "Coder", value: (row) => row.name },
  ...([
    ["manualCharts", "Manual charts completed"], ["kaironCharts", "Kairon charts completed"],
    ["adjustedCpd", "Adjusted target CPD"], ["manualCpd", "Manual CPD"],
    ["kaironCpd", "Kairon CPD"], ["targetCpd", "Target CPD"], ["manualEfficiencyPercent", "Manual efficiency"], ["kaironEfficiencyPercent", "Kairon efficiency"],
  ] as const).map(([key, label]) => ({ key, label, value: (row: CoderPerformanceMember) => numericSortValue(row.efficiency?.[key] ?? (key === "manualCharts" || key === "kaironCharts" ? 0 : null)), defaultDirection: "desc" as const })),
];
