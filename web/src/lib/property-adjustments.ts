import { primaryBuilding } from "./tcad-costs.ts";
import { estimatePercentGood,calculateTcadAdjustments,type TcadInputs } from "./tcad-method.ts";
import type { ComparisonProperty } from "./property-comparisons.ts";
import { comparisonSummary } from "./property-comparisons.ts";

export const adjustmentFactors = [
  "Land", "Living area", "Construction class", "Percent good",
  "Non-living details", "Additional improvements", "Neighborhood",
] as const;
export type AdjustmentFactor = typeof adjustmentFactors[number];
export type AdjustmentLine = {
  factor: AdjustmentFactor;
  amount: number | null;
  explanation: string;
  inputs: { label: string; value: number | string | null; unit?: "money" | "number" | "year" }[];
};
const validValue = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const money = (value: number) => Math.round(value * 100) / 100;

// Require every model factor, including explicit assumptions, for an estimate.
// Missing core factors stay unknown; zero assumptions are explained in the grid.
export function totalAdjustments(reported: number | null, lines: AdjustmentLine[]) {
  const complete = lines.length === adjustmentFactors.length && adjustmentFactors.every(factor => {
    const matches = lines.filter(line => line.factor === factor);
    return matches.length === 1 && matches[0].amount !== null && Number.isFinite(matches[0].amount);
  });
  const total = complete ? money(lines.reduce((sum, line) => sum + line.amount!, 0)) : null;
  const estimate = validValue(reported) && total !== null ? money(reported + total) : null;
  const adjustedValue = estimate !== null && Number.isFinite(estimate) && estimate >= 0 ? estimate : null;
  return { total: adjustedValue === null ? null : total, adjustedValue };
}

const amount = (n:number|null|undefined):n is number => typeof n === "number" && Number.isFinite(n) && n>=0;
function model(property:ComparisonProperty, taxYear:number) {
  const costs=property.costs?.tax_year===taxYear?property.costs:undefined;
  const main=primaryBuilding(costs);
  const complete=!!main?.complete;
  const good=main?estimatePercentGood(main.class_code,taxYear,main.depreciation_year,main.year_built):null;
  const mainRcn=main && amount(main.main_value) && good ? main.main_value/(good.value/100):null;
  const ratio=main && amount(main.reported_value) && amount(main.detail_value) && main.detail_value>0 ? main.reported_value/main.detail_value:null;
  const mass=ratio!==null&&ratio>0&&ratio<=10?Math.round(ratio*10000)/10000:null;
  const secondary=complete?costs!.improvements.filter(b=>b.id!==main!.id).reduce((sum,b)=>sum+(b.reported_value??0),0):null;
  const inputs:TcadInputs={market:amount(property.market_value)?property.market_value:null,land:amount(property.land_value)?property.land_value:null,area:main?.main_area??null,
    classCode:main?.class_code??property.class_code,mainRcn:complete?mainRcn:null,mainRcnld:complete?main!.main_value:null,
    percentGood:good?.value??null,nonliving:complete&&amount(main!.detail_value)&&amount(main!.main_value)?main!.detail_value!-main!.main_value!:null,
    secondary,mass};
  return {inputs,good,main,complete};
}
export function propertyAdjustments(subject:ComparisonProperty,comparable:ComparisonProperty,taxYear=2026) {
  const s=model(subject,taxYear),c=model(comparable,taxYear);
  const sameArea=!!subject.neighborhood && subject.neighborhood===comparable.neighborhood;
  const assumedEqualMass=sameArea&&(s.inputs.mass===null||c.inputs.mass===null);
  const si={...s.inputs,mass:assumedEqualMass?1:s.inputs.mass};
  const ci={...c.inputs,mass:assumedEqualMass?1:c.inputs.mass};
  const calculation=calculateTcadAdjustments(si,ci);
  const input=(label:string,value:number|string|null|undefined,unit?:"money"|"number"|"year")=>({label,value:value??null,unit});
  const lines:AdjustmentLine[]=[
    {factor:"Land",amount:calculation.amounts.Land,explanation:"Your reported land value minus the comparable’s land value.",inputs:[input("Your land value",subject.land_value),input("Comparable land value",comparable.land_value)]},
    {factor:"Living area",amount:calculation.amounts["Living area"],explanation:"Difference in the primary buildings’ living areas × your replacement-cost rate per square foot. The rate is reconstructed from main-area depreciated cost and estimated percent good; the main-area factor is 100%.",inputs:[input("Your living area (sq ft)",si.area,"number"),input("Comparable living area (sq ft)",ci.area,"number"),input("Your replacement cost per sq ft",calculation.subjectRate===null?null:`$${calculation.subjectRate.toFixed(2)}`)]},
    {factor:"Construction class",amount:calculation.amounts["Construction class"],explanation:si.classCode&&si.classCode===ci.classCode?"Same reported class; $0 follows TCAD’s worked same-class comparisons. Different building configurations may need individual review.":"(Your replacement-cost rate ÷ comparable rate − 1) × comparable main-area replacement cost. Reconstructed rates use estimated percent good.",inputs:[input("Your class",si.classCode),input("Comparable class",ci.classCode),input("Comparable replacement cost per sq ft",calculation.compRate===null?null:`$${calculation.compRate.toFixed(2)}`),input("Comparable main-area replacement cost",ci.mainRcn)]},
    {factor:"Percent good",amount:calculation.amounts["Percent good"],explanation:"Difference in percent good ÷ 100 × the comparable’s main-area depreciated cost. Percent good is the portion of building cost remaining after depreciation.",inputs:[input("Your percent good",si.percentGood===null?null:`${si.percentGood}%`),input("Comparable percent good",ci.percentGood===null?null:`${ci.percentGood}%`),input("Your depreciation year",s.good?.year,"year"),input("Comparable depreciation year",c.good?.year,"year"),input("Comparable main-area depreciated cost",ci.mainRcnld),input("Your estimate basis",s.good?.basis),input("Comparable estimate basis",c.good?.basis)]},
    {factor:"Non-living details",amount:calculation.amounts["Non-living details"],explanation:"Your primary building’s non-living detail costs minus the comparable’s, before neighborhood multipliers. Garages, porches, pools and other features attached to that improvement are counted here, once.",inputs:[input("Your non-living details",si.nonliving),input("Comparable non-living details",ci.nonliving),input("Your recorded non-living features",s.main?.complete ? s.main.features.filter(f=>!["1ST","2ND","3RD"].includes(f.code)).map(f=>f.description||f.code).join(", ")||"None recorded" : null),input("Comparable recorded non-living features",c.main?.complete ? c.main.features.filter(f=>!["1ST","2ND","3RD"].includes(f.code)).map(f=>f.description||f.code).join(", ")||"None recorded" : null)]},
    {factor:"Additional improvements",amount:calculation.amounts["Additional improvements"],explanation:"Difference in the reported values of improvements other than the highest-valued improvement. These values already include their neighborhood multipliers. $0 for an empty secondary inventory means none are recorded in this release.",inputs:[input("Your secondary improvements",si.secondary),input("Comparable secondary improvements",ci.secondary)]},
    {factor:"Neighborhood",amount:calculation.amounts.Neighborhood,explanation:assumedEqualMass?"Same reported market area; equal neighborhood factors are assumed because a multiplier could not be recovered.":"(Your multiplier − comparable multiplier) ÷ comparable multiplier × comparable non-land market value. Multipliers are recovered from improvement totals divided by summed depreciated detail costs; equal factors give $0.",inputs:[input("Your market area",subject.neighborhood),input("Comparable market area",comparable.neighborhood),input("Your multiplier",si.mass===null?null:si.mass.toFixed(4)),input("Comparable multiplier",ci.mass===null?null:ci.mass.toFixed(4))]},
  ];
  const supportedClass=(code:string|null)=>!!code&&/^R[1-6]$/.test(code);
  const eligibleTypes=new Set(["01","02","03","04","15","16","22","39","59"]);
  const compatible=subject.property_type===comparable.property_type&&supportedClass(si.classCode)&&supportedClass(ci.classCode)
    &&!!s.main?.state_code&&s.main.state_code===c.main?.state_code&&eligibleTypes.has(s.main.type_code??"")&&eligibleTypes.has(c.main?.type_code??"");
  const totals=compatible?totalAdjustments(comparable.market_value,lines):{total:null,adjustedValue:null};
  const subtotal=amount(comparable.market_value)?money(comparable.market_value+lines.reduce((sum,l)=>sum+(l.amount??0),0)):null;
  return {property:comparable,lines,...totals,partialSubtotal:subtotal!==null&&subtotal>=0?subtotal:null,
    landSubtotal:amount(comparable.market_value)&&lines[0].amount!==null&&comparable.market_value+lines[0].amount>=0?money(comparable.market_value+lines[0].amount):null};
}
export type PropertyAdjustments = ReturnType<typeof propertyAdjustments>;

export function adjustmentSummary(subject: ComparisonProperty, results: PropertyAdjustments[]) {
  const unique = [...new Map(results.filter(r => r.property.property_id !== subject.property_id).map(r => [r.property.property_id, r])).values()];
  const complete = unique.filter(r => validValue(r.adjustedValue) && validValue(r.property.market_value));
  return {
    ...comparisonSummary(subject, complete.map(r => ({ ...r.property, market_value: r.adjustedValue }))),
    excluded: unique.length - complete.length,
    pairedReportedMedian: comparisonSummary(subject, complete.map(r => r.property)).median,
  };
}
