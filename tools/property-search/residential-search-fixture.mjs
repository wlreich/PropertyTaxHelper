// Sanitized classification fields verified against the 2026 certified TCAD source.
// No owner, contact, or confidential source fields are copied into this fixture.
export async function seedResidentialSource(db) {
 const dataset='11111111-1111-4111-8111-111111111111';
 const base=(await db.query("select fields from tcad_ingest.records where member_name='0.txt' and prop_id='000100' limit 1")).rows[0].fields;
 const rows=[
  ['736081','', 'HIGH LONESOME','C1',null,'660',false],
  ['736083','', 'HIGH LONESOME','A1','A1','1520591',true],
  ['736086','1402','HIGH LONESOME','A1','A1','2088414',true],
  // Missing descriptive/valuation fields do not establish ineligibility.
  ['973001','', 'SPARSE HOME','A2',null,null,false],
  ['973002','', 'SPARSE HOME','A4',null,'0',false],
  ['973003','', 'SPARSE HOME','B2',null,'35',false],
  ['973004','', 'SPARSE HOME',null,null,null,false],
  ['973005','', 'SPARSE HOME','UNKNOWN',null,'0',false],
  // Contradictory improvement evidence keeps a C1 record discoverable.
  ['973006','', 'SPARSE HOME','C1',null,'100',true],
  ...Array.from({length:25},(_,i)=>[String(974000+i),'','LIMITDEMO','C1',null,'660',false]),
  ...Array.from({length:25},(_,i)=>[String(975000+i),String(100+i),'LIMITDEMO','A1',null,'0',false]),
  ['976000','100','VACANTONLY','C1',null,'500000',false],
 ];
 let row=10000,child=10000;
 for (const [id,num,street,land,improvement,market,hasChild] of rows) {
  await db.query("insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,'0.txt',$2,$3,'02026',$4)",[dataset,++row,id,{...base,situs_num:num,situs_street_prefx:'',situs_street:street,situs_street_suffix:'',situs_city:'',situs_zip:'78641',land_state_cd:land,imprv_state_cd:improvement,market_value:market,assessed_val:'0'}]);
  if(hasChild)await db.query("insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,'1.txt',$2,$3,'02026',$4)",[dataset,++child,id,{imprv_state_cd:'A1',imprv_type_cd:'01',imprv_type_desc:'1 FAM DWELLING'}]);
 }
}
