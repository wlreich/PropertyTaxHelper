// Synthetic inputs only; existing market values and season outcomes stay unchanged.
export async function seedMarketAdjustments(db) {
 await db.query(`update public.property_snapshot_profiles set snapshot=jsonb_set(snapshot,'{improvement_value}',to_jsonb(round((snapshot->'components'->0->>'value')::numeric*1.78))) where dataset_id='33333333-3333-4333-8333-333333333333' and property_id in ('100','120')`);
}
