import { useId, useState, type ReactNode } from "react";
import type { CoderPerformanceMember } from "@/api/coderPerformance";
import type { DailyEfficiency } from "@/api/types";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { CoderPerformanceTable } from "./CoderPerformanceTable";
import { DailyPerformance } from "./DailyPerformance";

export function CoderPerformancePanel({ members, loading, error, onRetry, rows, from, to, periodLabel, onPick, renderDayDetails, exportName }: {
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
  const [view, setView] = useState<"coder" | "day">("day");
  return <section aria-labelledby={`${id}-title`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
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
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}`}>
      {view === "coder" ? <div className="border-t border-border">
        <p className="px-5 py-3 text-xs text-content-secondary">Totals for the selected period. Select a coder’s name to focus their results.</p>
        {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <LoadingState label="Loading coder results…" /> : <CoderPerformanceTable members={members} caption={`Coder totals · ${periodLabel}`} onPick={onPick} />}
      </div> : <DailyPerformance key={`${from}-${to}`} rows={rows} month={from.slice(0, 7)} periodLabel={periodLabel} title="Combined coder daily performance"
        description="Select a day to see each coder’s charts, CPD, and efficiency. Coders with no records are included."
        exportName={exportName} showYear renderDayDetails={renderDayDetails} embedded />}
    </div>
  </section>;
}
