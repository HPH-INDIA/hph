/** One semantic identity for metric labels, table columns, and chart series. */
export type MetricIdentity = "kairon" | "manual" | "adjusted" | "target";
export function metricIdentity(value: string): MetricIdentity | undefined {
  const key = value.toLowerCase();
  if (key.includes("kairon") && !key.includes("manual")) return "kairon";
  if (key.includes("manual") && !key.includes("kairon")) return "manual";
  if (key.startsWith("adjusted")) return "adjusted";
  if (key.startsWith("target") || key === "dailytarget") return "target";
  return undefined;
}
