export async function seedComparisons(db) {
 const anchor='11111111-1111-4111-8111-111111111111';
 const old='22222222-2222-4222-8222-222222222222';
 const snapshot=(area,year,value,source=anchor)=>({dataset_id:source,tax_year:source===anchor?2026:2025,roll_stage:'certified',export_date:source===anchor?'2026-07-18':'2025-07-19',export_time_raw:source===anchor?'07/18/2026 16:27':'07/19/2025',market_value:value,land_value:100000,land_acres:.25,neighborhood:'T2450',components:[{id:'1',improvement_id:'1',code:'1ST',area,class_code:'R3',year_built:year,value:350000}]});
 // Safe synthetic search documents created from an already-public fixture.
 for(const [id,address,area,year,value] of [['120','120 CYPRESS ST',2000,2014,400000],['121','121 CYPRESS ST',2010,2015,460000],['122','122 CYPRESS ST',2080,2016,480000],['123','123 PINE ST',2400,2000,null]]) {
  await db.query(`insert into public.property_search_documents select dataset_id,$2,$3,city,postal_code,property_type,public.normalize_property_address($3),$4,appraised_value,assessed_value,land_value,improvement_value,land_acres,source_record_count,values_under_review,shared_ownership,improvement_records,land_segments,is_parkland from public.property_search_documents where dataset_id=$1 and property_id='101'`,[anchor,id,address,value]);
  await db.query('insert into public.property_snapshot_profiles values($1,$2,$3,$4)',[anchor,anchor,id,snapshot(area,year,value)]);
 }
 for(const id of ['100','101','102','103']) {
  await db.query('insert into public.property_snapshot_profiles values($1,$2,$3,$4)',[anchor,anchor,id,snapshot(id==='100'?2000:2100,2014,450000)]);
 }
 await db.query('insert into public.property_snapshot_profiles values($1,$2,$3,$4)',[anchor,old,'100',snapshot(2000,2014,420000,old)]);
 await db.query('insert into public.property_snapshot_profiles values($1,$2,$3,$4)',[anchor,old,'120',snapshot(2000,2014,390000,old)]);
 // Synthetic costs remain private; the RPC returns an explicit field allowlist.
 await db.query(`insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,completed_at) select $1,repeat('d',64),layout_sha256,parser_version,source_encoding,2025,roll_stage,source_url,archive_location,header,status,completed_at from tcad_ingest.datasets where id=$2`,[old,anchor]);
 for(const source of [anchor,old]) {
  for(const [member,type] of [['cost-buildings.txt','Improvement'],['cost-details.txt','ImprovementDetail']])
   await db.query(`insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status) values($1,$2,$3,0,repeat('e',64),'complete')`,[source,member,type]);
  let row=0;
  for(const [id,area,year] of [['100',2000,2014],['120',2000,2014],['121',2010,2015],['122',2080,2016],['123',2400,2000],['102',2000,2014],['103',2000,2014]]) {
   const values=[['cost-buildings.txt',{imprv_id:'1',imprv_val:'350000',imprv_type_cd:'01',imprv_state_cd:'A1',owner_name:'PRIVATE MUST NOT LEAK'}],['cost-details.txt',{imprv_id:'1',imprv_det_id:'1',imprv_det_val:'350000',imprv_det_area:String(area),imprv_det_class_cd:'R3',yr_built:String(year),depreciation_yr:String(year),imprv_det_type_cd:'1ST',imprv_det_type_desc:'Main area'}]];
   for(const [member,fields] of values) await db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,$2,$3,$4,$5,$6)`,[source,member,++row,id,source===anchor?'2026':'2025',fields]);
  }
 }
 return {anchor,old};
}
