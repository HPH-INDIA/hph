import type { CoderPerformanceMember } from "@/api/coderPerformance";

export type EfficiencyBand = "all" | "below80" | "80to100" | "achieved" | "unavailable";
export interface EfficiencyFilter { source: "kairon" | "manual"; band: EfficiencyBand }
export const defaultEfficiencyFilter: EfficiencyFilter = { source: "kairon", band: "all" };
export const efficiencyBands: { value: EfficiencyBand; label: string }[] = [
  { value: "all", label: "All efficiencies" },
  { value: "below80", label: "Below 80%" },
  { value: "80to100", label: "80% to below 100%" },
  { value: "achieved", label: "100% and above" },
  { value: "unavailable", label: "Efficiency unavailable" },
];

export function filterMembersByEfficiency(members: CoderPerformanceMember[], filter: EfficiencyFilter) {
  if (filter.band === "all") return members;
  return members.filter((member) => {
    const raw = member.efficiency?.[filter.source === "kairon" ? "kaironEfficiencyPercent" : "manualEfficiencyPercent"];
    const value = raw == null || raw.trim() === "" ? null : Number(raw);
    const available = value !== null && Number.isFinite(value);
    if (filter.band === "unavailable") return !available;
    if (!available) return false;
    if (filter.band === "below80") return value < 80;
    if (filter.band === "80to100") return value >= 80 && value < 100;
    return value >= 100;
  });
}
