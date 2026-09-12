import type { ComparisonProperty } from "./property-comparisons.ts";

export type CostBuilding = {
  id: string; type_code: string | null; state_code: string | null;
  reported_value: number | null; detail_value: number | null; main_value: number | null; main_area: number | null;
  class_code: string | null; year_built: number | null; depreciation_year: number | null;
  floors: number; complete: boolean; features: {code: string; description: string; value: number | null}[];
};
export type CostRecord = { property_id: string; tax_year: number; improvements: CostBuilding[] };
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length <= 250;
const nullableText = (v: unknown) => v === null || text(v);
const amount = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v) && v >= 0;
export function parseCostRecords(v: unknown, anchor: string, source: string, year: number): CostRecord[] | null {
  if (!object(v) || v.anchor_id !== anchor || v.source_id !== source || !Array.isArray(v.items) || v.items.length > 32) return null;
  const records: CostRecord[] = [];
  for (const item of v.items) {
    if (!object(item) || !text(item.property_id) || !/^\d{1,12}$/.test(item.property_id) || item.tax_year !== year
      || !Array.isArray(item.improvements) || item.improvements.length > 100) return null;
    const improvements: CostBuilding[] = [];
    for (const b of item.improvements) {
      if (!object(b) || !text(b.id) || ![b.type_code,b.state_code,b.class_code].every(nullableText)
        || ![b.reported_value,b.detail_value,b.main_value,b.main_area,b.year_built,b.depreciation_year].every(amount)
        || !Number.isSafeInteger(b.floors) || Number(b.floors)<0 || typeof b.complete !== "boolean" || !Array.isArray(b.features) || b.features.length>500) return null;
      const features: CostBuilding["features"] = [];
      for (const f of b.features) {
        if (!object(f) || !text(f.code) || !text(f.description) || !amount(f.value)) return null;
        features.push({code:f.code,description:f.description,value:f.value as number|null});
      }
      improvements.push({id:b.id,type_code:b.type_code as string|null,state_code:b.state_code as string|null,
        reported_value:b.reported_value as number|null,detail_value:b.detail_value as number|null,main_value:b.main_value as number|null,
        main_area:b.main_area as number|null,class_code:b.class_code as string|null,year_built:b.year_built as number|null,
        depreciation_year:b.depreciation_year as number|null,floors:b.floors as number,complete:b.complete,features});
    }
    if(new Set(improvements.map(b=>b.id)).size!==improvements.length) return null;
    records.push({property_id:item.property_id,tax_year:year,improvements});
  }
  return new Set(records.map(r=>r.property_id)).size===records.length ? records : null;
}
export function primaryBuilding(costs: CostRecord | undefined) {
  if (!costs?.improvements.length || costs.improvements.some(b=>b.reported_value===null)) return null;
  return [...costs.improvements].sort((a,b)=>b.reported_value!-a.reported_value! || a.id.localeCompare(b.id))[0];
}
export function withCosts(property: ComparisonProperty, costs: CostRecord | undefined): ComparisonProperty {
  const main=primaryBuilding(costs);
  return {...property,costs,...(main ? {living_area:main.main_area,class_code:main.class_code,year_built:main.year_built,
    main_buildings:costs!.improvements.filter(b=>b.floors>0).length} : {})};
}
