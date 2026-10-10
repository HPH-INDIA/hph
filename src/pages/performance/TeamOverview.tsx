import { metricIdentity } from "@/components/ui/metricIdentity";
import type { EfficiencySummary } from "@/api/types";
import { chartLabel, dayLabel, numberLabel } from "./performanceView";
import { EfficiencyValue } from "./EfficiencyValue";

/** All rates and source totals stay authoritative in the API response. */
export function TeamOverview({ summary, people, scope, showRates = false, individual = false }: { summary: Omit<EfficiencySummary, "daily">; people: number; scope: string; showRates?: boolean; individual?: boolean }) {
  const metrics = [
    { label: "Kairon charts completed", value: numberLabel(summary.kaironCharts), note: "Completed production", color: "text-brand-700" },
    { label: "Manual charts completed", value: numberLabel(summary.manualCharts), note: "Recorded production", color: "text-content-primary" },
    { label: "Difference", value: numberLabel(summary.kaironCharts - summary.manualCharts), note: "Kairon − Manual", color: "text-content-primary" },
    { label: "Adjusted target", value: chartLabel(summary.adjustedTarget), note: "For the selected period", color: "text-content-primary" },
  ];
  return <section aria-label={individual ? "Individual overview" : "Team overview"} className="min-w-0">
    <p className="mb-2 text-xs text-content-secondary">{scope} · {people} {people === 1 ? "person" : "people"}</p>
    {showRates ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1.1fr]">
      <article aria-label="Chart production" className="rounded-xl border border-border bg-surface px-4 py-3 sm:col-span-2 xl:col-span-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">Chart production</h2>
          {summary.to && <span className="text-[11px] font-normal text-content-muted">Up to <time dateTime={summary.to}>{dayLabel(summary.to, true)}</time></span>}
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-3">
          {metrics.slice(0, 2).map((metric) => <div key={metric.label} data-metric={metricIdentity(metric.label)} className="metric-block"><dt className={`text-xs ${metric.color}`}>{metric.label}</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums">{metric.value}</dd></div>)}
        </dl>
        <dl className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border pt-2 text-xs">
          <div className="flex gap-2"><dt className="text-content-muted">Difference</dt><dd className="font-semibold tabular-nums" title="Kairon minus Manual">{metrics[2].value}</dd></div>
          <div data-metric="adjusted" className="metric-block flex gap-2"><dt className="text-content-muted">Adjusted target</dt><dd className="font-semibold tabular-nums">{metrics[3].value}</dd></div>
        </dl>
      </article>
      <article aria-label={individual ? "Efficiency" : "Total team efficiency"} className="rounded-xl border border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold">{individual ? "Efficiency" : "Total team efficiency"}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3">
          <div data-metric="kairon" className="metric-block"><dt className="text-xs text-brand-700">Kairon</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums"><EfficiencyValue value={summary.kaironEfficiencyPercent} large /></dd></div>
          <div data-metric="manual" className="metric-block"><dt className="text-xs text-content-secondary">Manual</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums"><EfficiencyValue value={summary.manualEfficiencyPercent} large /></dd></div>
        </dl>
        <p className="mt-2 border-t border-border pt-2 text-xs text-content-muted">Weighted for this period · capped at 120%</p>
      </article>
      <article aria-label={individual ? "CPD" : "Team CPD"} className="rounded-xl border border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold">{individual ? "CPD" : "Team CPD"}</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          <div data-metric="kairon" className="metric-block"><dt className="text-xs text-brand-700">Kairon CPD</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums">{numberLabel(summary.kaironCpd, 2)}</dd></div>
          <div data-metric="manual" className="metric-block"><dt className="text-xs text-content-secondary">Manual CPD</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums">{numberLabel(summary.manualCpd, 2)}</dd></div>
          <div data-metric="target" className="metric-block"><dt className="text-xs text-content-secondary">Target CPD</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums">{numberLabel(summary.targetCpd, 2)}</dd></div>
        </dl>
        <p className="mt-2 border-t border-border pt-2 text-xs text-content-muted">Charts per day · normalized to 8 hours</p>
      </article>
    </div> : <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface sm:grid-cols-4">
      {metrics.map((metric, index) => <div key={metric.label} data-metric={metricIdentity(metric.label)} className={`metric-block min-w-0 px-4 py-3 sm:px-5 ${index ? "border-border sm:border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""} ${index % 2 ? "border-l" : ""}`}>
        <dt className={`text-xs font-medium ${metric.color}`}>{metric.label}</dt><dd className="mt-1 break-words text-2xl font-semibold tracking-tight tabular-nums">{metric.value}</dd><dd className="mt-1 text-xs text-content-muted">{metric.note}</dd>
      </div>)}
    </dl>}
  </section>;
}
