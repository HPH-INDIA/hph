import assert from 'node:assert/strict';
import test from 'node:test';
import type { KaironChartRecord } from '@/api/types';
import { dailyChartProduction } from './userDetailData';
test('daily production counts both programs once and sorts newest dates first',()=>{
 const row=(completed:string,program:string)=>({completed,program} as KaironChartRecord);
 assert.deepEqual(dailyChartProduction([row('2026-10-01','PVP'),row('2026-10-02','FOUNDATION'),row('2026-10-01','foundation')]),[{date:'2026-10-02',pvp:0,foundation:1,total:1},{date:'2026-10-01',pvp:1,foundation:1,total:2}]);
 assert.deepEqual(dailyChartProduction([]),[]);
});
