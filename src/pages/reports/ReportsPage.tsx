import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ManualReportFilters, type PeriodMode } from "./ManualReportFilters";
import { isReportWindow, reportToday, type ManualReportWindow } from "./manualReportSummary";

import { ReportsKaironTab } from "./ReportsKaironTab";
import { ReportsManualTab } from "./ReportsManualTab";
import { ReportsOverviewTab } from "./ReportsOverviewTab";

type Tab = "overview" | "kairon" | "manual";

// One applied period survives tab changes. Changing it resets period-specific
// pagination and drilldowns, so stale details cannot appear under a new period.
export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const [window, setWindow] = useState<ManualReportWindow>(() => {
    const today = reportToday();
    return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
  });
  const [mode, setMode] = useState<PeriodMode>("range");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftWindow, setDraftWindow] = useState(window);
  const [draftMode, setDraftMode] = useState(mode);
  const openFilters = () => {
    setDraftWindow(window);
    setDraftMode(mode);
    setFiltersOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-content-primary">Reports and input</h1>
        <p className="text-sm text-content-muted">Review Kairon and Manual data, and submit the inputs available to your role.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-medium text-content-primary">{window.fromDate === window.toDate ? window.fromDate : `${window.fromDate} – ${window.toDate}`}</p>
          <p className="text-xs text-content-muted">Shared across Overview, Kairon, and Manual</p>
        </div>
        <Button type="button" variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={openFilters}>Filters</Button>
      </div>
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Report filters"
        description="Choose the reporting period for all three tabs." widthClass="max-w-md">
        <div className="flex flex-col gap-6">
          <ManualReportFilters mode={draftMode} value={draftWindow} onModeChange={setDraftMode} onChange={setDraftWindow} />
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5">
            <Button type="button" disabled={!isReportWindow(draftWindow)} onClick={() => {
              if (!isReportWindow(draftWindow)) return;
              setWindow(draftWindow);
              setMode(draftMode);
              setFiltersOpen(false);
            }}>Apply filters</Button>
            <Button type="button" variant="ghost" onClick={() => setFiltersOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Drawer>
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("overview")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "overview" ? "border-b-2 border-brand-600 text-brand-700" : "text-content-muted hover:text-content-secondary"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("kairon")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "kairon" ? "border-b-2 border-brand-600 text-brand-700" : "text-content-muted hover:text-content-secondary"
          }`}
        >
          Kairon
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "manual" ? "border-b-2 border-brand-600 text-brand-700" : "text-content-muted hover:text-content-secondary"
          }`}
        >
          Manual
        </button>
      </div>

      <div key={`${window.fromDate}:${window.toDate}`} className="min-w-0">
        {tab === "overview" && <ReportsOverviewTab window={window} />}
        {tab === "kairon" && <ReportsKaironTab window={window} />}
        {tab === "manual" && <ReportsManualTab window={window} />}
      </div>
    </div>
  );
}
