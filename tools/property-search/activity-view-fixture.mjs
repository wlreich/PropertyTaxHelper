// Synthetic activity for browser and export checks. No homeowner source records.
export function activityViewFixture(id='100',requested=null){
 if(id==='9205'||!['100','120','121','9200','9201','9202','9203','9204','9290'].includes(id))return {status:'unavailable'};
 const year=requested===null?2026:Number(requested);if(![2026,2025].includes(year))return {status:'unavailable'};
 const base=(pid,key,day,extra={})=>({property_id:pid,event_key:key,address:pid+' CYPRESS ST',city:'FIXTURE CITY',property_type:'single_family',deed_date:year+'-'+day,sale_date:null,activity_date:year+'-'+day,filed_date:null,instrument:'SYNTHETIC-'+key,deed_type:'WD',sale_type:null,sale_source:null,status:'deed_change',price:null,price_status:'not_reported',match_method:null,deed_source:'supplemental',...extra});
 const rows=[
  base('100','j:1','06-27'),
  base('120','s:2','06-20',{sale_date:year+'-06-20',status:'sale_recorded',price:650000,price_status:'reported',match_method:'deed_id'}),
  base('121','s:3','06-15',{deed_date:null,deed_source:null,sale_date:year+'-06-15',status:'sale_recorded'}),
  base('122','s:4','06-10',{sale_date:year+'-06-10',status:'sale_recorded',price_status:'multi_property'}),
  base('101','j:5','06-05',{property_type:'land'}),
  base('100','j:6','05-27'),
  base('123','j:7','05-25',{property_type:'other',address:'123 VERY LONG SYNTHETIC CYPRESS RIDGE NEIGHBORHOOD STREET'})
 ];
 return {status:'ok',year,years:[2026,2025],neighborhood:'T2450',sources:{appraisal_export_date:'2026-07-18',sales_export_date:'2026-08-27'},rows:id==='9290'?Array.from({length:24},(_,i)=>base(String(9400+i),'j:long'+i,'06-'+String(i+1).padStart(2,'0'),{address:String(9400+i)+' VERY LONG SYNTHETIC CYPRESS RIDGE NEIGHBORHOOD STREET NORTHWEST UNIT '+i})):id==='9204'?[]:year===2025?rows.slice(0,id==='120'?2:1):rows};
}
