export const adjustmentReasons = {
  ok: 'Estimate available',
  missing_preliminary: 'Preliminary snapshot unavailable',
  unmatched_neighborhood: 'Same neighborhood not verified in both years',
  missing_factor: 'Annual factor pair unavailable',
  unverified_components: 'Improvement components incomplete',
  unverified_buildings: 'Single residential building not verified',
  does_not_reconcile: 'Components do not reproduce the preliminary improvement value',
};
export type AdjustmentHome = {property_id:string;status:keyof typeof adjustmentReasons;effect:number|null;actual_change:number|null;preliminary_date:string|null;prior_preliminary_date:string|null};
export type MarketAdjustment = {year:number;neighborhood:string;history:{year:number;factor:number;page:number;filename:string;sha256:string}[];homes:AdjustmentHome[]};
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const nullableNumber=(v:unknown)=>v===null||number(v);
const date=(v:unknown)=>v===null||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
export function parseMarketAdjustment(v:unknown):MarketAdjustment|null {
  if(!obj(v)||!Number.isInteger(v.year)||Number(v.year)<2000||Number(v.year)>2200||typeof v.neighborhood!=='string'||v.neighborhood.length>100||!Array.isArray(v.history)||v.history.length>201||!Array.isArray(v.homes)||v.homes.length>10000)return null;
  for(const h of v.history)if(!obj(h)||!Number.isInteger(h.year)||Number(h.year)<2000||Number(h.year)>Number(v.year)||!number(h.factor)||h.factor<=0||h.factor>100||!Number.isInteger(h.page)||Number(h.page)<1||h.filename!==`${h.year}_Market_Adjustments.pdf`||typeof h.sha256!=='string'||!/^[a-f0-9]{64}$/.test(h.sha256))return null;
  for(const h of v.homes)if(!obj(h)||typeof h.property_id!=='string'||!/^\d{1,12}$/.test(h.property_id)||typeof h.status!=='string'||!Object.hasOwn(adjustmentReasons,h.status)||!nullableNumber(h.effect)||!nullableNumber(h.actual_change)||!date(h.preliminary_date)||!date(h.prior_preliminary_date)||(h.status==='ok')!==(h.effect!==null)||h.actual_change!==null&&(!h.preliminary_date||!h.prior_preliminary_date))return null;
  if(new Set(v.history.map(h=>h.year)).size!==v.history.length||new Set(v.homes.map(h=>h.property_id)).size!==v.homes.length)return null;
  return v as MarketAdjustment;
}
export function adjustmentSummary(data:MarketAdjustment) {
  const effects=data.homes.flatMap(h=>h.effect===null?[]:[h.effect]).sort((a,b)=>a-b);
  const n=effects.length;
  const previous=data.history.find(h=>h.year===data.year-1),current=data.history.find(h=>h.year===data.year);
  const excluded=Object.entries(adjustmentReasons).filter(([key])=>key!=='ok').map(([reason,label])=>({reason,label,count:data.homes.filter(h=>h.status===reason).length})).filter(x=>x.count);
  return {count:n,total:data.homes.length,median:n?(effects[Math.floor((n-1)/2)]+effects[Math.floor(n/2)])/2:null,previous,current,percent:previous&&current?(current.factor/previous.factor-1)*100:null,excluded};
}
