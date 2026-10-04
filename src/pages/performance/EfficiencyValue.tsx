import { numberLabel } from "./performanceView";

export function EfficiencyValue({ value, large = false }: { value: string | null; large?: boolean }) {
  if (value === null) return <span className={large ? "text-content-secondary" : "text-xs text-content-secondary"} aria-label="Efficiency unavailable">—</span>;
  const numeric = Number(value);
  const color = numeric >= 100 ? "bg-success-bg text-content-primary" : numeric >= 80 ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger";
  if (large) return <span>{numberLabel(numeric, 1)}<span className="ml-0.5 text-base font-medium text-content-secondary">%</span></span>;
  return <span className={`inline-flex min-w-[70px] justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${color}`}>{numberLabel(numeric, 1)}%</span>;
}
