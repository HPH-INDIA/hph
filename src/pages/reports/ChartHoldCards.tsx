import { Link } from "react-router-dom";

import type { KaironHoldSummary, KaironHoldView } from "@/api/types";
import { holdFocus, holdViews, type HoldRole } from "./chartHoldsView";

export function HoldArrow({ back = false }: { back?: boolean }) {
  return <svg aria-hidden="true" className={`h-4 w-4 shrink-0 ${back ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

export function ChartHoldCards({ role, summary, href, selectedView, onSelect }: {
  role: HoldRole; summary?: KaironHoldSummary; href: (view: KaironHoldView) => string;
  selectedView?: KaironHoldView; onSelect?: (view: KaironHoldView) => void;
}) {
  return <div className={`grid gap-3 ${role === "manager" ? "sm:grid-cols-3" : role === "lead" ? "sm:grid-cols-2" : "sm:max-w-md"}`}>
    {holdViews(role, summary).map((option) => {
      const selected = selectedView === option.value;
      const classes = `group relative flex min-w-0 items-center gap-4 overflow-hidden rounded-xl border px-5 py-4 text-left transition-colors ${holdFocus} ${selected ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-border bg-surface hover:border-brand-300 hover:bg-brand-50/40"}`;
      const content = <>
        <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${option.value === "all" ? "bg-brand-100 text-brand-700" : "bg-surface-muted text-content-secondary"}`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {option.value === "all" ? <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>
              : option.value === "coders" ? <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></>
                : <><path d="M8 3H5v18h14V3h-3M9 3h6v4H9z" /><path d="M10 12v5m4-5v5" /></>}
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-content-secondary">{option.label}</span>
          <span className="mt-1 block text-3xl font-semibold leading-none tracking-tight tabular-nums text-content-primary">{option.count?.toLocaleString() ?? "—"}</span>
          <span className="mt-2 block text-xs leading-relaxed text-content-muted">{option.description}</span>
        </span>
        <span aria-hidden="true" className={`shrink-0 ${selected ? "text-brand-700" : "text-content-muted group-hover:text-brand-700"}`}><HoldArrow /></span>
      </>;
      return onSelect ? <button key={option.value} type="button" aria-pressed={selected} className={classes} onClick={() => onSelect(option.value)}>{content}</button>
        : <Link key={option.value} to={href(option.value)} className={classes} aria-label={`${option.label}: ${option.count?.toLocaleString() ?? "loading"}. Open hold details`}>{content}</Link>;
    })}
  </div>;
}
