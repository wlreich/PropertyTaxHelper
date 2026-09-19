// Public address/ID cases from PAR-5/6; all financial inputs are synthetic.
export async function seedHomeRegression(db) {
  const records = [
    ['736302', '1104 PAW PRINT', 'LEANDER', '78641'],
    ['736303', '1102 PAW PRINT', '', '78641'],
    ['799047', '1905 W 36 ST UNIT B', 'AUSTIN', '78731'],
    ['990100', '123 TEXAS ST', 'AUSTIN', '78701'],
    ...Array.from({ length: 25 }, (_, i) => [String(991000+i), `${100+i} HOMEFIXTURE ST`, 'AUSTIN', '78701']),
  ];
  for (const [id,address,city,zip] of records) {
    await db.query(`insert into public.property_search_documents
      select (jsonb_populate_record(null::public.property_search_documents,to_jsonb(d)||jsonb_build_object(
        'property_id',$1::text,'address',$2::text,'city',$3::text,'postal_code',$4::text,
        'search_text',public.normalize_property_address($2::text||' '||$3::text||' '||$4::text)))).*
      from public.property_search_documents d where property_id='100'`, [id,address,city,zip]);
  }
}
