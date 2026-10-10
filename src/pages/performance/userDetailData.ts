import type { DailyEfficiency } from '@/api/types';
export function stageTotals(days: DailyEfficiency[]) {
  const stages = new Map<string, { stage: string; from: string; to: string; days: number; kairon: number; manual: number; adjusted: number; target: number }>();
  for (const day of [...days].sort((a,b) => a.date.localeCompare(b.date))) {
    const key = day.stage ?? 'Unassigned';
    const row = stages.get(key) ?? { stage: key, from: day.date, to: day.date, days: 0, kairon: 0, manual: 0, adjusted: 0, target: 0 };
    row.to = day.date; row.days++; row.kairon += day.kaironCharts; row.manual += day.manualCharts;
    row.adjusted += Number(day.adjustedTarget ?? 0); row.target += day.dailyTarget ?? 0;
    stages.set(key, row);
  }
  return [...stages.values()];
}

export function dailyChartProduction(rows: import('@/api/types').KaironChartRecord[]) {
  const days = new Map<string, {date:string; pvp:number; foundation:number; total:number}>();
  for (const row of rows) {
    const date = row.completed ?? 'Unknown date';
    const day = days.get(date) ?? {date,pvp:0,foundation:0,total:0};
    if (row.program.toUpperCase() === 'PVP') day.pvp++;
    if (row.program.toUpperCase() === 'FOUNDATION') day.foundation++;
    day.total++; days.set(date,day);
  }
  return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
