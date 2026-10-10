import assert from 'node:assert/strict';
import test from 'node:test';
import { loadUserChartRecords } from './userDetailRecords';
import { stageTotals } from '../pages/performance/userDetailData';
import type { DailyEfficiency } from './types';
const args = { userId: 7, fromDate: '2026-10-01', toDate: '2026-10-09' };
test('loads every page and keeps the selected person and period in each request', async () => {
 const urls: string[] = [];
 const result = await loadUserChartRecords(args, async ({url}) => { urls.push(url); return {data:{total:3,items: urls.length===1 ? [{id:1,userId:7},{id:2,userId:7}] : [{id:3,userId:7}]}}; });
 assert.equal(result.data?.length,3); assert.equal(urls.length,2);
 for (const url of urls) {const q=new URL(url,'http://local').searchParams; assert.equal(q.get('userId'),'7');assert.equal(q.get('fromDate'),args.fromDate);}
});
test('does not show partial or duplicate history as complete', async () => {
 let page=0; const result=await loadUserChartRecords(args,async()=>({data:{total:2,items:[{id:1,userId:7}],page:++page}})); assert.ok(result.error); assert.equal(result.data,undefined);
});
test('propagates authorization failures without falling back to unscoped records',async()=>{
 let calls=0;const result=await loadUserChartRecords(args,async()=>{calls++;return {error:{status:403,message:'Forbidden',data:null}};});assert.equal(result.error?.status,403);assert.equal(calls,1);
});
test('groups charts by historical daily stage, preserving unassigned and both sources',()=>{
 const day=(date:string,stage:string|null,kairon:number,manual:number)=>({date,stage,kaironCharts:kairon,manualCharts:manual,adjustedTarget:'20.5',dailyTarget:30} as DailyEfficiency);
 const input=[day('2026-10-03','M2',15,14),day('2026-10-01','M1',10,11),day('2026-10-04',null,2,0),day('2026-10-02','M1',20,21)];
 const result=stageTotals(input);assert.deepEqual(result.map(r=>[r.stage,r.kairon,r.manual]),[['M1',30,32],['M2',15,14],['Unassigned',2,0]]);assert.equal(result[0].adjusted,41);assert.equal(result[0].target,60);assert.equal(input[0].stage,'M2');
});

test('held history stays scoped to one user and excludes completion dates',async()=>{
 const result=await loadUserChartRecords(args,async({url})=>{assert.ok(url.startsWith('/reports/kairon/holds?'));const q=new URL(url,'http://local').searchParams;assert.equal(q.get('userId'),'7');assert.equal(q.has('fromDate'),false);return {data:{total:1,items:[{id:9,userId:7,status:'On Hold'}]}};},undefined,true);assert.equal(result.data?.length,1);
});
test('held history rejects records outside the user or held status',async()=>{
 const result=await loadUserChartRecords(args,async()=>({data:{total:1,items:[{id:9,userId:7,status:'Completed'}]}}),undefined,true);assert.ok(result.error);
});
