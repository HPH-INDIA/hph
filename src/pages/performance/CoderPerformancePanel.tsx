import { useId, useState, type ReactNode } from "react";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import type { DailyEfficiency } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { CoderPerformanceTable } from "./CoderPerformanceTable";
import { DailyPerformance } from "./DailyPerformance";

export function CoderPerformancePanel({ members, loading, error, onRetry, rows, from, to, periodLabel, onPick, renderDayDetails, exportName, compact = false, activeView }: {
  compact?: boolean; activeView?: "coder" | "day";
  members: CoderPerformanceMember[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  rows: DailyEfficiency[];
  from: string;
  to: string;
  periodLabel: string;
  onPick: (userId: number) => void;
  renderDayDetails: (date: string) => ReactNode;
  exportName: string;
}) {
  const id = useId();
  const [localView, setView] = useState<"coder" | "day">("coder");
  const view = activeView ?? localView;
  return <section aria-labelledby={`${id}-title`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    {compact ? <h2 id={`${id}-title`} className="sr-only">Coder performance</h2> : <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      <div><h2 id={`${id}-title`} className="text-base font-semibold">Coder performance</h2><p className="mt-1 text-xs text-content-secondary">{periodLabel} · Compare coders or explore a day’s results.</p></div>
      <div role="tablist" aria-label="Coder performance views" className="inline-flex rounded-lg bg-surface-muted p-1">
        {(["coder", "day"] as const).map((tab) => <button key={tab} type="button" role="tab" id={`${id}-${tab}`} aria-controls={`${id}-panel`} aria-selected={view === tab} tabIndex={view === tab ? 0 : -1}
          onClick={() => setView(tab)} onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? "coder" : event.key === "End" ? "day" : view === "coder" ? "day" : "coder";
              setView(next);
              document.getElementById(`${id}-${next}`)?.focus();
            }
          }} className={`rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${view === tab ? "bg-surface text-brand-700 shadow-sm" : "text-content-secondary hover:text-content-primary"}`}>
          {tab === "coder" ? "By coder" : "By day"}
        </button>)}
      </div>
    </div>}
    <div id={`${id}-panel`} role={compact ? "region" : "tabpanel"} aria-labelledby={compact ? `${id}-title` : `${id}-${view}`}>
      {view === "coder" ? <div className="border-t border-border">
        {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <LoadingState label="Loading coder results…" /> : <CoderPerformanceTable paginate={false} enableEfficiencyFilters members={members} caption={`Coder totals · ${periodLabel}`} onPick={onPick} exportName={`${exportName}-by-coder`} />}
      </div> : <DailyPerformance paginate={false} key={`${from}-${to}`} rows={rows} month={from.slice(0, 7)} periodLabel={periodLabel} title="Combined coder daily performance"
        description="Select a day to see each coder’s charts, CPD, and efficiency. Coders with no records are included."
        exportName={exportName} showYear renderDayDetails={renderDayDetails} embedded />}
    </div>
  </section>;
}
