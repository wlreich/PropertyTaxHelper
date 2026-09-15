export async function seedNeighborhood(db) {
 const anchor='11111111-1111-4111-8111-111111111111',pre='33333333-3333-4333-8333-333333333333';
 await db.query(`insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,completed_at)
 select $1,repeat('f',64),layout_sha256,parser_version,source_encoding,2026,'preliminary',source_url,archive_location,header,status,completed_at from tcad_ingest.datasets where id=$2`,[pre,anchor]);
  await db.query(`insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status) values($1,'PROP.TXT','Property',0,repeat('f',64),'complete')`,[pre]);
 let row=0;
 for(const [id,market,assessed,hs,qualify] of [['100',600000,500000,'T',2015],['120',500000,400000,'T',2015],['121',450000,450000,'T',2015],['102',700000,550000,'T',2015],['103',700000,550000,'T',2015]]) {
  await db.query(`insert into public.property_snapshot_profiles select anchor_dataset_id,$1::uuid,property_id,snapshot||jsonb_build_object('dataset_id',$1::text,'tax_year',2026,'roll_stage','preliminary','export_date','2026-04-02','market_value',$3::numeric,'assessed_value',$4::numeric,'protest_flag',false,'arb_case_listed',false) from public.property_snapshot_profiles where anchor_dataset_id=$2 and dataset_id=$2 and property_id=$5`,[pre,anchor,market,assessed,id]);
  await db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,'PROP.TXT',$2,$3,'2026',$4)`,[pre,++row,id,{hs_exempt:hs,hs_qualify_yr:String(qualify),market_value:String(market),appraised_val:String(market),assessed_val:String(assessed),ten_percent_cap:String(market-assessed),nhs_cap_loss:'0',abs_subdv_cd:'GRAND02',owner_name:'PRIVATE CAP SOURCE'}]);
 }
 for(const source of [anchor,pre])await db.query(`insert into public.property_protest_observations(anchor_dataset_id,dataset_id,property_id,tax_year,export_date,protest_flag,arb_case_listed,arb_agent_listed) values($1,$2,'100',2026,'2026-06-01',true,true,false)`,[anchor,source]);
 // A separate protest snapshot survives clean preliminary/certified snapshots.
 const protest='44444444-4444-4444-8444-444444444444';
 await db.query(`insert into public.property_protest_observations(anchor_dataset_id,dataset_id,property_id,tax_year,export_date,protest_flag,arb_case_listed,arb_agent_listed) values($1,$2,'120',2026,'2026-04-29',true,false,false)`,[anchor,protest]);
 await db.query(`insert into public.property_protest_observations(anchor_dataset_id,dataset_id,property_id,tax_year,export_date,protest_flag,arb_case_listed,arb_agent_listed) values($1,$2,'121',2026,'2026-04-29',false,false,true)`,[anchor,protest]);
 // Authorities can cross neighborhood boundaries; records deduplicate per property.
 await db.query(`update public.property_snapshot_profiles set snapshot=snapshot||jsonb_build_object('entities',jsonb_build_array(jsonb_build_object('code','03','name','Travis County'),jsonb_build_object('code',case when property_id='120' then '70' else '69' end,'name',case when property_id='120' then 'Other ISD' else 'Leander ISD' end))) where anchor_dataset_id=$1`,[anchor]);
 // Release-specific type sources; intentionally separate from private cap facts.
 for(const source of [anchor,pre,'22222222-2222-4222-8222-222222222222']) {
  await db.query(`insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status) values($1,'neighborhood-types.txt','Property',0,repeat('9',64),'complete')`,[source]);
  await db.query(`insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status) values($1,'ABS_SUBD.TXT','AbstractSubdivision',0,repeat('8',64),'complete')`,[source]);
  await db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,fields) values($1,'ABS_SUBD.TXT',1,$2)`,[source,{abs_subdv_cd:'GRAND02',abs_subdv_desc:'GRAND MESA SECTION II'}]);
  let typeRow=0;
  for(const id of ['100','101','120','121','122','123','102','103'].filter(id=>source!==pre||!['100','120','121','102','103'].includes(id)))
   await db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,'neighborhood-types.txt',$2,$3,$4,$5)`,[source,++typeRow,id,source.startsWith('2222')?'2025':'2026',{imprv_state_cd:'A1',land_state_cd:'A1',abs_subdv_cd:'GRAND02',owner_name:'PRIVATE TYPE SOURCE'}]);
 }
 // All Property rows for a fixture agree on type. Duplicates remain harmless.
 await db.exec(`update tcad_ingest.records set fields=fields||'{"imprv_state_cd":"A1","land_state_cd":"A1"}'::jsonb where member_name in ('0.txt','PROP.TXT')`);
 return {anchor,pre};
}
