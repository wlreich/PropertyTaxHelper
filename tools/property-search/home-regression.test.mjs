import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureDatabase } from './projection.test.mjs';
import { seedHomeRegression } from './home-regression-fixture.mjs';
import { searchAddressQuery } from '../../web/src/lib/property-search.ts';

test('PAR-5: normalized input returns only eligible matches through both actual SQL functions', async () => {
  const db = await fixtureDatabase();
  try {
    await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
    await seedHomeRegression(db);
    await db.exec('set role anon');
    const result = async (q, suggestions = false) => (await db.query(
      suggestions ? 'select public.suggest_property_parcels($1,8,false) result' : 'select public.search_property_parcels_v2($1,0,false) result',
      [searchAddressQuery(q)],
    )).rows[0].result;
    for (const q of [
      '1104 Paw Print', '1104 Paw Print,', '1104 Paw Print Leander',
      '1104 Paw Print 78641', '1104 Paw Print Leander 78641',
      '1104 Paw Print, Leander, TX 78641', '1104 Paw Print Leander TX',
      '1104 Paw Print Leander Texas', '1104 Paw Print, Leander, Texas 78641', '736302',
    ]) for (const suggestions of [false, true]) {
      assert.deepEqual((await result(q, suggestions)).items.map(x=>x.property_id), ['736302'], `${q}: suggestions=${suggestions}`);
    }
    for (const q of ['1104 Paw Print, Houston, TX 77001', '1104 Paw Print Leander TX 99999', '1104 Paw Print Leander CA 78641', '1105 Paw Print Leander TX', '999999999']) {
      for (const suggestions of [false, true]) assert.deepEqual((await result(q,suggestions)).items, [], q);
    }
    for (const q of ['1905 West 36th Street Unit B', '1905 W 36 St #B']) {
      assert.deepEqual((await result(q)).items.map(x=>x.property_id), ['799047']);
    }
    const typo=await result('1104 Paw Prnit');
    assert.equal(typo.match_mode, 'possible');
    assert.deepEqual(typo.items.map(x=>x.property_id), ['736302']);
    assert.deepEqual((await result('123 Texas St')).items.map(x=>x.property_id), ['990100']);
  } finally { await db.close(); }
});

// PAR-37 runs the real publisher and RPCs, not prefiltered browser responses.
import {readFile} from 'node:fs/promises';
import {seedResidentialSource} from './residential-search-fixture.mjs';
test('PAR-37 source-backed vacancy regression fails before the fix and passes after; limits, fallback and direct IDs stay consistent', async()=>{
 for(const beforeVacantLots of [true,false]){
  const db=await fixtureDatabase({beforeVacantLots,parklandFixtures:true});
  try{
   await seedResidentialSource(db);
   await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
   const candidate='22222222-2222-4222-8222-222222222222';
   await db.query("insert into parcel_admin.preparations(id,source_dataset,expected_active) values($1,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111')",[candidate]);
   await db.query("select tcad_ingest.prepare_property_search('11111111-1111-4111-8111-111111111111',$1)",[candidate]);
   await db.exec('set role anon');
   const run=async(q,suggest=false,page=0,all=false)=>(await db.query(suggest?'select public.suggest_property_parcels($1,$2,$3) result':'select public.search_property_parcels_v2($1,$2,$3) result',[q,suggest?8:page,all])).rows[0].result;
   const ids=x=>x.items.map(i=>i.property_id);
   const suggestion=ids(await run('high lonesome',true));
   if(beforeVacantLots){
    assert.ok(suggestion.includes('736081'),'original defect reproduced');
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../../supabase/migrations/20260921023946_residential_discovery_vacant_lots.sql',import.meta.url),'utf8'));
    await db.exec('set role anon');
   }
   await db.exec('reset role');
   const classified=async()=>(await db.query("select is_vacant_land from public.property_search_documents where dataset_id=$1 and property_id='736081'",[candidate])).rows[0].is_vacant_land;
   assert.equal(await classified(),true,'pre-existing candidate receives the vacancy backfill');
   await db.query("select tcad_ingest.prepare_property_search('11111111-1111-4111-8111-111111111111',$1)",[candidate]);
   assert.equal(await classified(),true,'future preparations retain the classification');
   await db.query('update public.property_search_state set dataset_id=$1',[candidate]);
   await db.exec('set role anon');
   for(const suggest of [true,false]){
    const highLonesome=ids(await run('high lonesome',suggest));
    if(suggest) assert.deepEqual(highLonesome,['736083','736086']);
    else assert.deepEqual(new Set(highLonesome),new Set(['736083','736086']));
    assert.deepEqual(ids(await run('1402 High Lonesome',suggest)),['736086']);
    assert.deepEqual(ids(await run('000736081',suggest)),['736081'],'exact ID remains available');
    assert.equal((await run('VACANTONLY',suggest)).items.length,0);
    assert.equal((await run('VACANTONLY',suggest,0,true)).items.length,0,'parkland toggle does not change vacancy policy');
    assert.equal((await run('SPARSE HOME',suggest)).items.length,6,'residential and unknown sparse records stay');
    const page=await run('LIMITDEMO',suggest);assert.equal(page.items.length,suggest?8:20);
    assert.ok(ids(page).every(id=>id.startsWith('975')),'excluded matches cannot consume limit');
    assert.deepEqual(ids(page),Array.from({length:suggest?8:20},(_,i)=>String(975000+i)));
   }
   assert.equal((await run('LIMITDEMO',false,1)).items.length,5);
   assert.equal((await run('LIMITDEMO',false,1)).has_more,false);
   assert.equal((await run('LIMITDEMO',false,2)).items.length,0);
   for(const q of ['high lonesmoe','1402 high lonesmoe']){
    const result=await run(q);assert.equal(result.match_mode,'possible');assert.ok(!ids(result).includes('736081'));assert.ok(ids(result).includes('736086'));
   }
   assert.equal((await run('VACANTONYL')).items.length,0,'fuzzy fallback cannot revive vacant lots');
   const parks=await run('PARKDEMO');assert.ok(!ids(parks).includes('505'));assert.ok(ids(parks).includes('500'),'nominal price alone remains eligible');
   assert.ok((await db.query("select public.property_profile('736081') result")).rows[0].result,'direct detail still available');
  }finally{await db.close();}
 }
});
