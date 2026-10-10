import type { CoderMetrics } from "@/api/coderPerformance";
import { metricKeys } from "./metricConfiguration";
import { metricTotals } from "./metricTotals";
import { PerformanceMetricValue } from "./PerformanceMetrics";
export function MetricsTotalRow({ rows, daily = false }: { rows: (CoderMetrics | null)[]; daily?: boolean }) {
  const totals = metricTotals(rows);
  return <tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr>
    <th scope="row" className="px-4 py-3 text-left">Total<span className="mt-1 block text-[10px] font-normal text-content-muted">All matching rows · combined rates</span></th>
    {daily && <td className="hidden sm:table-cell"/>}
    {metricKeys.all.map(field => <td key={field} className="px-3 py-3 text-center tabular-nums"><PerformanceMetricValue metrics={totals} field={field}/></td>)}
  </tr></tfoot>;
}
