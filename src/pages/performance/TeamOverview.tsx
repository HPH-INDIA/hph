import type { ReactNode } from "react";
import type { EfficiencySummary } from "@/api/types";
import { EfficiencyValue } from "./EfficiencyValue";
import { chartLabel, numberLabel } from "./performanceView";

/** Source totals come from the API, including weighted rates for this selection. */
export function TeamOverview({ summary, people, scope }: {
  summary: Omit<EfficiencySummary, "daily">;
  people: number;
  scope: string;
}) {
  return <section aria-label="Team overview" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-5 shadow-sm md:col-span-2 xl:col-span-1">
      <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle kind="charts">Chart production</CardTitle><span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-content-secondary">{people} {people === 1 ? "person" : "people"}</span></div>
      <p className="mt-2 text-xs text-content-secondary">{scope}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface-muted p-4"><dt className="text-xs text-content-secondary">Completed Kairon</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{numberLabel(summary.kaironCharts)}</dd></div>
        <div className="rounded-lg border border-border bg-surface-muted p-4"><dt className="text-xs text-content-secondary">Manual charts</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{numberLabel(summary.manualCharts)}</dd></div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-4 py-3"><dt className="text-xs text-content-secondary">Kairon − Manual</dt><dd className="text-xl font-semibold tabular-nums">{numberLabel(summary.kaironCharts - summary.manualCharts)}</dd></div>
      </dl>
    </article>
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
      <CardTitle kind="efficiency">Total team efficiency</CardTitle>
      <dl className="my-5 space-y-4">
        <ValueRow label="Manual"><EfficiencyValue value={summary.manualEfficiencyPercent} large /></ValueRow>
        <ValueRow label="Kairon"><EfficiencyValue value={summary.kaironEfficiencyPercent} large /></ValueRow>
      </dl>
      <p className="mb-4 text-xs leading-relaxed text-content-secondary">Weighted for the selected period · capped at 120%</p>
      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-content-secondary">Adjusted target</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{chartLabel(summary.adjustedTarget)}</dd></div><div><dt className="text-content-secondary">Calculated days</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{numberLabel(summary.calculatedDays)}</dd></div></dl>
    </article>
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-5 shadow-sm">
      <CardTitle kind="charts">Team CPD</CardTitle>
      <dl className="my-5 space-y-4">
        <ValueRow label="Manual CPD">{numberLabel(summary.manualCpd, 1)}</ValueRow>
        <ValueRow label="Kairon CPD">{numberLabel(summary.kaironCpd, 1)}</ValueRow>
        <ValueRow label="Target CPD">{numberLabel(summary.targetCpd, 1)}</ValueRow>
      </dl>
      <p className="mt-auto text-xs leading-relaxed text-content-secondary">Charts normalized to the Daily Refresh 8-hour basis.</p>
    </article>
  </section>;
}

function CardTitle({ kind, children }: { kind: "charts" | "efficiency"; children: ReactNode }) {
  return <div className="flex items-center gap-2.5"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kind === "efficiency" ? "bg-success-bg text-success" : "bg-brand-50 text-brand-600"}`}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M5 20V10m7 10V4m7 16v-7" strokeLinecap="round" /></svg></span><h2 className="text-sm font-semibold">{children}</h2></div>;
}
function ValueRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-xs text-content-secondary">{label}</dt><dd className="text-2xl font-semibold tracking-tight tabular-nums">{children}</dd></div>;
}
