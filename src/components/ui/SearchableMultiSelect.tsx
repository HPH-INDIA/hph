import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
  detail?: string;
}

export function SearchableMultiSelect({ label, options, value, onChange, single = false, noun = "teams" }: {
  label: string;
  single?: boolean;
  noun?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left:0,top:0});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.filter((option) => value.includes(option.value));
  const matches = options.filter((option) => `${option.label} ${option.detail ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const summary = selected.length === 0 ? `Select ${noun}` : selected.length === options.length && options.length > 1
    ? `All ${noun}` : selected.length === 1 ? selected[0].label : `${selected.length} ${noun} selected`;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  return <div ref={containerRef} className="relative flex min-w-0 flex-wrap items-center gap-2"
    onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}
    onBlur={(event) => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !popupRef.current?.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`} className="text-xs font-medium text-content-secondary">{label}</span>
    <button ref={triggerRef} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-popup` : undefined}
      onClick={() => { const rect = triggerRef.current?.getBoundingClientRect(); if (rect) setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-332)),top:Math.max(12,Math.min(rect.bottom+8,window.innerHeight-380))}); setSearch(""); setOpen(!open); }}
      className="inline-flex min-h-10 min-w-48 max-w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-content-primary sm:max-w-72">
      <span id={`${id}-value`} className="truncate">{summary}</span>
      <svg className="h-4 w-4 shrink-0 text-content-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    {open && createPortal(<div ref={popupRef} style={position} onKeyDown={event => {if(event.key === "Escape") {event.preventDefault();close();}}} id={`${id}-popup`} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className="fixed z-[100] w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-popover">
      <div className="border-b border-border p-3">
        <label htmlFor={`${id}-search`} className="sr-only">Search {noun}</label>
        <input ref={searchRef} id={`${id}-search`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${noun}…`}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        {!single && <div className="mt-2 flex items-center justify-between text-xs">
          <button type="button" className="min-h-9 rounded px-1 font-medium text-brand-700 hover:underline" onClick={() => onChange(options.map((option) => option.value))}>Select all {noun}</button>
          <button type="button" className="min-h-9 rounded px-1 font-medium text-content-secondary hover:underline" onClick={() => onChange([])} disabled={selected.length === 0}>Clear</button>
        </div>}
      </div>
      <div className="max-h-64 overflow-y-auto p-1" role="group" aria-label={`${noun} options`}>
        {matches.length ? matches.map((option) => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-brand-50">
          <input type={single ? "radio" : "checkbox"} name={single ? id : undefined} checked={value.includes(option.value)} onChange={(event) => { onChange(single ? [option.value] : event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value)); if (single) close(); }} className="h-4 w-4 shrink-0 accent-brand-600" />
          <span className="min-w-0"><span className="block text-content-primary">{option.label}</span>{option.detail && <span className="block text-xs text-content-muted">{option.detail}</span>}</span>
        </label>) : <p className="px-3 py-5 text-sm text-content-muted">No {noun} match your search.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-xs text-content-secondary" role="status">{single ? selected[0]?.label : `${selected.length} of ${options.length} ${noun} selected`}</span>
        <button type="button" onClick={close} className="min-h-9 rounded-md bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100">Done</button>
      </div>
    </div>, document.body)}
  </div>;
}
