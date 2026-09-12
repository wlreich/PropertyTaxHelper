// Source: TCAD’s 2026 Sale and Equity Grids methodology.
// Missing condition/state/eligibility inputs must never become confirmed tier matches.
export const comparisonMethod = {
  year: 2026,
  name: "TCAD 2026 equity comparison criteria",
  tiers: [
    { tier: 0, area: 1, condition: 0, classSteps: 0, years: 2 },
    { tier: 1, area: 5, condition: 0, classSteps: 0, years: 5 },
    { tier: 2, area: 10, condition: 1, classSteps: 0, years: 10 },
    { tier: 3, area: 10, condition: 1, classSteps: 0, years: 15 },
    { tier: 4, area: 15, condition: 1, classSteps: 0, years: 15 },
    { tier: 5, area: 15, condition: 2, classSteps: 1, years: 20 },
    { tier: 6, area: 20, condition: 2, classSteps: 2, years: 20 },
    { tier: 7, area: 25, condition: 2, classSteps: 2, years: 30 },
  ],
};
export type ComparisonProperty = {
  property_id: string; address: string; city: string; property_type: string;
  market_value: number | null; land_value: number | null; land_acres: number | null;
  neighborhood: string | null; living_area: number | null; class_code: string | null;
  year_built: number | null; main_buildings: number;
};
export type ComparisonRelease = { dataset_id: string; tax_year: number; roll_stage: string; export_date: string | null };
export type ComparisonData = {
  anchor_id: string; release: ComparisonRelease; releases: ComparisonRelease[];
  subject: ComparisonProperty; candidates: ComparisonProperty[]; selected: ComparisonProperty[];
  matches: ComparisonProperty[]; candidate_limit_reached: boolean; search_has_more: boolean;
};
export const validPropertyId = (id: string) => /^[0-9]{1,12}$/.test(id) && Number(id)>0;
export const validSource = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export function selectedIds(value: string | undefined) {
  return [...new Set((value ?? "").split(",").filter(validPropertyId).map(id=>String(Number(id))))].slice(0,10);
}
export function matchProperty(subject: ComparisonProperty, candidate: ComparisonProperty) {
  const sameArea = !!subject.neighborhood && candidate.neighborhood === subject.neighborhood;
  const sameClass = !!subject.class_code && candidate.class_code === subject.class_code;
  const areaDifference = subject.living_area && candidate.living_area ? (candidate.living_area-subject.living_area)/subject.living_area*100 : null;
  const yearDifference = subject.year_built && candidate.year_built ? Math.abs(candidate.year_built-subject.year_built) : null;
  const tier = sameArea && sameClass && areaDifference !== null && yearDifference !== null && candidate.property_type===subject.property_type
    ? comparisonMethod.tiers.find(t => Math.abs(areaDifference)<=t.area+1e-9 && yearDifference<=t.years)?.tier ?? null : null;
  const reasons: string[] = [];
  if (!subject.neighborhood || !candidate.neighborhood) reasons.push("Market area not reported");
  else reasons.push(sameArea ? "Same market area" : "Different market area");
  if (!subject.class_code || !candidate.class_code) reasons.push("Construction class not reported");
  else reasons.push(sameClass ? "Same construction class" : "Different construction class; class steps unverified");
  if (areaDifference !== null) reasons.push(areaDifference===0 ? "Same living area" : `Living area ${Math.abs(areaDifference).toFixed(1)}% ${areaDifference>0?"larger":"smaller"}`);
  else reasons.push("Living area cannot be compared");
  if(yearDifference!==null) reasons.push(yearDifference===0 ? "Same year built" : `Built ${yearDifference} ${yearDifference===1?"year":"years"} ${candidate.year_built!>subject.year_built!?"later":"earlier"}`);
  else reasons.push("Year built not reported");
  if(candidate.property_type!==subject.property_type) reasons.push("Different property type");
  // ParcelSavvy ordering, not a recreation of the complete TCAD score.
  return {tier, areaDifference, yearDifference, reasons, rank: tier ?? 99};
}
export function suggestions(data: ComparisonData) {
  return data.candidates.filter(p=>p.property_id!==data.subject.property_id && p.market_value!==null && p.class_code!=="XX" && matchProperty(data.subject,p).tier!==null)
    .sort((a,b)=>{
      const x=matchProperty(data.subject,a),y=matchProperty(data.subject,b);
      return x.rank-y.rank || Math.abs(x.areaDifference!)-Math.abs(y.areaDifference!) || x.yearDifference!-y.yearDifference! || a.property_id.localeCompare(b.property_id);
    }).slice(0,10);
}
export function comparisonSummary(subject: ComparisonProperty, selected: ComparisonProperty[]) {
  const unique=[...new Map(selected.filter(p=>p.property_id!==subject.property_id).map(p=>[p.property_id,p])).values()];
  const values=unique.flatMap(p=>p.market_value===null?[]:[p.market_value]).sort((a,b)=>a-b);
  const n=values.length;
  const median=n ? (values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2 : null;
  const difference=median!==null && subject.market_value!==null ? subject.market_value-median : null;
  return {count:n, missing:unique.length-n, median, difference, percent:median!==null && median>0 && difference!==null?difference/median*100:null};
}
