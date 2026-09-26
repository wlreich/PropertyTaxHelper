import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMarketAdjustment} from '../src/lib/market-adjustments.ts';
import {parseProperty} from '../src/lib/supabase/properties.ts';
import {buildPropertyReport,reportRowParts} from '../src/lib/property-report.ts';
import {parseHistory,parseProtestObservations} from '../src/lib/property-history.ts';
import {par28Fixture} from '../../tools/property-search/par28-fixture.mjs';
const input=id=>{const r=par28Fixture(id),p=parseProperty(r.overview.profile,id);assert.equal(p.status,'ok');return {property:p.data,snapshots:parseHistory(r.overview.history),protests:parseProtestObservations(r.overview.history),adjustment:parseMarketAdjustment(r.adjustment),reportDate:'2026-09-21'};};
const rows=r=>r.sections.flatMap(s=>s.blocks.flatMap(b=>b.kind==='table'?b.rows:[]));
const blocks=(r,id)=>r.sections.find(s=>s.id===id).blocks;
const reportTable=(r,title)=>r.sections.flatMap(s=>s.blocks).find(b=>b.kind==='table'&&b.title===title);
const reportTrend=r=>r.sections.flatMap(s=>s.blocks).find(b=>b.kind==='trend');
test('recorded favorable outcome, no-agent evidence, cap labels and annual review links match the approved print story',()=>{
 const r=buildPropertyReport(input('999283')),text=JSON.stringify(r);assert.equal(r.releaseLabel,'2026 certified');
 for(const token of ['$950,000','$200,000','−$50,000','$1,045,000','+$120,000','2025 interim snapshot','Not proof of physical removal'])assert.ok(text.includes(token),token);
 const opening=blocks(r,'summary')[0];assert.equal(opening.title,'Protest recorded. Value reduced 20.8% from your preliminary appraisal.');assert.equal(opening.positive,true);
 assert.equal(opening.text,'Your 2026 certified market value is 5.6% higher than in 2025.');assert.doesNotMatch(opening.text,/proposed|preliminary/);
 assert.match(text,/Protest recorded - Agent not identified\. This may indicate that the homeowner protested without an agent\./);
 assert.doesNotMatch(text,/No agent identified in available records|A recorded protest and a reduction do not establish causation/);
 const outcome=reportTable(r,'From proposal to final assessment');
 assert.deepEqual(outcome.rows.map(x=>x.cells),[
  ['Preliminary market value','$1,200,000'],['Preliminary-to-final market value change','−$250,000'],['Final market value','$950,000'],['Preliminary cap exclusion','$200,000'],['Preliminary capped assessed value','$1,000,000'],['Change in assessed value versus that capped amount','−$50,000'],['Final assessed value','$950,000'],
 ]);
 assert.equal(text.match(/If your home qualified for a homestead exemption last year and this year/g)?.length,1);
 const review=blocks(r,'review').find(b=>b.kind==='note'&&b.title==='Useful things to check');
 assert.match(review.text,/Each year, check the deadline on your appraisal notice/);assert.deepEqual(review.links.map(x=>x.href),['https://parcelsavvy.org/protest-guide','https://traviscad.org/protests']);
 assert.equal(rows(r).filter(x=>x.id.startsWith('feature-')&&!x.id.startsWith('feature-change-')).length,11);
 assert.equal(rows(r).filter(x=>x.id.startsWith('history-')).length,2);
 assert.equal(rows(r).filter(x=>x.id.startsWith('authority-')).length,5);
 const missing=buildPropertyReport({...input('999283'),release:'missing'});assert.equal(missing,null);
 const prior=buildPropertyReport({...input('999283'),release:input('999283').snapshots.find(s=>s.tax_year===2025&&s.roll_stage==='certified').dataset_id});assert.equal(prior.year,2025);assert.equal(rows(prior).filter(x=>x.id.startsWith('history-')).length,1);
});
test('dense inventory and all available years survive without clipping or a five-year limit',()=>{
 const dense=buildPropertyReport(input('999280')),long=buildPropertyReport(input('999281'));
 assert.equal(rows(dense).filter(x=>/^feature-\d/.test(x.id)).length,26);
 const history=rows(long).filter(x=>x.id.startsWith('history-'));assert.equal(history.length,26);assert.equal(new Set(history.map(x=>x.id)).size,26);assert.ok(!history.some(x=>x.id==='history-2010'));
 assert.equal(history.find(x=>x.id==='history-2018').cells[1],'Unavailable');
 const pieces=reportRowParts({id:'long',cells:['L'.repeat(1600),'$1'],note:'N'.repeat(3000)});
 assert.ok(pieces.length>1);assert.ok(pieces.every(p=>p.cells[0].length<=240));assert.equal(pieces.map(p=>p.cells[0]).join(''),'L'.repeat(1600));assert.equal(pieces.map(p=>p.note??'').join(''),'N'.repeat(3000));
});
test('print keeps inferred and unavailable protest evidence distinct from recorded favorable evidence',()=>{
 const inferred=buildPropertyReport({...input('999283'),protests:[]}),inferredText=JSON.stringify(inferred);
 assert.match(inferredText,/Reduction evidence suggests a possible protest; no protest record found/);assert.doesNotMatch(inferredText,/Protest recorded\. Value reduced/);
 const unavailable=buildPropertyReport({...input('999283'),protests:[],protestsUnavailable:true}),unavailableText=JSON.stringify(unavailable);
 assert.match(unavailableText,/protest records temporarily unavailable/);assert.doesNotMatch(unavailableText,/homeowner protested without an agent/);
});
test('cap outcome separates the market reduction from assessed change and preserves the still-capped branch',()=>{
 const paw=input('999283');
 paw.snapshots=paw.snapshots.map(s=>s.tax_year===2026&&s.roll_stage==='preliminary'?{...s,market_value:1611803,assessed_value:1353650}:s.tax_year===2026&&s.roll_stage==='certified'?{...s,market_value:1285275,assessed_value:1285275}:s);
 const report=buildPropertyReport(paw),outcome=reportTable(report,'From proposal to final assessment');
 assert.equal(outcome.rows.find(x=>x.id==='market-change').cells[1],'−$326,528');
 assert.equal(outcome.rows.find(x=>x.id==='assessed-change').cells[1],'−$68,375');
 assert.equal(outcome.rows.find(x=>x.id==='proposed-assessed').cells[1],'$1,353,650');
 const outlook=blocks(report,'summary').find(b=>b.kind==='note'&&b.title==='A lower starting point for next year');
 assert.match(outlook.text,/final assessed value is \$68,375 below the capped amount on your preliminary appraisal/);
 const still=input('999283');still.snapshots=still.snapshots.map(s=>s.tax_year===2026&&s.roll_stage==='preliminary'?{...s,market_value:1611803,assessed_value:1353650}:s.tax_year===2026&&s.roll_stage==='certified'?{...s,market_value:1500000,assessed_value:1353650}:s);
 const stillText=JSON.stringify(buildPropertyReport(still));assert.match(stillText,/market value fell, but your assessed value did not change/);assert.doesNotMatch(stillText,/That lower value becomes the starting point/);
});
test('certified report uses the strict preliminary pair, labels the final outcome separately and withholds unsupported estimates',()=>{
 const supported=buildPropertyReport(input('999283'));
 const preliminary=reportTable(supported,'2026 preliminary compared with 2025 preliminary');
 assert.deepEqual(preliminary.rows.map(x=>x.cells),[
  ['Land','$200,000','$200,000','$0'],['Home & other features','$800,000','$1,000,000','+$200,000'],['Total preliminary market value','$1,000,000','$1,200,000','+$200,000'],
 ]);
 assert.ok(reportTable(supported,'Final annual outcome: 2026 certified compared with 2025 certified'));
 const multiplier=reportTable(supported,'Market-area multiplier: same 2026 building inputs');assert.equal(multiplier.rows.at(-1).cells.at(-1),'+$120,000');
 const old=input('999283');old.snapshots=old.snapshots.map(s=>s.roll_stage==='preliminary'?{...s,preliminary_baseline_eligible:undefined}:s);
 const oldReport=buildPropertyReport(old),oldText=JSON.stringify(oldReport);assert.equal(reportTable(oldReport,'2026 preliminary compared with 2025 preliminary'),undefined);assert.match(oldText,/not confirmed for both 2025 and 2026/);
 const missing=input('999283');missing.adjustment={...missing.adjustment,homes:missing.adjustment.homes.map(h=>({...h,status:'does_not_reconcile',effect:null}))};
 const missingReport=buildPropertyReport(missing),missingText=JSON.stringify(missingReport);assert.equal(reportTable(missingReport,'Market-area multiplier: same 2026 building inputs'),undefined);assert.match(missingText,/Isolated multiplier effect unavailable: Components do not reproduce/);assert.doesNotMatch(missingText,/fabricated bars/);
});
test('annual history prints proposed, final and assessed stages without substituting excluded or missing values',()=>{
 const report=buildPropertyReport(input('999281')),history=reportTable(report,'Proposed market value → Final market value → Assessed value'),trend=reportTrend(report);
 assert.deepEqual(history.columns,['Year / result','Proposed market value','Final market value','Assessed value']);
 assert.equal(history.rows.find(x=>x.id==='history-2026').cells[1],'$889,000');
 assert.equal(history.rows.find(x=>x.id==='history-2018').cells[1],'Unavailable');
 assert.equal(history.rows.find(x=>x.id==='history-2009').cells[1],'Unavailable');
 assert.match(history.rows.find(x=>x.id==='history-2009').note,/eligible proposed value is unavailable/);
 assert.equal(trend.totalYears,26);assert.equal(trend.rows.length,5);assert.deepEqual(trend.rows.map(x=>x.year),[2022,2023,2024,2025,2026]);
 assert.equal(trend.rows.at(-1).stages.find(x=>x.kind==='proposed').display,'$889,000');
 assert.equal(trend.rows.at(-1).stages.find(x=>x.kind==='final').display,'$864,000');
 const protestOnly=input('999281');protestOnly.snapshots=protestOnly.snapshots.filter(s=>s.tax_year!==2024);
 const evidence={dataset_id:'protest-only-2024',tax_year:2024,export_date:'2024-05-01',export_time_raw:'2024-05-01 08:00:00',protest_flag:true,arb_case_listed:false,arb_agent_listed:false,arb_agent_name:null,arb_status_codes:[]};
 const filteredTrend=reportTrend(buildPropertyReport({...protestOnly,protests:[evidence]}));assert.equal(filteredTrend.totalYears,25);assert.deepEqual(filteredTrend.rows.map(x=>x.year),[2021,2022,2023,2025,2026]);
});
test('print progression preserves eligible preliminary, certified-only, supplemental and unknown-eligibility states',()=>{
 const eligible=input('999282');eligible.snapshots=eligible.snapshots.map(s=>({...s,preliminary_baseline_eligible:true}));
 const eligibleTrend=reportTrend(buildPropertyReport(eligible));assert.equal(eligibleTrend.rows[0].status,'Preliminary only');
 assert.deepEqual(eligibleTrend.rows[0].stages.map(x=>x.display),['$425,000','Pending','Pending']);
 const unknown=buildPropertyReport(input('999282')),unknownTrend=reportTrend(unknown),unknownTable=reportTable(unknown,'Proposed market value → Final market value → Assessed value');
 assert.deepEqual(unknownTrend.rows[0].stages.map(x=>x.display),['Unavailable','Pending','Pending']);assert.deepEqual(unknownTable.rows[0].cells.slice(1),['Unavailable','Unavailable','Unavailable']);
 const certifiedOnly=input('999283');certifiedOnly.snapshots=certifiedOnly.snapshots.filter(s=>s.roll_stage!=='preliminary');
 const certifiedTrend=reportTrend(buildPropertyReport(certifiedOnly));assert.equal(certifiedTrend.rows.at(-1).status,'Certified');assert.deepEqual(certifiedTrend.rows.at(-1).stages.map(x=>x.display),['Unavailable','$950,000','$950,000']);
 const supplemental=input('999283');supplemental.snapshots=supplemental.snapshots.map(s=>s.tax_year===2026&&s.roll_stage==='certified'?{...s,roll_stage:'supplemental'}:s);
 const supplementalTrend=reportTrend(buildPropertyReport(supplemental));assert.equal(supplementalTrend.rows.at(-1).status,'Supplemental');assert.deepEqual(supplementalTrend.rows.at(-1).stages.map(x=>x.display),['$1,200,000','$950,000','$950,000']);
 const historicalPreliminary=input('999283');historicalPreliminary.snapshots=historicalPreliminary.snapshots.filter(s=>!(s.tax_year===2025&&s.roll_stage!=='preliminary'));
 const historicalReport=buildPropertyReport(historicalPreliminary),historicalTrend=reportTrend(historicalReport),historicalRow=reportTable(historicalReport,'Proposed market value → Final market value → Assessed value').rows.find(x=>x.id==='history-2025');
 assert.deepEqual(historicalTrend.rows.find(x=>x.year===2025).stages.map(x=>x.display),['$1,000,000','Unavailable','Unavailable']);assert.match(historicalRow.note,/Final market value and assessed value are unavailable/);assert.doesNotMatch(historicalRow.note,/pending/);
});
test('sparse and withheld records never acquire a certified outcome, cap ceiling or neighborhood median',()=>{
 const sparse=buildPropertyReport(input('999282'));assert.ok(sparse.compact);assert.equal(sparse.stage,'preliminary');assert.doesNotMatch(JSON.stringify(sparse),/Conditional 10% ceiling/);
 const compactReview=blocks(sparse,'review').find(b=>b.kind==='note'&&b.title==='Items to review');assert.match(compactReview.text,/Each year, check the deadline/);assert.equal(compactReview.links.length,2);
 const i=input('999283');i.property.values_under_review=true;i.property.market_value=null;i.property.assessed_value=null;i.property.land_value=null;i.property.improvement_value=null;
 const r=buildPropertyReport(i);assert.ok(JSON.stringify(r).includes('Values need further review'));assert.ok(!JSON.stringify(r).includes('$950,000'));
 assert.equal(buildPropertyReport({...i,release:i.snapshots[0].dataset_id}),null);
});

test('historical reports exclude later-year and later-release protest observations',()=>{
 const i=input('999283'),prior=i.snapshots.find(s=>s.tax_year===2025&&s.roll_stage==='certified');
 const observation={dataset_id:'future-protest',tax_year:2025,export_date:'2025-12-31',export_time_raw:null,protest_flag:true,arb_case_listed:false,arb_agent_listed:true,arb_agent_name:'Future-only agent',arb_status_codes:[]};
 const baseline=buildPropertyReport({...i,release:prior.dataset_id,protests:[]});
 const actual=buildPropertyReport({...i,release:prior.dataset_id,protests:[observation,{...observation,dataset_id:'next-year',tax_year:2026}]});
 assert.deepEqual(actual,baseline);
});

test('selected preliminary reports exclude same-day later completed releases',()=>{
 const i=input('999282'),preliminary=i.snapshots[0];
 preliminary.export_date='2026-04-02';preliminary.export_time_raw='2026-04-02 08:00:00';
 i.snapshots.push({...preliminary,dataset_id:'same-day-later-final',roll_stage:'certified',export_time_raw:'2026-04-02 12:00:00',market_value:400000,assessed_value:390000});
 i.snapshots.push({...preliminary,dataset_id:'unknown-order-final',roll_stage:'certified',export_date:null,export_time_raw:null,market_value:410000,assessed_value:395000});
 i.snapshots.push({...preliminary,dataset_id:'date-only-final',roll_stage:'certified',export_time_raw:null,market_value:420000,assessed_value:405000});
 const ambiguousEvidence={dataset_id:'date-only-protest',tax_year:2026,export_date:'2026-04-02',export_time_raw:null,protest_flag:true,arb_case_listed:false,arb_agent_listed:true,arb_agent_name:'Ambiguous same-day agent',arb_status_codes:[]};
 const report=buildPropertyReport({...i,release:preliminary.dataset_id,protests:[ambiguousEvidence]}),history=reportTable(report,'Proposed market value → Final market value → Assessed value'),trend=reportTrend(report);
 assert.equal(report.stage,'preliminary');assert.equal(history.rows[0].cells[2],'Unavailable');assert.equal(history.rows[0].cells[3],'Unavailable');
 assert.deepEqual(trend.rows[0].stages.map(x=>x.display),['Unavailable','Pending','Pending']);assert.doesNotMatch(JSON.stringify(report),/\$400,000|\$390,000|\$410,000|\$395,000|\$420,000|\$405,000|Ambiguous same-day agent/);
});

test('protest-only history retains its exact row without rendering an empty trend',()=>{
 const i=input('999282');i.snapshots=[];
 const evidence={dataset_id:'protest-only',tax_year:2025,export_date:'2025-05-01',export_time_raw:'2025-05-01 08:00:00',protest_flag:true,arb_case_listed:false,arb_agent_listed:false,arb_agent_name:null,arb_status_codes:[]};
 const report=buildPropertyReport({...i,protests:[evidence]}),history=reportTable(report,'Proposed market value → Final market value → Assessed value');
 assert.equal(history.rows[0].cells[0],'2025 · Protest records only');assert.equal(reportTrend(report),undefined);
});

test('selected completed reports retain same-day earlier proposals and exclude later prior-year evidence',()=>{
 const i=input('999282'),preliminary=i.snapshots[0];
 preliminary.preliminary_baseline_eligible=true;preliminary.export_date='2026-04-02';preliminary.export_time_raw='2026-04-02 08:00:00';
 const completed={...preliminary,dataset_id:'same-day-final',roll_stage:'certified',export_time_raw:'2026-04-02 12:00:00',market_value:400000,assessed_value:390000};i.snapshots.push(completed);
 const futurePriorYear={dataset_id:'future-prior-year-protest',tax_year:2025,export_date:'2026-12-01',export_time_raw:'2026-12-01 08:00:00',protest_flag:true,arb_case_listed:false,arb_agent_listed:true,arb_agent_name:'Future-only agent',arb_status_codes:[]};
 const report=buildPropertyReport({...i,release:completed.dataset_id,protests:[futurePriorYear]}),history=reportTable(report,'Proposed market value → Final market value → Assessed value'),trend=reportTrend(report);
 assert.deepEqual(history.rows[0].cells.slice(1),['$425,000','$400,000','$390,000']);assert.deepEqual(trend.rows[0].stages.map(x=>x.display),['$425,000','$400,000','$390,000']);
 assert.doesNotMatch(JSON.stringify(report),/Future-only agent|future-prior-year-protest/);
});
