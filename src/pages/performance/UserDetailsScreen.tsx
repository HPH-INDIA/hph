import { displayNumber, displayCpd } from "@/utils/displayNumber";
import { UserKaironRecords, UserHeldCharts } from "./UserKaironRecords";
import { useState, type ReactNode } from 'react';
import { useGetManagerDashboardQuery, useGetLeadDashboardQuery } from '@/api/reportsApi';
import { useListManualDailyRecordsQuery } from '@/api/manualDailyRecordsApi';
import { useGetUserChartHistoryQuery } from '@/api/userDetailsApi';
import { useListTeamCohortsQuery } from '@/api/cohortsApi';
import { getErrorMessage } from '@/api/apiError';
import type { DailyEfficiency, ManualDailyRecord } from '@/api/types';
import { useAuth } from '@/features/auth/useAuth';
import { ActionScreen } from '@/components/ui/ActionScreen';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { metricIdentity } from '@/components/ui/metricIdentity';
import { TeamOverview } from './TeamOverview';
import { DailyPerformance } from './DailyPerformance';
import { PerformanceTabs } from './PerformanceTabs';
import { ReportingPeriodFields, performanceInputClass } from './ReportingPeriodFields';
import { defaultLeadFilters, leadDashboardQuery, leadFilterError, leadPeriodLabel, localDayValue, type LeadFilters } from './leadFilters';
import { stageTotals } from './userDetailData';

export interface DetailPerson { userId: number; name: string; roleType: 'lead' | 'employee'; empId?: string | null; isActive: boolean; leadName?: string }
type Tab = 'overview' | 'stages' | 'kairon' | 'manual' | 'daily' | 'holds';
const tabs: {value: Tab; label: string}[] = [{value:'overview',label:'Overview'},{value:'stages',label:'Stages'},{value:'kairon',label:'Kairon charts'},{value:'holds',label:'On hold charts'},{value:'manual',label:'Manual records'},{value:'daily',label:'Daily performance'}];
const num = displayNumber;
export function UserDetailsScreen({ person, initialFilters, onClose }: {person: DetailPerson; initialFilters?: LeadFilters; onClose: () => void}) {
  const today = localDayValue();
  const { user } = useAuth();
  const isManager = user?.role.roleType === 'manager';
  const [filters, setFilters] = useState<LeadFilters>(() => ({...initialFilters ?? defaultLeadFilters(today), coderId: 'ALL'}));
  const [draft, setDraft] = useState(filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const query = leadDashboardQuery(filters, today);
  const manager = useGetManagerDashboardQuery({...query, ...(person.roleType === 'employee' ? {coderId: person.userId} : {leadId: person.userId})}, {skip: !isManager});
  const lead = useGetLeadDashboardQuery({...query, coderId: person.userId}, {skip: isManager});
  const response = isManager ? manager : lead;
  const section = isManager ? (person.roleType === 'lead' ? manager.currentData?.qa : manager.currentData?.coders) : lead.currentData?.coders;
  const from = section?.efficiency.from ?? '';
  const to = section?.efficiency.to ?? '';
  const charts = useGetUserChartHistoryQuery({userId: person.userId, fromDate: from, toDate: to}, {skip: !from || !to});
  const manual = useListManualDailyRecordsQuery({userId: person.userId, fromDate: from, toDate: to}, {skip: !from || !to});
  const cohorts = useListTeamCohortsQuery(undefined, {skip: person.roleType !== 'employee'});
  const cohort = cohorts.currentData?.find(item => item.members.some(member => member.user.id === person.userId));
  const membership = cohort?.members.find(member => member.user.id === person.userId);
  const days = section?.efficiency.daily ?? [];
  const rangeError = leadFilterError(draft, today);
  const records = manual.currentData?.filter(row => row.userId === person.userId) ?? [];
  const completed = charts.currentData ?? [];
  const currentStage = membership?.currentStage;
  const latestStage = [...days].sort((a,b) => b.date.localeCompare(a.date)).find(day => day.stage)?.stage;
  return <ActionScreen open title={person.name} description="Individual performance, stage progress, and source records." onClose={onClose} widthClass="max-w-none">
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
          <span className="rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-800">{person.roleType === 'lead' ? 'QA lead' : 'Coder'}</span>
          <span>{person.empId ? `Employee ID ${person.empId}` : `User #${person.userId}`}</span><span>· {person.isActive ? 'Active' : 'Inactive'}</span>
          {person.leadName && <span>· Lead: {person.leadName}</span>}{cohort && <span>· {cohort.label}</span>}
        </div>
        <div className="flex items-center gap-2"><span className="text-sm text-content-secondary">{leadPeriodLabel(filters,today)}</span><Button variant="secondary" onClick={() => {setDraft(filters);setFilterOpen(true);}}>Date filters</Button></div>
      </div>
      <Drawer open={filterOpen} onClose={() => setFilterOpen(false)} title="User details filters" description="Dates apply to performance and completed records. On hold charts show current inventory across all dates." widthClass="max-w-md">
        <form className="flex flex-col gap-5" onSubmit={event => {event.preventDefault(); if (!rangeError) {setFilters(draft);setFilterOpen(false);}}}>
          <ReportingPeriodFields draft={draft} today={today} onChange={setDraft}/>
          {membership && <Button type="button" variant="secondary" onClick={() => setDraft({...draft,dateMode:'range',rangeStart:membership.joinedOn,rangeEnd:today})}>Since joining cohort</Button>}
          {rangeError && <p role="alert" className="text-sm text-danger">{rangeError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFilterOpen(false)}>Cancel</Button><Button type="submit" disabled={Boolean(rangeError)}>Apply dates</Button></div>
        </form>
      </Drawer>
      {response.error ? <ErrorState message={getErrorMessage(response.error)} onRetry={response.refetch}/> : !section ? <LoadingState label="Loading user performance…"/> : <>
        <TeamOverview summary={section.efficiency} people={1} scope="Individual performance" showRates individual/>
        <PerformanceTabs value={tab} onChange={setTab} items={tabs} label="User details sections"/>
        {tab === 'overview' && <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={person.roleType === 'lead' ? 'QA stage' : 'Stage & assignment'}>
              <p className="text-2xl font-semibold">{currentStage ?? latestStage ?? 'Not assigned'}</p>
              <p className="mt-2 text-xs text-content-secondary">{currentStage ? 'Current cohort stage' : latestStage ? 'Latest recorded stage in this period' : 'No stage information available'}</p>
              {membership && <p className="mt-3 text-sm text-content-secondary">Joined cohort {membership.joinedOn}</p>}
              {cohorts.error && <p className="mt-2 text-xs text-content-muted">Current cohort details unavailable.</p>}
              <button className="mt-4 text-sm font-medium text-brand-700 underline" onClick={() => setTab('stages')}>View stage breakdown →</button>
            </Panel>
            <Panel title={filters.dateMode === 'month' ? 'Full-month goals' : 'Goals for this period'}>{filters.dateMode === 'month' && <p className="-mt-2 mb-4 text-xs text-content-secondary">Includes remaining working days this month. Performance totals above cover recorded dates.</p>}<dl className="grid grid-cols-2 gap-4">
              <Metric label="Adjusted Target" value={num(Number(section.goal.adjustedTargetCharts ?? section.efficiency.adjustedTarget))}/>
              <Metric label="Target Goal" value={num(section.goal.targetCharts)}/>
              <Metric label="Eligible days" value={num(section.goal.eligibleDays)}/><Metric label="Full leave days" value={num(section.goal.leaveDaysExcluded)}/>
            </dl></Panel>
            <Panel title="Time & attendance"><dl className="grid grid-cols-2 gap-4"><Metric label="Login hours" value={num(section.efficiency.insideMinutes / 60)}/><Metric label="Productive hours" value={num(section.efficiency.productiveMinutes / 60)}/><Metric label="Login days" value={num(section.efficiency.loginDays)}/><Metric label="Calculated days" value={num(section.efficiency.calculatedDays)}/></dl></Panel>
          </div>
          <StageBreakdown days={days}/>
          <div className="grid gap-4 md:grid-cols-2"><Panel title="Kairon chart history"><p className="text-sm text-content-secondary">Every completed chart in this date range, with program, review level, practice, dates, and turnaround time.</p><Button variant="secondary" className="mt-4" onClick={() => setTab('kairon')}>View Kairon charts</Button></Panel><Panel title="Manual record history"><p className="text-sm text-content-secondary">Daily production by program, recorded hours, targets, and approval status.</p><Button variant="secondary" className="mt-4" onClick={() => setTab('manual')}>View manual records</Button></Panel></div>
        </>}
        {tab === 'stages' && <><StageBreakdown days={days}/><Panel title="Kairon review levels"><p className="mb-4 text-xs text-content-secondary">Review levels (1LR, 2LR, 3LR) are separate from the person’s training stage.</p><SourceState error={charts.error} loading={!charts.currentData} retry={charts.refetch}>{['1LR','2LR','3LR'].map(level => <div key={level} className="mb-3 flex items-center justify-between border-b border-border pb-3 text-sm"><span>{level}</span><span data-metric="kairon" className="metric-value font-semibold">{num(completed.filter(row=>row.level===level).length)} completed</span></div>)}</SourceState></Panel></>}
        {tab === 'kairon' && <SourceState error={charts.error} loading={!charts.currentData} retry={charts.refetch}><UserKaironRecords rows={completed} personName={person.name}/></SourceState>}
        {tab === 'holds' && <UserHeldCharts userId={person.userId}/> }
        {tab === 'manual' && <SourceState error={manual.error} loading={!manual.currentData} retry={manual.refetch}><ManualRecords rows={records}/></SourceState>}
        {tab === 'daily' && <DailyPerformance paginate={false} rows={days} month={from.slice(0,7)} title="Daily performance" periodLabel={leadPeriodLabel(filters,today)} showYear exportName={`user-${person.userId}-${from}-${to}`}/>}
        <p className="text-xs text-content-muted">{tab === "holds" ? "Current held inventory for this user, across all creation dates." : <>Showing {from} to {to}. Kairon counts completed charts; Manual shows saved production. Rates use the existing reporting calculations.</>}</p>
      </>}
    </div>
  </ActionScreen>;
}
function Panel({title,children}:{title:string;children:ReactNode}) { return <section className="min-w-0 rounded-xl border border-border bg-surface p-4"><h2 className="mb-4 text-base font-semibold">{title}</h2>{children}</section>; }
function Metric({label,value}:{label:string;value:string}) {return <div data-metric={metricIdentity(label)} className="metric-block"><dt className="text-xs text-content-secondary">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>;}
function SourceState({error,loading,retry,children}:{error:unknown;loading:boolean;retry:()=>unknown;children:ReactNode}) {return error ? <ErrorState message={getErrorMessage(error)} onRetry={retry}/> : loading ? <LoadingState label="Loading complete record history…"/> : <>{children}</>;}
function StageBreakdown({days}:{days:DailyEfficiency[]}) {
 const stages=stageTotals(days); const max=Math.max(1,...stages.flatMap(row=>[row.kairon,row.manual]));
 return <Panel title="Stage-wise completed charts"><p className="-mt-2 mb-4 text-xs text-content-secondary">Counts follow each day’s recorded training stage. Targets below cover recorded days in the selected range.</p>{!stages.length ? <p>No stage records for this period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-sm"><thead><tr>{['Stage / recorded dates','Kairon charts','Manual charts','Adjusted Target','Target Goal'].map(label=><th key={label} data-metric={metricIdentity(label)} className="px-3 py-2 text-left text-xs font-medium">{label}</th>)}</tr></thead><tbody>{stages.map(row=><tr key={row.stage} className="border-t border-border"><th className="px-3 py-4 text-left font-medium">{row.stage}<span className="mt-1 block text-xs font-normal text-content-secondary">{row.from} – {row.to}</span></th>{(['kairon','manual'] as const).map(source=><td key={source} className="px-3 py-4"><span data-metric={source} className="metric-value font-semibold">{num(row[source])}</span><div className="mt-2 h-1.5 w-full rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{width:`${row[source]/max*100}%`,background:`var(--color-metric-${source})`}}/></div></td>)}<td data-metric="adjusted" className="metric-value px-3 py-4">{num(row.adjusted)}</td><td data-metric="target" className="metric-value px-3 py-4">{num(row.target)}</td></tr>)}</tbody><tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr><th scope="row" className="px-3 py-3 text-left">Total</th>{(['kairon','manual','adjusted','target'] as const).map(key => <td key={key} className="px-3 py-3">{num(stages.reduce((sum,row) => sum + row[key],0))}</td>)}</tr></tfoot></table></div>}</Panel>;
}
function RecordsTable({headers,rows,totals}:{headers:string[];rows:ReactNode[][];totals?:ReactNode[]}) {return <div className="max-h-[65vh] overflow-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label="Source record table"><table className="w-full whitespace-nowrap text-left text-xs"><thead className="sticky top-0 bg-surface-muted"><tr>{headers.map(label=><th key={label} data-metric={metricIdentity(label)} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map((cells,index)=><tr key={index} className="border-t border-border hover:bg-surface-muted">{cells.map((cell,col)=><td key={col} data-metric={metricIdentity(headers[col])} className="metric-value px-3 py-3">{cell ?? '—'}</td>)}</tr>)}</tbody>{totals && <tfoot className="border-t-2 border-border bg-surface-muted font-semibold"><tr>{totals.map((value,index) => index === 0 ? <th key={index} scope="row" className="px-3 py-3">{value}</th> : <td key={index} className="px-3 py-3">{value}</td>)}</tr></tfoot>}</table>{!rows.length&&<p className="p-8 text-center">No records match these filters.</p>}</div>;}
function ManualRecords({rows}:{rows:ManualDailyRecord[]}) {
 const [status,setStatus]=useState('ALL'); const visible=rows.filter(row=>status==='ALL'||row.status===status);
 const hours=(key:'techIssuesDowntimeHours'|'noInventoryIdleTimeHours'|'leaveHours'|'meetingEngagementHours')=>num(rows.reduce((sum,row)=>sum+Number(row[key]),0));
 return <Panel title="Manual daily records"><dl className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4"><Metric label="Downtime hours" value={hours('techIssuesDowntimeHours')}/><Metric label="Idle hours" value={hours('noInventoryIdleTimeHours')}/><Metric label="Leave hours" value={hours('leaveHours')}/><Metric label="Meeting hours" value={hours('meetingEngagementHours')}/></dl><div className="mb-4 flex items-end gap-4"><label className="text-xs">Approval status<select className={performanceInputClass} value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All statuses</option>{['pending','approved','rejected'].map(value=><option key={value}>{value}</option>)}</select></label><span role="status" className="pb-2 text-xs">{visible.length} of {rows.length} records</span></div><RecordsTable totals={['Total', ...(['productionCount','pvpCount','foundationCount','dailyTarget','adjustedCpd','techIssuesDowntimeHours','noInventoryIdleTimeHours','leaveHours','meetingEngagementHours'] as const).map(key => visible.some(row => row[key] != null) ? num(visible.reduce((sum,row) => sum + Number(row[key] ?? 0),0)) : '—'), '—','—','—','—']} headers={['Date','Manual charts','PVP','Foundation','Target Goal','Adjusted Target','Downtime h','Idle h','Leave h','Meeting h','Meeting type','Status','Reviewed','Rejection reason']} rows={visible.map(row=>[row.date,row.productionCount,row.pvpCount,row.foundationCount,num(row.dailyTarget),displayCpd(row.adjustedCpd),num(row.techIssuesDowntimeHours),num(row.noInventoryIdleTimeHours),num(row.leaveHours),num(row.meetingEngagementHours),row.meetings?.map(m=>`${m.type ?? "Unspecified"}: ${num(m.hours)}h`).join(', ')||row.meetingType,row.status,row.reviewedAt,row.rejectionReason])}/></Panel>;
}
