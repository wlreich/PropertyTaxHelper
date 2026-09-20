import test from 'node:test';
import assert from 'node:assert/strict';
import {parseActivity,activityRows,activityCsv,activityKey} from '../src/lib/property-activity.ts';
import {activityViewFixture} from '../../tools/property-search/activity-view-fixture.mjs';
test('activity contract rejects misleading prices, dates and duplicate events; strips extras',()=>{
 const raw=activityViewFixture();raw.rows[0].owner_name='PRIVATE';const data=parseActivity(raw);assert.ok(data);assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
 assert.equal(data.rows.length,7);assert.equal(new Set(data.rows.map(r=>r.property_id)).size,6);
 for(const change of [r=>{r.rows[0].price=0;},r=>{r.rows[1].price=null;},r=>{r.rows[0].deed_date='2026-12-31';r.rows[0].activity_date='2026-12-31';},r=>{r.rows.push(r.rows[0]);},r=>{r.rows[2].sale_date=null;},r=>{r.rows[0].deed_source=null;},r=>{r.rows[0].activity_date='2026-02-30';}]){const bad=activityViewFixture();change(bad);assert.equal(parseActivity(bad),null);}
 assert.equal(parseActivity({status:'unavailable'}),null);assert.deepEqual(parseActivity(activityViewFixture('9204')).rows,[]);
 assert.equal(activityRows(data,'land','newest').length,1);assert.equal(activityRows(data,'all','oldest')[0].activity_date,'2026-05-25');
});
test('shortlist keeps only selections, price caveats and provenance; neutralizes spreadsheet formulas',()=>{
 const data=parseActivity(activityViewFixture());data.rows[0].address='=SUM(1,2)';data.rows[0].city='Town, \"North\"';
 const csv=activityCsv(data,new Set([activityKey(data.rows[0]),activityKey(data.rows[3])]));
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=SUM(1,2)\""));assert.ok(csv.includes('"Town, ""North"""'));
 assert.ok(csv.includes('Sale unconfirmed'));assert.ok(csv.includes('Not allocated to this property'));assert.ok(csv.includes('2026-07-18'));assert.ok(csv.includes('2026-08-27'));assert.ok(csv.includes('Confirm whether this was an arm’s-length sale'));
 assert.ok(!csv.includes('650000'));assert.equal(csv.split('\r\n').filter(Boolean).length,3);
});
