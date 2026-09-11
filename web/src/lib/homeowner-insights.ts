import { comparison, componentKey, componentName, dateLabel, entityDisplayName, type Entity, type ProtestObservation, type Snapshot } from "./property-history.ts";
import { currency } from "./property-search.ts";

export function changeWords(before: number | null | undefined, after: number | null | undefined) {
  const c = comparison(before, after);
  if (!c) return "Comparison unavailable";
  if (!c.dollars) return "unchanged";
  return `${c.dollars < 0 ? "down" : "up"} ${currency(Math.abs(c.dollars))}${c.percent !== null && Math.abs(c.percent) >= 0.1 ? ` (${Math.abs(c.percent).toFixed(1)}%)` : ""}`;
}
export function assessmentSummary(current: Snapshot | undefined, initial: Snapshot | undefined, previous: Snapshot | undefined) {
  if (!current || current.market_value === null) return null;
  const proposed = current.roll_stage === "certified" && initial?.roll_stage === "preliminary" && initial.tax_year === current.tax_year && initial.export_date && current.export_date && initial.export_date < current.export_date
    ? comparison(initial.market_value, current.market_value) : null;
  const annual = previous?.roll_stage === "certified" && previous.tax_year === current.tax_year - 1
    ? comparison(previous.market_value, current.market_value) : null;
  return {value:current.market_value, proposed, annual};
}
// An agent listed for a tax year is not necessarily the agent who handled its protest.
export function agentsForYear(evidence: ProtestObservation[], year: number) {
  const agents = new Map<string, Set<string | null>>();
  for (const record of evidence) {
    if (record.tax_year !== year || !record.arb_agent_listed || !record.arb_agent_name) continue;
    const dates = agents.get(record.arb_agent_name) ?? new Set<string | null>();
    dates.add(record.export_date);
    agents.set(record.arb_agent_name, dates);
  }
  return [...agents].sort(([a],[b])=>a.localeCompare(b)).map(([name,dates])=>({name,dates:[...dates].sort((a,b)=>(a ?? "9999").localeCompare(b ?? "9999"))}));
}
export function annualExplanation(current: Snapshot | undefined, previous: Snapshot | undefined, entity: Entity | undefined) {
  if (!current || !previous) return null;
  const market = comparison(previous.market_value, current.market_value);
  const priorEntity = previous.entities.find(e => e.code === entity?.code);
  const taxable = comparison(priorEntity?.taxable_value, entity?.taxable_value);
  const cap = comparison(previous.assessed_value, current.assessed_value);
  if (!market) return null;
  const opposite = taxable && market.dollars * taxable.dollars < 0;
  const headline = opposite
    ? `Market value ${market.dollars < 0 ? "fell" : "rose"}, but taxable value ${taxable.dollars < 0 ? "fell" : "rose"}`
    : market.dollars === 0 ? "Your market value held steady" : `Your market value ${market.dollars < 0 ? "fell" : "rose"} from last year`;
  const summary = `Compared with ${previous.tax_year}, market value is ${changeWords(previous.market_value,current.market_value)}.${entity && taxable ? ` ${entityDisplayName(entity)} taxable value is ${changeWords(priorEntity?.taxable_value,entity.taxable_value)}.` : ""}`;
  let explanation: string | null = null;
  if (opposite && cap) {
    explanation = `The value after the appraisal cap ${cap.dollars > 0 ? "increased" : cap.dollars < 0 ? "decreased" : "stayed the same"}. Caps and exemptions can make taxable value move differently from market value.`;
    if (cap.dollars > 0 && taxable.dollars > 0 && entity && priorEntity && current.assessed_value !== null && previous.assessed_value !== null && entity.taxable_value !== null && priorEntity.taxable_value !== null) {
      const nowExemptions = Object.values(entity.exemptions).reduce((a,b)=>a+b,0);
      const oldExemptions = Object.values(priorEntity.exemptions).reduce((a,b)=>a+b,0);
      if (nowExemptions > oldExemptions && Math.abs(current.assessed_value-entity.taxable_value-nowExemptions)<1 && Math.abs(previous.assessed_value-priorEntity.taxable_value-oldExemptions)<1) {
        explanation = "The value after the appraisal cap increased. Larger recorded exemptions softened the increase in this taxable value.";
      }
    }
  }
  return {headline,summary,explanation};
}
export function seasonOutcome(current: Snapshot | undefined, initial: Snapshot | undefined, evidence: ProtestObservation[], entity?: Entity) {
  if (!current || !initial || current.roll_stage !== "certified" || initial.roll_stage !== "preliminary" || current.tax_year !== initial.tax_year || !current.export_date || !initial.export_date || initial.export_date >= current.export_date) return null;
  const market = comparison(initial.market_value,current.market_value);
  const oldEntity = initial.entities.find(e=>e.code===entity?.code);
  const taxable = comparison(oldEntity?.taxable_value,entity?.taxable_value);
  const reduction = market?.significant && market.dollars < 0 ? {change:market,label:"Market value"}
    : taxable?.significant && taxable.dollars < 0 && entity ? {change:taxable,label:`${entityDisplayName(entity)} taxable value`} : null;
  const observedProtest = evidence.some(s=>s.tax_year===current.tax_year && (s.protest_flag || s.arb_case_listed) && s.export_date && s.export_date >= initial.export_date! && s.export_date <= current.export_date!);
  if (!reduction) return null;
  return {...reduction, observedProtest,
    headline:observedProtest ? "Looks like a successful protest!" : "Your proposed value came down",
    period:`${dateLabel(initial.export_date)} to ${dateLabel(current.export_date)}`};
}
export function historySequence(current: Snapshot | undefined, initial: Snapshot | undefined, previous: Snapshot | undefined) {
  return [previous && {snapshot:previous,label:"Last year"},initial && {snapshot:initial,label:"This year’s proposed value"},current && {snapshot:current,label:current.roll_stage === "certified" ? "Certified record" : "Latest record"}].filter((s):s is {snapshot:Snapshot;label:string}=>Boolean(s));
}
export function featureHighlights(current: Snapshot | undefined, initial: Snapshot | undefined, previous: Snapshot | undefined) {
  if (!current) return [];
  const names = new Map<string,Snapshot["components"][number]>();
  for (const s of [previous,initial,current]) for (const c of s?.components ?? []) if (/POOL|SPA/i.test(c.description)) names.set(componentKey(c),c);
  return [...names.values()].map(c=>{
    const now=current.components.filter(x=>componentKey(x)===componentKey(c));
    const first=initial?.components.filter(x=>componentKey(x)===componentKey(c)) ?? [];
    const old=previous?.components.filter(x=>componentKey(x)===componentKey(c)) ?? [];
    if (now.length > 1 || first.length > 1 || old.length > 1) return {key:componentKey(c),name:componentName(c),value:"More than one matching detail",detail:"Open the records to compare these entries."};
    if (!now.length) {
      const sameType=current.components.some(x=>x.code===c.code);
      const before=first[0] ?? old[0];
      const source=first.length ? initial : previous;
      return {key:componentKey(c),name:componentName(c),value:sameType ? "Details changed" : "No longer separately listed",detail:before && source ? `${currency(before.value)} in the ${source.tax_year} ${source.roll_stage} record. The record does not establish why it changed.` : "Open the records to compare this feature."};
    }
    const detail=old.length && previous ? `${changeWords(old[0].value,now[0].value)} vs. ${previous.tax_year}.` : first.length ? `${changeWords(first[0].value,now[0].value)} since the proposed value.` : "Listed in the latest available record.";
    return {key:componentKey(c),name:componentName(c),value:currency(now[0].value),detail};
  }).slice(0,4);
}
// A starting search, not a geographic or comparable-property claim.
export function streetSearch(address: string) {
  const street=address.replace(/^\d+[A-Za-z]?(?:-\d+)?\s+/,"").replace(/\s+(?:UNIT|APT|SUITE|STE|#)\s*.*$/i,"").trim();
  return street !== address && street.length >= 3 ? street : null;
}
