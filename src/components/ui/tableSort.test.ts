import assert from "node:assert/strict";
import test from "node:test";
import { nextTableSort, numericSortValue, sortTableRows, type SortColumn } from "./tableSort";
import { dailyColumns, coderColumns } from "../../pages/performance/performanceColumns";
import type { DailyEfficiency } from "../../api/types";
import type { CoderPerformanceMember } from "../../api/coderPerformance";
import { dailyCsv, filterDays } from "../../pages/performance/performanceView";

test("decimal metrics and signed goal differences sort numerically, with unavailable values last", () => {
  const rows = [{id:1,n:"9.8"},{id:2,n:"100"},{id:3,n:null},{id:4,n:"0"},{id:5,n:"-42.5"},{id:6,n:"invalid"}];
  const columns: SortColumn<typeof rows[number]>[] = [{key:"n",label:"Number",value:row=>numericSortValue(row.n)}];
  assert.deepEqual(sortTableRows(rows,columns,{key:"n",direction:"asc"}).map(row=>row.id),[5,4,1,2,3,6]);
  assert.deepEqual(sortTableRows(rows,columns,{key:"n",direction:"desc"}).map(row=>row.id),[2,1,4,5,3,6]);
  assert.deepEqual(rows.map(row=>row.id),[1,2,3,4,5,6]);
});

test("name sorting is case-insensitive and natural; ties preserve original order", () => {
  const rows=[{name:"Coder 10",id:1},{name:"coder 2",id:2},{name:"CODER 2",id:3}];
  const columns=[{key:"name",label:"Name",value:(row:typeof rows[number])=>row.name}];
  assert.deepEqual(sortTableRows(rows,columns,{key:"name",direction:"asc"}).map(row=>row.id),[2,3,1]);
  assert.deepEqual(sortTableRows(rows,columns,{key:"name",direction:"desc"}).map(row=>row.id),[1,2,3]);
});

test("switching columns respects each default and repeated clicks reverse it", () => {
  const first=nextTableSort({key:"date",direction:"desc"},dailyColumns[4]);
  assert.deepEqual(first,{key:"adjustedCpd",direction:"desc"});
  assert.deepEqual(nextTableSort(first,dailyColumns[4]),{key:"adjustedCpd",direction:"asc"});
  assert.deepEqual(nextTableSort(first,dailyColumns[1]),{key:"stage",direction:"asc"});
});

test("daily sorting follows filtered rows and CSV uses the same sorted dates", () => {
  const rows=[
    {date:"2026-10-01",stage:"Steady",manualCharts:9,adjustedCpd:"30.1",manualEfficiencyPercent:"80"},
    {date:"2026-10-05",stage:"Steady",manualCharts:100,adjustedCpd:"9.9",manualEfficiencyPercent:"90"},
    {date:"2026-09-30",stage:"Ramp",manualCharts:20,adjustedCpd:"100",manualEfficiencyPercent:"110"},
  ] as DailyEfficiency[];
  const sorted=sortTableRows(filterDays(rows,"below","steady",false),dailyColumns,{key:"adjustedCpd",direction:"desc"});
  assert.deepEqual(sorted.map(row=>row.date),["2026-10-01","2026-10-05"]);
  assert.ok(dailyCsv(sorted).indexOf('"2026-10-01"')<dailyCsv(sorted).indexOf('"2026-10-05"'));
  assert.deepEqual(sortTableRows(rows,dailyColumns,{key:"date",direction:"asc"}).map(row=>row.date),["2026-09-30","2026-10-01","2026-10-05"]);
});

test("coder sorting keeps genuine zero rates ahead of unavailable rates and uses visible zero counts", () => {
  const members=[{userId:1,name:"Missing",efficiency:null},{userId:2,name:"Zero",efficiency:{manualCharts:0,manualEfficiencyPercent:"0"}},{userId:3,name:"Active",efficiency:{manualCharts:9,manualEfficiencyPercent:"95.7"}}] as CoderPerformanceMember[];
  assert.deepEqual(sortTableRows(members,coderColumns,{key:"manualEfficiencyPercent",direction:"asc"}).map(row=>row.userId),[2,3,1]);
  assert.deepEqual(sortTableRows(members,coderColumns,{key:"manualEfficiencyPercent",direction:"desc"}).map(row=>row.userId),[3,2,1]);
  assert.deepEqual(sortTableRows(members,coderColumns,{key:"manualCharts",direction:"asc"}).map(row=>row.userId),[1,2,3]);
});

test("adjusted target sorts numerically and follows completed chart counts", () => {
  const members = [
    { userId: 1, efficiency: { adjustedCpd: null } },
    { userId: 2, efficiency: { adjustedCpd: "0.00" } },
    { userId: 3, efficiency: { adjustedCpd: "28.13" } },
    { userId: 4, efficiency: { adjustedCpd: "100.00" } },
  ] as CoderPerformanceMember[];
  assert.deepEqual(coderColumns.slice(1, 5).map((column) => column.label), [
    "Manual charts completed", "Kairon charts completed", "Adjusted target CPD", "Manual CPD",
  ]);
  assert.deepEqual(sortTableRows(members, coderColumns, { key: "adjustedCpd", direction: "desc" }).map((row) => row.userId), [4, 3, 2, 1]);
  assert.deepEqual(sortTableRows(members, coderColumns, { key: "adjustedCpd", direction: "asc" }).map((row) => row.userId), [2, 3, 4, 1]);
});
