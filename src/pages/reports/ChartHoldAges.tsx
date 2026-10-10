import type { KaironHoldAgeBucket, KaironHoldSummary } from "@/api/types";
import { holdAgeGroups } from "./chartHoldAge";
import { holdFocus } from "./chartHoldsView";

export function ChartHoldAges({ counts, selected, onSelect }: {
  counts: KaironHoldSummary["ageBuckets"]; selected?: KaironHoldAgeBucket;
  onSelect: (age?: KaironHoldAgeBucket) => void;
}) {
  return <section aria-label="Holds by age" className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold text-content-primary">Holds by age</h2><p className="mt-1 text-xs text-content-muted">Based on the latest reported Kairon age. Select a group to filter charts.</p></div>
      <button type="button" onClick={() => onSelect(undefined)} aria-pressed={!selected} className={`rounded-md px-3 py-1.5 text-xs font-medium ${!selected ? "bg-brand-50 text-brand-700" : "text-content-secondary hover:bg-surface-muted"} ${holdFocus}`}>All ages · {Object.values(counts).reduce((total, count) => total + count, 0).toLocaleString()}</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{holdAgeGroups.filter((group) => group.key !== "unknown").map((group) => <button key={group.key} type="button" aria-pressed={selected === group.key} onClick={() => onSelect(selected === group.key ? undefined : group.key)} className={`rounded-xl border border-l-4 p-4 text-left transition-shadow hover:shadow-card ${group.accent} ${selected === group.key ? `${group.tone} ring-2 ring-current` : "bg-surface"} ${holdFocus}`}>
      <span className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${group.tone}`}>{group.label}</span><span className="text-2xl font-semibold tabular-nums text-content-primary">{(counts[group.key] ?? 0).toLocaleString()}</span></span>
      <span className="mt-2 block text-xs text-content-muted">{group.range}</span>
    </button>)}</div>
    {(counts.unknown > 0 || selected === "unknown") && <button type="button" aria-pressed={selected === "unknown"} onClick={() => onSelect(selected === "unknown" ? undefined : "unknown")} className={`self-start rounded text-xs underline underline-offset-4 ${selected === "unknown" ? "text-brand-700" : "text-content-muted"} ${holdFocus}`}>Age unavailable · {counts.unknown ?? 0} charts</button>}
  </section>;
}
