import type { EfficiencySummary } from "@/api/types";
import { EfficiencyValue } from "./EfficiencyValue";
import { numberLabel } from "./performanceView";

export function PerformanceSummary({ summary, label = "Personal performance summary" }: { summary: Omit<EfficiencySummary, "daily">; label?: string }) {
  return <section aria-label={label} className="grid min-w-0 gap-3 md:grid-cols-2">
    <article className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Efficiency</h2><span className="text-xs text-content-muted">Target 100% · cap 120%</span></div>
      <dl className="mt-3 grid grid-cols-2 divide-x divide-border"><div data-metric="kairon" className="metric-block"><dt className="text-xs text-brand-700">Kairon</dt><dd className="mt-1"><EfficiencyValue value={summary.kaironEfficiencyPercent} large /></dd></div><div data-metric="manual" className="metric-block pl-4"><dt className="text-xs text-content-secondary">Manual</dt><dd className="mt-1"><EfficiencyValue value={summary.manualEfficiencyPercent} large /></dd></div></dl>
    </article>
    <article className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Charts per day</h2><span data-metric="target" className="metric-label text-xs">Target {numberLabel(summary.targetCpd, 2)}</span></div>
      <dl className="mt-3 grid grid-cols-2 divide-x divide-border"><div data-metric="kairon" className="metric-block"><dt className="text-xs text-brand-700">Kairon</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{numberLabel(summary.kaironCpd, 2)}</dd></div><div data-metric="manual" className="metric-block pl-4"><dt className="text-xs text-content-secondary">Manual</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{numberLabel(summary.manualCpd, 2)}</dd></div></dl>
    </article>
  </section>;
}
