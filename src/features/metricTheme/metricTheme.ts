import type { AuthUser } from "@/api/types";

export const metricStyles = [
  { key: "kairon", label: "Kairon", color: "#312e81", pattern: "Thick solid line · circles", dash: undefined, width: 5 },
  { key: "manual", label: "Manual", color: "#c2410c", pattern: "Dashed line · hollow squares", dash: "10 7", width: 3 },
  { key: "adjusted", label: "Adjusted", color: "#0f766e", pattern: "Dash-dot line · diamonds", dash: "8 4 2 4", width: 2 },
  { key: "target", label: "Target", color: "#9333ea", pattern: "Dotted line · triangles", dash: "2 5", width: 2 },
] as const;
export type MetricTheme = Record<(typeof metricStyles)[number]["key"], string>;
export const defaultMetricTheme: MetricTheme = Object.fromEntries(metricStyles.map(item => [item.key, item.color])) as MetricTheme;
export function canConfigureMetricTheme(user: AuthUser | null) {
  return user?.isActive === true && user.role.roleType === "manager" && user.project?.trim().toUpperCase() === "CODING";
}
export function validMetricTheme(value: unknown): value is MetricTheme {
  return typeof value === "object" && value !== null && metricStyles.every(({key}) => /^#[0-9a-f]{6}$/i.test(String((value as Record<string, unknown>)[key] ?? "")));
}
export const metricThemeKey = (userId: number) => `hph:metric-theme:v1:${userId}`;
export function loadMetricTheme(userId: number): MetricTheme {
  try { const value: unknown = JSON.parse(localStorage.getItem(metricThemeKey(userId)) ?? "null"); return validMetricTheme(value) ? value : {...defaultMetricTheme}; }
  catch { return {...defaultMetricTheme}; }
}
