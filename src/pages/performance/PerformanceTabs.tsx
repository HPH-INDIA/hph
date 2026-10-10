export function PerformanceTabs<T extends string>({ value, onChange, items, label, compact = false }: {
  value: T; onChange: (value: T) => void; items: readonly { value: T; label: string }[]; label: string; compact?: boolean;
}) {
  return <div role="group" aria-label={label} className={compact ? "inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-surface-muted p-1" : "flex gap-5 overflow-x-auto border-b border-border"}>
    {items.map((item) => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)}
      className={`min-h-10 shrink-0 text-sm font-medium sm:min-h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${compact ? "rounded-md px-3 py-1.5" : "border-b-2 px-1 py-2"} ${value === item.value ? compact ? "bg-surface text-brand-700 shadow-sm" : "border-brand-600 text-brand-700" : compact ? "text-content-secondary" : "border-transparent text-content-secondary"}`}>
      {item.label}
    </button>)}
  </div>;
}
