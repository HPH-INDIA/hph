import { useState } from 'react';
import type { KaironChartRecord } from '@/api/types';
import { useGetUserHoldHistoryQuery } from '@/api/userDetailsApi';
import { getErrorMessage } from '@/api/apiError';
import { useAuth } from '@/features/auth/useAuth';
import { ActionScreen } from '@/components/ui/ActionScreen';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { performanceInputClass } from './ReportingPeriodFields';
import { dailyChartProduction } from './userDetailData';

export function UserKaironRecords({rows,personName}:{rows:KaironChartRecord[];personName:string}) {
  const [practice,setPractice]=useState('ALL');
  const [date,setDate]=useState<string|null>(null);
  const visible=rows.filter(row=>practice==='ALL'||(row.practice?.trim()||'UNSPECIFIED')===practice);
  const days=dailyChartProduction(visible);
  return <section className="rounded-xl border border-border bg-surface p-4">
    <h2 className="text-base font-semibold">Kairon daily production</h2>
    <p className="mt-1 text-xs text-content-secondary">Select a date to see its completed chart records.</p>
    <div className="my-4 flex flex-wrap items-end justify-between gap-3"><PracticeFilter rows={rows} value={practice} onChange={setPractice}/><p role="status" className="text-xs text-content-secondary">{days.length} days · {visible.length} completed charts</p></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-muted text-xs"><tr>{['Date','PVP','Foundation','Total production'].map(label=><th key={label} className={`px-4 py-3 ${label==='Date'?'text-left':'text-right'}`}>{label}</th>)}</tr></thead>
      <tbody>{days.map(day=><tr key={day.date} className="border-t border-border hover:bg-surface-muted cursor-pointer" onClick={()=>setDate(day.date)}><th scope="row" className="px-4 py-3 text-left"><button onClick={event=>{event.stopPropagation();setDate(day.date);}} className="min-h-10 rounded text-brand-700 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`View charts for ${day.date}`}>{day.date} <span aria-hidden="true">→</span></button></th><td className="px-4 py-3 text-right tabular-nums">{day.pvp}</td><td className="px-4 py-3 text-right tabular-nums">{day.foundation}</td><td data-metric="kairon" className="metric-value px-4 py-3 text-right font-semibold tabular-nums">{day.total}</td></tr>)}</tbody>
      {days.length>0&&<tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr><th className="px-4 py-3 text-left">Total</th><td className="px-4 py-3 text-right">{days.reduce((sum,d)=>sum+d.pvp,0)}</td><td className="px-4 py-3 text-right">{days.reduce((sum,d)=>sum+d.foundation,0)}</td><td data-metric="kairon" className="metric-value px-4 py-3 text-right">{visible.length}</td></tr></tfoot>}
    </table>{!days.length&&<p className="p-8 text-center text-sm text-content-secondary">No completed charts match this practice and date range.</p>}</div>
    {date&&<ActionScreen open onClose={()=>setDate(null)} title={`${personName} · ${date}`} description={`Completed Kairon charts${practice!=='ALL'?` · ${practice==='UNSPECIFIED'?'No practice specified':practice}`:''}. Back returns to daily production.`} widthClass="max-w-none"><ChartList rows={visible.filter(row=>(row.completed??'Unknown date')===date)}/></ActionScreen>}
  </section>;
}

export function UserHeldCharts({userId}:{userId:number}) {
  const {user}=useAuth();
  const result=useGetUserHoldHistoryQuery({userId,viewerId:user?.id??0},{skip:!user,refetchOnMountOrArgChange:true});
  return <section className="rounded-xl border border-border bg-surface p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">On hold charts</h2><p className="mt-1 text-xs text-content-secondary">This user’s current held inventory across all creation dates. The profile’s completion-date range does not apply.</p></div><button className="rounded-md border border-border px-3 py-2 text-sm" onClick={()=>result.refetch()} disabled={result.isFetching}>Refresh</button></div>{result.error?<ErrorState message={getErrorMessage(result.error)} onRetry={result.refetch}/>:!result.currentData?<LoadingState label="Loading all held charts…"/>:<ChartList rows={result.currentData} held/>}</section>;
}

function PracticeFilter({rows,value,onChange}:{rows:KaironChartRecord[];value:string;onChange:(value:string)=>void}) {
  const practices=[...new Set(rows.map(row=>row.practice?.trim()||'UNSPECIFIED'))].sort();
  return <label className="flex max-w-full flex-col gap-1 text-xs text-content-secondary">Practice<select className={`${performanceInputClass} max-w-full sm:max-w-sm`} value={value} onChange={event=>onChange(event.target.value)}><option value="ALL">All practices</option>{practices.map(practice=><option key={practice} value={practice}>{practice==='UNSPECIFIED'?'No practice specified':practice}</option>)}</select></label>;
}
function ChartList({rows,held=false}:{rows:KaironChartRecord[];held?:boolean}) {
  const [practice,setPractice]=useState('ALL');const [search,setSearch]=useState('');const [level,setLevel]=useState('ALL');
  const visible=rows.filter(row=>(practice==='ALL'||(row.practice?.trim()||'UNSPECIFIED')===practice)&&(level==='ALL'||row.level===level)&&`${row.id} ${row.program} ${row.practice??''}`.toLowerCase().includes(search.toLowerCase()));
  return <><div className="mb-4 flex flex-wrap items-end gap-3"><PracticeFilter rows={rows} value={practice} onChange={setPractice}/><label className="text-xs text-content-secondary">Search charts<input type="search" placeholder="Record ID, program or practice" className={performanceInputClass} value={search} onChange={event=>setSearch(event.target.value)}/></label><label className="text-xs text-content-secondary">Review level<select className={performanceInputClass} value={level} onChange={event=>setLevel(event.target.value)}><option value="ALL">All levels</option>{['1LR','2LR','3LR'].map(value=><option key={value}>{value}</option>)}</select></label><p role="status" className="pb-2 text-xs text-content-secondary">{visible.length} of {rows.length} {held?'held':'completed'} charts</p></div>
    <div className="max-h-[65vh] overflow-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label={held?'User held chart records':'Daily completed chart records'}><table className="w-full whitespace-nowrap text-left text-xs"><thead className="sticky top-0 bg-surface-muted"><tr>{['Record ID',held?'Status':'Completed','Program','Review level','Practice','Created','Last action','Actions','TAT','Age'].map(label=><th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.id} className="border-t border-border hover:bg-surface-muted">{[row.id,held?row.status:row.completed,row.program,row.level,row.practice,row.created,row.lastAction,row.actions,row.tat,row.age].map((value,index)=><td key={index} className="px-3 py-3">{value??'—'}</td>)}</tr>)}</tbody></table>{!visible.length&&<p className="p-8 text-center text-sm text-content-secondary">{rows.length?'No charts match these filters.':held?'No charts are currently on hold for this user.':'No completed charts for this date.'}</p>}</div></>;
}
