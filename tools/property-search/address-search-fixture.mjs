export async function seedAddressSearch(db) {
  const addresses = ['1800 W 36 ST', '1800 E 36 ST', '1801 W 36 ST', '1800 W 37 ST', '1800 W 136 ST', '1800 W 36 AVE', '1800 W 36', '1800 36 ST', '300 TESTING', '300 TESTING AVE', '700 PAW PRINT DR UNIT 2', '700 PAW PRINT DR UNIT 3', '701 PAW PRINT DR UNIT 2', '36 W SAMPLE ST', '1104 ALDER ST', '1104 BIRCH ST', '1104 CEDAR ST', '1104 DOGWOOD ST', '1104 ELM ST', '1104 FIR ST', '1104 GARDEN ST', '1104 HICKORY ST', '1104 IVY ST', '1221 W BEN WHITE BLVD UNIT 36'];
  for (const [i,address] of addresses.entries()) {
    await db.query(`insert into public.property_search_documents
      select (jsonb_populate_record(null::public.property_search_documents,to_jsonb(d)||jsonb_build_object(
       'property_id',$1::text,'address',$2::text,'search_text',public.normalize_property_address($2::text||' FIXTURE CITY 78700')))).*
      from public.property_search_documents d where property_id='100'`, [String(990000+i),address]);
  }
  await db.query(`insert into public.property_search_documents
    select (jsonb_populate_record(null::public.property_search_documents,to_jsonb(d)||jsonb_build_object(
     'property_id','990024','address','1800 E 36 ST','city','WEST LAKE HILLS',
     'search_text',public.normalize_property_address('1800 E 36 ST WEST LAKE HILLS 78746')))).*
    from public.property_search_documents d where property_id='100'`);
}
