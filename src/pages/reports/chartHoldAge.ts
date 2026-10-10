import type { KaironHoldAgeBucket } from "@/api/types";

export const holdAgeGroups: { key: KaironHoldAgeBucket; label: string; range: string; tone: string; accent: string }[] = [
  { key: "on_track", label: "On track", range: "0–10 days", tone: "bg-success-bg text-success", accent: "border-success" },
  { key: "monitor", label: "Monitor", range: "11–20 days", tone: "bg-surface-muted text-content-secondary", accent: "border-content-muted" },
  { key: "attention", label: "Needs attention", range: "21–30 days", tone: "bg-warning-bg text-warning", accent: "border-warning" },
  { key: "priority", label: "Priority review", range: "Over 30 days", tone: "bg-danger-bg text-danger", accent: "border-danger" },
  { key: "unknown", label: "Age unavailable", range: "Not reported", tone: "bg-surface-muted text-content-muted", accent: "border-border-strong" },
];

export function holdAgeGroup(age: number | null | undefined) {
  const key: KaironHoldAgeBucket = age == null || age < 0 ? "unknown" : age <= 10 ? "on_track" : age <= 20 ? "monitor" : age <= 30 ? "attention" : "priority";
  return holdAgeGroups.find((group) => group.key === key)!;
}
