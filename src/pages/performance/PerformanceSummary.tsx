import type { ReactNode } from "react";
import type { EfficiencySummary } from "@/api/types";
import { EfficiencyValue } from "./EfficiencyValue";
import { numberLabel } from "./performanceView";

export function PerformanceSummary({ summary, label = "Personal performance summary" }: { summary: EfficiencySummary; label?: string }) {
  return (
          <section aria-label={label} className="grid gap-3 md:grid-cols-2">
            <ComparisonCard title="Efficiency" note="100% meets target · capped at 120%">
              <Metric label="Manual" value={<EfficiencyValue value={summary.manualEfficiencyPercent} large />} />
              <Metric label="Kairon" value={<EfficiencyValue value={summary.kaironEfficiencyPercent} large />} />
            </ComparisonCard>
            <ComparisonCard title="Charts per day" note="Normalized to an 8-hour day" trailing={<span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-content-secondary">Target {numberLabel(summary.targetCpd, 1)}</span>}>
              <Metric label="Manual" value={numberLabel(summary.manualCpd, 1)} />
              <Metric label="Kairon" value={numberLabel(summary.kaironCpd, 1)} />
            </ComparisonCard>
          </section>
  );
}

function ComparisonCard({ title, note, trailing, children }: { title: string; note: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{trailing}</div>
      <div className="mt-3 grid grid-cols-2 divide-x divide-border">{children}</div>
      <p className="mt-2 text-xs text-content-secondary">{note}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="last:pl-5"><p className="text-xs text-content-secondary">{label}</p><div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div></div>;
}

