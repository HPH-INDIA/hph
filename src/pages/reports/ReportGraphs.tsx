import { useAuth } from "@/features/auth/useAuth";
import { buildChartReport, downloadChartPng, printChartReport } from "./chartExport";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { displayNumber, displayCpd } from "@/utils/displayNumber";
import { ActionScreen } from "@/components/ui/ActionScreen";
import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import type { DailyEfficiency } from "@/api/types";
import { EmptyState } from "@/components/ui/StateViews";
import { axisDateLabel, buildReportChartRows, type CpdTargetRecord, type GraphInterval, type ReportChartRow } from "./reportChartData";
import { useLinkedChartScroll } from "./useLinkedChartScroll";

type ChartMetric = "production" | "cpd" | "hours";

type ValueKey = "target" | "adjusted" | "manual" | "kairon" | "targetCpd" | "adjustedCpd" | "manualCpd" | "kaironCpd" | "idle" | "downtime" | "meeting";
interface Series { key: ValueKey; label: string; color: string; dash?: string; marker?: "circle" | "square" | "diamond" | "triangle"; width?: number }
const PRODUCTION: Series[] = [
  { key: "kairon", label: "Kairon charts", color: "var(--color-chart-kairon)", marker: "circle", width: 5 },
  { key: "manual", label: "Manual charts", color: "var(--color-chart-manual)", dash: "10 7", marker: "square", width: 3 },
  { key: "target", label: "Target goal", color: "var(--color-chart-goal)", dash: "2 5", marker: "triangle" },
  { key: "adjusted", label: "Adjusted target", color: "var(--color-chart-target)", dash: "8 4 2 4", marker: "diamond" },
];
const CPD: Series[] = [
  { key: "kaironCpd", label: "Kairon CPD", color: "var(--color-chart-kairon)", marker: "circle", width: 5 },
  { key: "manualCpd", label: "Manual CPD", color: "var(--color-chart-manual)", dash: "10 7", marker: "square", width: 3 },
  { key: "targetCpd", label: "Target CPD", color: "var(--color-chart-goal)", dash: "2 5", marker: "triangle" },
  { key: "adjustedCpd", label: "Adjusted CPD", color: "var(--color-chart-target)", dash: "8 4 2 4", marker: "diamond" },
];
const LOST: Series[] = [
  { key: "idle", label: "Idle", color: "var(--color-warning)" },
  { key: "downtime", label: "Downtime", color: "var(--color-chart-downtime)" },
  { key: "meeting", label: "Meetings", color: "#4f91a8" },
];
const formatValue = (value: number | null, key?: ValueKey) => key?.toLowerCase().includes("cpd") ? displayCpd(value) : displayNumber(value);

export function ReportGraphs({ sources, targetRecords, from, to, teamView = false, stackedComparison = false, overviewView = "trends", onViewChange, records }: {
  sources: DailyEfficiency[][]; targetRecords?: CpdTargetRecord[]; from: string; to: string; teamView?: boolean; stackedComparison?: boolean; overviewView?: "records" | "trends"; onViewChange?: (view: "records" | "trends") => void; records?: ReactNode;
}) {
  const { hasRoleType } = useAuth();
  const canExportCharts = hasRoleType("manager");
  const [exportPage, setExportPage] = useState(0);
  const [exportPages, setExportPages] = useState<string[]>([]);
  const [exportError, setExportError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<string[]>(["kairon", "manual", "target", "adjusted"]);
  const [lostOpen, setLostOpen] = useState(false);
  const [metric, setMetric] = useState<ChartMetric>("production");
  const [interval, setInterval] = useState<GraphInterval>("day");
  const dayCount = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  const intervals: GraphInterval[] = ["day", ...(dayCount > 15 ? ["week" as const] : []), ...(dayCount > 50 ? ["month" as const] : [])];
  const active = intervals.includes(interval) ? interval : "day";
  const rows = useMemo(() => from && to ? buildReportChartRows(sources, from, to, active, true, targetRecords) : [], [sources, targetRecords, from, to, active]);
  const openExport = (element: HTMLElement) => {
    const styles = getComputedStyle(element);
    const resolveColor = (color: string) => color.startsWith("var(") ? styles.getPropertyValue(color.slice(4,-1)).trim() || "#334155" : color;
    const production = { title: `Production · charts completed (${active})`, series: PRODUCTION.filter(series => visibleSeries.includes(series.key)), stacked: false };
    const cpd = { title: `Charts per day · CPD (${active})`, series: CPD.filter(series => visibleSeries.includes(series.key.replace("Cpd", ""))), stacked: false };
    const charts = stackedComparison ? [production, cpd] : metric === "production" ? [production] : metric === "cpd" ? [cpd] : [{title:`Lost hours (${active})`,series:LOST,stacked:true}];
    setExportError("");
    setExportPage(0);
    setExportPages(buildChartReport(rows, charts, resolveColor, `${from} to ${to}`));
  };
  return (
    <section className={`min-w-0 space-y-3 ${stackedComparison ? "comparison-fit" : ""}`} aria-label="Performance trends">
      <p className="text-xs text-content-muted">Weekends and office holidays without Kairon or Manual production are hidden.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!stackedComparison && <div role="group" aria-label="Trend metric" className="flex flex-wrap rounded-lg border border-border bg-surface p-1">
          {([["production", "Production"], ["cpd", "CPD"], ["hours", "Lost hours"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={value === metric} onClick={() => setMetric(value)}
            className={`min-h-10 rounded px-4 py-2 text-sm font-medium ${value === metric ? "bg-brand-50 text-brand-700" : "text-content-secondary hover:bg-surface-muted"}`}>{label}</button>)}
        </div>}
        {overviewView === "trends" && (stackedComparison || metric !== "hours") && <SearchableMultiSelect label="Show series" noun="series" value={visibleSeries} onChange={setVisibleSeries} options={[{value:"kairon",label:"Kairon"},{value:"manual",label:"Manual"},{value:"target",label:"Target"},{value:"adjusted",label:"Adjusted target"}]} />}
        {stackedComparison && <div className="overview-view-controls flex flex-wrap items-center gap-3">
          {onViewChange && <div role="group" aria-label="Report view" className="flex rounded-lg border border-border bg-surface p-1">
            {(["records", "trends"] as const).map((value) => <button key={value} type="button" aria-pressed={overviewView === value} onClick={() => onViewChange(value)} className={`min-h-9 rounded-md px-3 py-1 text-xs font-medium capitalize ${overviewView === value ? "bg-brand-50 text-brand-700" : "text-content-secondary hover:bg-surface-muted"}`}>{value}</button>)}
          </div>}
          <button type="button" className="min-h-9 text-xs text-brand-700 underline" onClick={() => setLostOpen(true)}>View lost hours</button>
        </div>}
        {canExportCharts && overviewView === "trends" && <button type="button" disabled={!rows.length || (!visibleSeries.length && (stackedComparison || metric !== "hours"))} onClick={event => openExport(event.currentTarget)} className="min-h-10 rounded-md border border-border bg-surface px-3 text-xs font-medium disabled:opacity-40">Export charts</button>}
        {overviewView === "trends" && intervals.length > 1 && <div role="group" aria-label="Graph interval" className="flex rounded-lg border border-border bg-surface p-1">
          {intervals.map((value) => <button key={value} type="button" aria-pressed={value === active} onClick={() => setInterval(value)}
            className={`min-h-10 rounded px-3 py-2 text-xs font-medium capitalize ${value === active ? "bg-brand-600 text-white" : "text-content-secondary hover:bg-surface-muted"}`}>{value}</button>)}
        </div>}
      </div>
      <ActionScreen open={canExportCharts && exportPages.length > 0} onClose={() => setExportPages([])} title="Export charts" fitContent widthClass="max-w-none">
        <div className="chart-export-workspace">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button aria-label="Previous report page" type="button" disabled={exportPage === 0} onClick={() => setExportPage(page => page-1)} className="min-h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Previous</button>
              <span role="status" className="text-xs text-content-secondary">Page {exportPage+1} of {exportPages.length}</span>
              <button aria-label="Next report page" type="button" disabled={exportPage >= exportPages.length-1} onClick={() => setExportPage(page => page+1)} className="min-h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Next</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-10 rounded-md border border-border bg-surface px-3 text-xs font-medium" onClick={() => {try {printChartReport(exportPages);} catch(error) {setExportError(error instanceof Error ? error.message : "PDF preview failed.");}}}>Print / Save all as PDF</button>
              <button type="button" disabled={exportBusy} className="min-h-10 rounded-md bg-brand-600 px-3 text-xs font-medium text-white disabled:opacity-40" onClick={async () => {setExportBusy(true);setExportError("");try {await downloadChartPng(exportPages[exportPage], `hph-charts-${from}-to-${to}-${exportPage+1}.png`);} catch(error) {setExportError(error instanceof Error ? error.message : "Image export failed.");} finally {setExportBusy(false);}}}>{exportBusy ? "Preparing image…" : "Download page PNG for PPT"}</button>
            </div>
          </div>
          {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
          <div className="chart-export-preview rounded-lg border border-border bg-surface-muted p-2">
            {exportPages[exportPage] && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportPages[exportPage])}`} alt={`Report page ${exportPage+1}: selected charts for ${from} to ${to}`} />}
          </div>
          <p className="text-[11px] text-content-muted">Fit-to-screen preview · PNG exports at full resolution · PDF includes all pages and selected series.</p>
        </div>
      </ActionScreen>
      {stackedComparison && overviewView === "records" ? records : rows.length ? <LinkedGraphs visibleSeries={visibleSeries} metric={stackedComparison ? "comparison" : metric} rows={rows} interval={active} teamView={teamView} timelineKey={`${from}:${to}:${active}:${rows.map((row) => row.date).join(",")}`} />
        : <EmptyState title="No graph data for this period" />}
      {stackedComparison && <ActionScreen open={lostOpen} onClose={() => setLostOpen(false)} title="Lost hours">{rows.length ? <LinkedGraphs metric="hours" rows={rows} interval={active} teamView={teamView} timelineKey={`${from}:${to}:${active}:hours`} /> : <EmptyState title="No lost hours data for this period" />}</ActionScreen>}

    </section>
  );
}

function LinkedGraphs({ rows, interval, teamView, timelineKey, metric, visibleSeries = ["kairon", "manual", "target", "adjusted"] }: { visibleSeries?: string[]; metric: ChartMetric | "comparison"; rows: ReportChartRow[]; interval: GraphInterval; teamView: boolean; timelineKey: string }) {
  const { nodes, geometry, start, onScroll } = useLinkedChartScroll(timelineKey, rows.length);
  const [plotHeights, setPlotHeights] = useState<number[]>([]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      setPlotHeights(nodes.current.map(node => node?.clientHeight ?? 290));
    });
    nodes.current.forEach(node => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [nodes, metric]);
  const first = Math.min(rows.length - 1, Math.max(0, Math.round(start)));
  const last = Math.min(rows.length - 1, first + geometry.visibleCount - 1);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ chart: string; key: ValueKey; date: string } | null>(null);
  const selected = rows.find((row) => row.date === hoverDate) ?? rows[first];
  const charts = [
    { key: "hours", title: `${interval}-wise lost hours by reason`, series: LOST, stacked: true,
      description: "Idle, downtime, and meeting hours on the production timeline. Non-working dates without production are hidden." },
    { key: "production", title: `Production · charts completed (${interval})`, series: PRODUCTION.filter(series => visibleSeries.includes(series.key)), stacked: false,
      description: "Kairon and Manual chart counts against target goal and adjusted target." },
    { key: "cpd", title: `Charts per day · CPD (${interval})`, series: CPD.filter(series => visibleSeries.includes(series.key.replace("Cpd", ""))), stacked: false,
      description: `${teamView || interval !== "day" ? "Target and adjusted CPD are averages per recorded coder-day. " : ""}Actual CPD uses effective target hours; adjusted CPD uses saved manual deductions.` },
  ];
  return (
    <div className={`min-w-0 space-y-3 ${metric === "comparison" ? "linked-fit" : ""}`}>
      <p className="text-xs font-medium text-content-secondary" data-testid="graph-visible-period">Showing {rows[first].label}{first !== last ? ` – ${rows[last].label}` : ""}</p>
      <div className="chart-stack min-w-0 space-y-4">
        {charts.filter((chart) => metric === "comparison" ? chart.key === "production" || chart.key === "cpd" : chart.key === metric).map((chart, chartIndex) => {
          const { width, step, left, right } = geometry.charts[chartIndex] ?? geometry.charts[0];
          const height = metric === "comparison" && plotHeights[chartIndex] > 0 ? Math.max(100, plotHeights[chartIndex]) : 290;
          const bottom = height - 58;
          const maximum = Math.max(1, ...rows.map((row) => chart.stacked
            ? chart.series.reduce((total, series) => total + (row[series.key] ?? 0), 0)
            : Math.max(0, ...chart.series.map((series) => row[series.key] ?? 0))));
          const top = 25;
          // Use whole-number, evenly spaced ticks without rounding the data itself.
          const roughStep = Math.max(1, maximum / 4);
          const magnitude = 10 ** Math.floor(Math.log10(roughStep));
          const tickStep = [1, 2, 2.5, 5, 10].map((step) => step * magnitude)
            .find((step) => Number.isInteger(step) && step >= roughStep) ?? Math.ceil(roughStep);
          const yMax = tickStep * 4;
          const x = (index: number) => left + (index + 0.5) * step;
          const y = (value: number) => bottom - value / yMax * (bottom - top);
          // Production and CPD share source identity, so linked hover shows both units.
          const hoveredSeries = hoverPoint ? chart.series.find(series =>
            series.key.replace("Cpd", "") === hoverPoint.key.replace("Cpd", "")) : undefined;
          return (
            <article key={chartIndex} className={`chart-card min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card ${chart.stacked ? "lg:col-span-2" : ""}`}>
              <div className="space-y-2 border-b border-border px-4 py-3">
                <h3 className="font-semibold capitalize text-content-primary">{chart.title}</h3>
                <p className="text-xs text-content-muted">{chart.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-secondary">
                  {chart.series.map((series) => <span key={series.key} className="flex items-center gap-1.5" style={{ color: series.color }}>
                    {chart.stacked ? <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} /> : <svg width="30" height="16" aria-hidden="true"><line x1="1" x2="29" y1="8" y2="8" stroke={series.color} strokeWidth={series.width ?? 2} strokeDasharray={series.dash} /><SeriesMarker series={series} x={15} y={8} /></svg>}{series.label}
                    {chart.stacked && <strong>{displayNumber(rows.reduce((sum, row) => sum + (row[series.key] ?? 0), 0))}h</strong>}
                  </span>)}
                </div>
              </div>
              <div ref={(node) => { nodes.current[chartIndex] = node; }} onScroll={(event) => { setHoverDate(null); setHoverPoint(null); onScroll(chartIndex, event); }}
                role="region" aria-label={`${chart.title} scroll area`} tabIndex={0} data-chart-scroll={chartIndex}
                className="chart-plot overflow-x-auto overscroll-x-contain pb-2 [scroll-behavior:auto] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                <svg width={width} height={height} className="max-w-none" role="img" aria-label={chart.title}>
                  <text x={left} y={13} fontSize={10} fill="var(--color-content-secondary)">{chart.stacked ? "Hours" : chart.key === "cpd" ? "Charts per day" : "Number of charts"}</text>
                  {!chart.series.length && <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="var(--color-content-secondary)">Select a series to display</text>}
                  {[0, 1, 2, 3, 4].map((tick) => <g key={tick}>
                    <line x1={left} x2={width - right} y1={y(yMax * tick / 4)} y2={y(yMax * tick / 4)} stroke="var(--color-border)" />
                    <text x={left - 8} y={y(yMax * tick / 4) + 4} textAnchor="end" fontSize={10} fill="var(--color-content-muted)">{formatValue(yMax * tick / 4)}{chart.stacked ? "h" : ""}</text>
                  </g>)}
                  {chart.stacked ? rows.map((row, i) => {
                    let sum = 0;
                    return <g key={row.date}>{chart.series.map((series) => {
                      const value = row[series.key] ?? 0;
                      const base = sum;
                      sum += value;
                      const barHeight = y(base) - y(sum);
                      return <g key={series.key}>
                        <rect x={x(i) - Math.min(34, step * 0.6) / 2} y={y(sum)} width={Math.min(34, step * 0.6)} height={barHeight} fill={series.color} rx={2}>
                          <title>{row.label} · {series.label}: {displayNumber(value)} hours</title>
                        </rect>
                        {barHeight >= 18 && <text x={x(i)} y={y(sum) + barHeight / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="white">{displayNumber(value)}</text>}
                      </g>;
                    })}</g>;
                  }) : chart.series.map((series) => {
                    let drawing = false;
                    const path = rows.map((row, i) => {
                      const value = row[series.key];
                      if (value === null) { drawing = false; return ""; }
                      const command = drawing ? "L" : "M";
                      drawing = true;
                      return `${command}${x(i)},${y(value)}`;
                    }).join(" ");
                    return <g key={series.key}>
                      <path d={path} fill="none" stroke={series.color} strokeWidth={series.width ?? 2} strokeDasharray={series.dash} />
                      {rows.map((row, i) => row[series.key] === null ? null : <SeriesMarker key={row.date} series={series} x={x(i)} y={y(row[series.key]!)} title={`${row.label} · ${series.label}: ${formatValue(row[series.key], series.key)}`} />)}
                    </g>;
                  })}
                  {rows.map((row, i) => <g key={row.date}>
                    <text x={x(i)} y={height - 32} textAnchor="middle" fontSize={10} fill="var(--color-content-muted)"><tspan x={x(i)} fontWeight={600}>{axisDateLabel(row.date, interval).top}</tspan><tspan x={x(i)} dy={15}>{axisDateLabel(row.date, interval).bottom}</tspan></text>
                    {row.date === selected.date && <line x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="var(--color-content-muted)" strokeDasharray="3 4" opacity={0.5} />}
                    <rect x={x(i) - step / 2} y={top} width={step} height={bottom - top} fill="transparent"
                      onMouseMove={(event) => {
                        const svg = event.currentTarget.ownerSVGElement!;
                        const bounds = svg.getBoundingClientRect();
                        const mouseY = (event.clientY - bounds.top) * height / bounds.height;
                        let stackedValue = 0;
                        const candidates = chart.series.filter(series => row[series.key] != null).map(series => {
                          const value = row[series.key]!;
                          const base = stackedValue;
                          stackedValue += value;
                          const distance = chart.stacked ? Math.max(y(stackedValue) - mouseY, mouseY - y(base), 0) : Math.abs(y(value) - mouseY);
                          return { series, distance };
                        }).sort((a, b) => a.distance - b.distance);
                        const closest = candidates[0];
                        setHoverDate(row.date);
                        setHoverPoint(closest ? {chart:chart.key,key:closest.series.key,date:row.date} : null);
                      }} onMouseLeave={() => { setHoverDate(null); setHoverPoint(null); }} />
                  </g>)}
                  {hoverPoint && hoveredSeries && (() => {
                    const rowIndex = rows.findIndex(row => row.date === hoverPoint.date);
                    const row = rows[rowIndex];
                    const series = hoveredSeries;
                    if (!row || !series) return null;
                    const tooltipX = Math.max(left, Math.min(x(rowIndex) - 115, width - right - 230));
                    const tooltipY = Math.max(top + 4, Math.min(y(row[series.key] ?? 0) - 48, bottom - 44));
                    return <g pointerEvents="none" transform={`translate(${tooltipX} ${tooltipY})`}>
                      <rect width={230} height={42} rx={6} fill="var(--color-surface)" stroke={series.color} />
                      <text x={10} y={16} fontSize={10} fill="var(--color-content-secondary)">{row.label}</text>
                      <text x={10} y={32} fontSize={11} fontWeight={600} fill={series.color}>{series.label}: {formatValue(row[series.key], series.key)}{chart.stacked ? "h" : ""}</text>
                    </g>;
                  })()}
                </svg>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border bg-surface-muted px-5 py-3 text-xs" data-chart-details={chartIndex}>
                <strong className="text-content-primary">{selected.label}</strong>
                {chart.series.filter(series => !hoverPoint || hoveredSeries?.key === series.key).map((series) => <span key={series.key} style={{ color: series.color }}>{series.label}: <strong>{formatValue(selected[series.key], series.key)}{chart.stacked ? "h" : ""}</strong></span>)}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Marker shapes and line patterns keep coincident sources identifiable. */
function SeriesMarker({ series, x, y, title }: { series: Series; x: number; y: number; title?: string }) {
  return <g transform={`translate(${x} ${y})`}>
    {title && <title>{title}</title>}
    {series.marker === "square" ? <rect x={-6} y={-6} width={12} height={12} fill="none" stroke={series.color} strokeWidth={2.5} />
      : series.marker === "diamond" ? <path d="M0 -4.5 4.5 0 0 4.5 -4.5 0Z" fill="white" stroke={series.color} strokeWidth={2} />
        : series.marker === "triangle" ? <path d="M0 -4.5 4.5 3.5 -4.5 3.5Z" fill="white" stroke={series.color} strokeWidth={2} />
          : <circle r={4.5} fill={series.color} />}
  </g>;
}
