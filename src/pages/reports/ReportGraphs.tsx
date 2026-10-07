import { useMemo, useState } from "react";
import type { DailyEfficiency } from "@/api/types";
import { EmptyState } from "@/components/ui/StateViews";
import { buildReportChartRows, type GraphInterval, type ReportChartRow } from "./reportChartData";
import { useLinkedChartScroll } from "./useLinkedChartScroll";

type ValueKey = "target" | "adjusted" | "manual" | "kairon" | "targetCpd" | "adjustedCpd" | "manualCpd" | "kaironCpd" | "idle" | "downtime" | "meeting";
interface Series { key: ValueKey; label: string; color: string; dashed?: boolean }
const PRODUCTION: Series[] = [
  { key: "target", label: "Target goal", color: "var(--color-content-muted)", dashed: true },
  { key: "adjusted", label: "Adjusted target", color: "var(--color-chart-target)", dashed: true },
  { key: "manual", label: "Manual charts", color: "var(--color-chart-manual)" },
  { key: "kairon", label: "Kairon charts", color: "var(--color-chart-kairon)" },
];
const CPD: Series[] = [
  { key: "targetCpd", label: "Target CPD", color: "var(--color-content-muted)", dashed: true },
  { key: "adjustedCpd", label: "Adjusted CPD", color: "var(--color-chart-target)", dashed: true },
  { key: "manualCpd", label: "Manual CPD", color: "var(--color-chart-manual)" },
  { key: "kaironCpd", label: "Kairon CPD", color: "var(--color-chart-kairon)" },
];
const LOST: Series[] = [
  { key: "idle", label: "Idle", color: "var(--color-warning)" },
  { key: "downtime", label: "Downtime", color: "var(--color-chart-downtime)" },
  { key: "meeting", label: "Meetings", color: "#4f91a8" },
];
const formatValue = (value: number | null) => value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);

export function ReportGraphs({ sources, from, to, teamView = false }: {
  sources: DailyEfficiency[][]; from: string; to: string; teamView?: boolean;
}) {
  const [interval, setInterval] = useState<GraphInterval>("day");
  const dayCount = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  const intervals: GraphInterval[] = ["day", ...(dayCount > 15 ? ["week" as const] : []), ...(dayCount > 50 ? ["month" as const] : [])];
  const active = intervals.includes(interval) ? interval : "day";
  const rows = useMemo(() => from && to ? buildReportChartRows(sources, from, to, active) : [], [sources, from, to, active]);
  return (
    <section className="min-w-0 space-y-3" aria-label="Linked performance graphs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-content-muted">Scroll any graph to move all three through the same dates.</p>
        {intervals.length > 1 && <div role="group" aria-label="Graph interval" className="flex rounded-lg border border-border bg-surface p-1">
          {intervals.map((value) => <button key={value} type="button" aria-pressed={value === active} onClick={() => setInterval(value)}
            className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${value === active ? "bg-brand-600 text-white" : "text-content-secondary hover:bg-surface-muted"}`}>{value}</button>)}
        </div>}
      </div>
      {rows.length ? <LinkedGraphs rows={rows} interval={active} teamView={teamView} timelineKey={`${from}:${to}:${active}:${rows.map((row) => row.date).join(",")}`} />
        : <EmptyState title="No graph data for this period" />}
    </section>
  );
}

function LinkedGraphs({ rows, interval, teamView, timelineKey }: { rows: ReportChartRow[]; interval: GraphInterval; teamView: boolean; timelineKey: string }) {
  const { nodes, geometry, start, onScroll } = useLinkedChartScroll(timelineKey, rows.length);
  const first = Math.min(rows.length - 1, Math.max(0, Math.round(start)));
  const last = Math.min(rows.length - 1, first + geometry.visibleCount - 1);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const selected = rows.find((row) => row.date === hoverDate) ?? rows[first];
  const charts = [
    { title: `${interval}-wise lost hours by reason`, series: LOST, stacked: true,
      description: "Idle, downtime, and meeting hours. Weekdays and reported weekends share the same timeline." },
    { title: `${interval}-wise production comparison`, series: PRODUCTION, stacked: false,
      description: "Manual and Kairon chart counts against target goal and adjusted target." },
    { title: `${interval}-wise CPD comparison`, series: CPD, stacked: false,
      description: `${teamView || interval !== "day" ? "Target and adjusted CPD are averages per recorded coder-day. " : ""}Actual CPD uses effective target hours; adjusted CPD uses saved manual deductions.` },
  ];
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs font-medium text-content-secondary" data-testid="graph-visible-period">Showing {rows[first].label}{first !== last ? ` – ${rows[last].label}` : ""}</p>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {charts.map((chart, chartIndex) => {
          const { width, step, left, right } = geometry.charts[chartIndex];
          const height = chart.stacked ? 280 : 340;
          const bottom = height - 58;
          const maximum = Math.max(1, ...rows.map((row) => chart.stacked
            ? chart.series.reduce((total, series) => total + (row[series.key] ?? 0), 0)
            : Math.max(0, ...chart.series.map((series) => row[series.key] ?? 0))));
          const top = 25;
          const yMax = Math.ceil(maximum / (chart.stacked ? 1 : 5)) * (chart.stacked ? 1 : 5);
          const x = (index: number) => left + (index + 0.5) * step;
          const y = (value: number) => bottom - value / yMax * (bottom - top);
          return (
            <article key={chartIndex} className={`min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card ${chart.stacked ? "lg:col-span-2" : ""}`}>
              <div className="space-y-2 border-b border-border px-5 py-4">
                <h3 className="font-semibold capitalize text-content-primary">{chart.title}</h3>
                <p className="text-xs text-content-muted">{chart.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-secondary">
                  {chart.series.map((series) => <span key={series.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />{series.label}
                    {chart.stacked && <strong>{rows.reduce((sum, row) => sum + (row[series.key] ?? 0), 0).toFixed(1)}h</strong>}
                  </span>)}
                </div>
              </div>
              <div ref={(node) => { nodes.current[chartIndex] = node; }} onScroll={(event) => { setHoverDate(null); onScroll(chartIndex, event); }}
                role="region" aria-label={`${chart.title} scroll area`} tabIndex={0} data-chart-scroll={chartIndex}
                className="overflow-x-auto overscroll-x-contain pb-2 [scroll-behavior:auto] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                <svg width={width} height={height} className="max-w-none" role="img" aria-label={chart.title}>
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
                          <title>{row.label} · {series.label}: {value.toFixed(1)} hours</title>
                        </rect>
                        {barHeight >= 18 && <text x={x(i)} y={y(sum) + barHeight / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="white">{value.toFixed(1)}</text>}
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
                      <path d={path} fill="none" stroke={series.color} strokeWidth={2} strokeDasharray={series.dashed ? "6 4" : undefined} />
                      {rows.map((row, i) => row[series.key] === null ? null : <circle key={row.date} cx={x(i)} cy={y(row[series.key]!)} r={3} fill={series.color}>
                        <title>{row.label} · {series.label}: {formatValue(row[series.key])}</title>
                      </circle>)}
                    </g>;
                  })}
                  {rows.map((row, i) => <g key={row.date}>
                    <text x={x(i)} y={height - 25} textAnchor="end" transform={`rotate(-35 ${x(i)} ${height - 25})`} fontSize={10} fill="var(--color-content-muted)">{row.label}</text>
                    {row.date === selected.date && <line x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="var(--color-content-muted)" strokeDasharray="3 4" opacity={0.5} />}
                    <rect x={x(i) - step / 2} y={top} width={step} height={bottom - top} fill="transparent" onMouseEnter={() => setHoverDate(row.date)} onMouseLeave={() => setHoverDate(null)}>
                      <title>{row.label}: {chart.series.map((series) => `${series.label} ${formatValue(row[series.key])}`).join(", ")}</title>
                    </rect>
                  </g>)}
                </svg>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border bg-surface-muted px-5 py-3 text-xs" data-chart-details={chartIndex}>
                <strong className="text-content-primary">{selected.label}</strong>
                {chart.series.map((series) => <span key={series.key} className="text-content-secondary">{series.label}: <strong>{formatValue(selected[series.key])}{chart.stacked ? "h" : ""}</strong></span>)}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
