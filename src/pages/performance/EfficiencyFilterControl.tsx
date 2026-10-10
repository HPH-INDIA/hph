import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { defaultEfficiencyFilter, efficiencyBands, type EfficiencyFilter } from "./efficiencyFilter";

export function EfficiencyFilterControl({ value, onChange }: {value: EfficiencyFilter; onChange: (value: EfficiencyFilter) => void}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState(value);
  return <>
    <Button type="button" variant="secondary" onClick={() => {setDraftFilter(value);setFiltersOpen(true);}}>Efficiency filters{value.band !== "all" ? " (1)" : ""}</Button>
    <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Efficiency filters" description="Filter the table, totals, and CSV export. Summary cards continue to show totals for the reporting scope." widthClass="max-w-md">
      <form className="flex min-h-full flex-col gap-5" onSubmit={(event) => { event.preventDefault(); onChange(draftFilter); setFiltersOpen(false); }}>
        <label className="flex flex-col gap-2 text-sm font-medium">Efficiency source
          <select className="h-10 rounded-md border border-border bg-surface px-3" value={draftFilter.source} onChange={(event) => setDraftFilter({ ...draftFilter, source: event.target.value as EfficiencyFilter["source"] })}>
            <option value="kairon">Kairon</option><option value="manual">Manual</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">Efficiency range
          <select className="h-10 rounded-md border border-border bg-surface px-3" value={draftFilter.band} onChange={(event) => setDraftFilter({ ...draftFilter, band: event.target.value as EfficiencyFilter["band"] })}>
            {efficiencyBands.map((band) => <option key={band.value} value={band.value}>{band.label}</option>)}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-content-muted">Ranges use the selected source’s efficiency. Missing efficiency is kept separate from 0%.</p>
        <div className="mt-auto flex flex-wrap justify-between gap-3 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={() => setDraftFilter(defaultEfficiencyFilter)}>Reset</Button>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button><Button type="submit">Apply filters</Button></div>
        </div>
      </form>
    </Drawer>
  </>;
}
