import { useAuth } from "@/features/auth/useAuth";
import { ActionScreen } from "@/components/ui/ActionScreen";
import { KaironUploadFormPage } from "@/pages/kairon/KaironUploadFormPage";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ManualReportFilters, type PeriodMode } from "./ManualReportFilters";
import { isReportWindow, reportToday, type ManualReportWindow } from "./manualReportSummary";

import { ReportsKaironTab } from "./ReportsKaironTab";
import { ReportsManualTab } from "./ReportsManualTab";
import { ReportsOverviewTab } from "./ReportsOverviewTab";

type Tab = "overview" | "kairon" | "manual";

// URL state restores the same source, period and view after a focused action.
export function ReportsPage() {
  const { hasRoleType, hasFeature } = useAuth();
  const canUploadKairon = hasRoleType("manager") && !hasRoleType("lead") && !hasRoleType("employee") && hasFeature("reports", "write");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const selectedTab = params.get("tab");
  const tab: Tab = selectedTab === "kairon" || selectedTab === "manual" ? selectedTab : "overview";
  const view = params.get("view") === "records" ? "records" : "trends";
  const today = reportToday();
  const requestedWindow = { fromDate: params.get("from") ?? "", toDate: params.get("to") ?? "" };
  const window: ManualReportWindow = isReportWindow(requestedWindow)
    ? requestedWindow : { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
  const selectedMode = params.get("period");
  const mode: PeriodMode = selectedMode === "day" || selectedMode === "month" ? selectedMode : "range";
  const updateParams = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    // Include defaults before navigating so the reporting context is explicit.
    next.set("from", window.fromDate);
    next.set("to", window.toDate);
    next.set("period", mode);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    setParams(next, { preventScrollReset: true });
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftWindow, setDraftWindow] = useState(window);
  const [draftMode, setDraftMode] = useState(mode);
  const openFilters = () => {
    setDraftWindow(window);
    setDraftMode(mode);
    setFiltersOpen(true);
  };

  return (
    <div className="reports-fit flex flex-col gap-4">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-700">Reporting</p>
        <h1 className="text-2xl font-semibold tracking-tight text-content-primary">Reports</h1>
        <p className="mt-1 text-sm text-content-muted">One reporting period. Consistent views across Kairon and Manual.</p>
      </div>

      <ActionScreen open={uploadOpen && canUploadKairon && tab === "kairon"} onClose={() => setUploadOpen(false)} title="Upload Kairon file"
        description="Upload a completed CSV batch for one reporting date." widthClass="max-w-2xl">
        <KaironUploadFormPage embedded onCancel={() => setUploadOpen(false)} onStarted={() => setUploadOpen(false)} />
      </ActionScreen>
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Report filters"
        description="Choose the reporting period for all three tabs." widthClass="max-w-md">
        <div className="flex flex-col gap-6">
          <ManualReportFilters mode={draftMode} value={draftWindow} onModeChange={setDraftMode} onChange={setDraftWindow} />
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5">
            <Button type="button" disabled={!isReportWindow(draftWindow)} onClick={() => {
              if (!isReportWindow(draftWindow)) return;
              updateParams({ from: draftWindow.fromDate, to: draftWindow.toDate, period: draftMode });
              setFiltersOpen(false);
            }}>Apply filters</Button>
            <Button type="button" variant="ghost" onClick={() => setFiltersOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Drawer>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div role="group" aria-label="Report source" className="flex gap-1">
          {([["overview", "Overview"], ["kairon", "Kairon"], ["manual", "Manual"]] as const).map(([value, label]) => (
            <button data-metric={value === "overview" ? undefined : value} key={value} type="button" aria-pressed={tab === value} onClick={() => updateParams({ tab: value })}
              className={`metric-tab min-h-11 border-b-2 px-4 py-3 text-sm font-medium ${tab === value ? "border-brand-600 text-brand-700" : "border-transparent text-content-muted hover:text-content-secondary"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-xs text-content-secondary">{window.fromDate === window.toDate ? window.fromDate : `${window.fromDate} – ${window.toDate}`}</span>
          <Button type="button" variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={openFilters}>Filters</Button>
          {tab === "kairon" && canUploadKairon && <Button type="button" variant="secondary" onClick={() => setUploadOpen(true)}>Upload Kairon file</Button>}
        </div>
      </div>

      <div key={`${window.fromDate}:${window.toDate}`} className={`report-body min-w-0 ${tab !== "overview" ? "report-source-body" : ""}`}>
        {tab === "overview" && <ReportsOverviewTab window={window} view={view} onViewChange={(view) => updateParams({ view })} />}
        {tab === "kairon" && <ReportsKaironTab window={window} />}
        {tab === "manual" && <ReportsManualTab window={window} />}
      </div>
      <p className="text-xs text-content-muted">Comparisons always show Kairon, then Manual. Source records and approval states remain available in each source tab.</p>
    </div>
  );
}
