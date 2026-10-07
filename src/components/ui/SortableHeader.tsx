import type { SortColumn, TableSort } from "./tableSort";
import { nextTableSort } from "./tableSort";

export function SortableHeader<T>({ column, sort, onSort, align = "left", className = "" }: {
  column: SortColumn<T>; sort: TableSort; onSort: (sort: TableSort) => void;
  align?: "left" | "right"; className?: string;
}) {
  const active = sort.key === column.key;
  const next = nextTableSort(sort, column);
  return <th scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
    <button type="button" onClick={() => onSort(next)} aria-label={`Sort by ${column.label}: ${next.direction === "asc" ? "ascending" : "descending"}`}
      title={`Sort ${next.direction === "asc" ? "ascending" : "descending"}`} className={`flex min-h-8 w-full items-center gap-1.5 rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${align === "right" ? "justify-end text-right" : "text-left"} ${active ? "text-brand-700" : "hover:text-brand-700"}`}>
      <span>{column.label}</span><span aria-hidden="true" className="inline-flex shrink-0 text-sm leading-none"><span className={active && sort.direction === "asc" ? "font-bold text-brand-700" : "opacity-40"}>↑</span><span className={active && sort.direction === "desc" ? "font-bold text-brand-700" : "opacity-40"}>↓</span></span>
    </button>
  </th>;
}

/** Equivalent controls for stacked mobile rows without a table header. */
export function TableSortControls<T>({ columns, sort, onSort }: { columns: readonly SortColumn<T>[]; sort: TableSort; onSort: (sort: TableSort) => void }) {
  return <div className="flex flex-wrap items-end gap-2">
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-content-secondary">Sort by
      <select value={sort.key} onChange={(event) => { const column = columns.find((item) => item.key === event.target.value); if (column) onSort({ key: column.key, direction: column.defaultDirection ?? "asc" }); }} className="min-h-10 max-w-full rounded-md border border-border bg-surface px-3 text-sm font-normal focus-visible:ring-2 focus-visible:ring-brand-500">
        {columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
      </select>
    </label>
    {(["asc", "desc"] as const).map((direction) => <button type="button" key={direction} aria-label={`Sort ${direction === "asc" ? "ascending" : "descending"}`} aria-pressed={sort.direction === direction} onClick={() => onSort({ ...sort, direction })}
      className={`min-h-10 min-w-10 rounded-md border border-border px-3 text-lg focus-visible:ring-2 focus-visible:ring-brand-500 ${sort.direction === direction ? "bg-brand-50 text-brand-700" : "bg-surface text-content-secondary"}`}>{direction === "asc" ? "↑" : "↓"}</button>)}
  </div>;
}
