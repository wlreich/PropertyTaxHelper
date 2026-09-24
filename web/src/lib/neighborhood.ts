import type {MarketAdjustment} from './market-adjustments.ts';
import { type ComparisonProperty, type ComparisonRelease } from './property-comparisons.ts';
export type Home = { property_id:string;market:number|null;area:number|null;preliminary:number|null;certified:number|null;certified_area:number|null;prior:number|null;protested:boolean;entities:{code:string;name:string}[] };
export type Cap = {property_id:string;eligible:boolean|null;above:boolean|null;threshold:number|null};
export const exclusionLabels = {land_only:'Land-only valuation',unverified_type:'Property type needs verification',other_type:'Other property type',unverified_improvements:'Value of home and other features needs verification',unusable_value:'Market value unavailable or anomalous'};
export type Population = {candidate_count:number;excluded:{property_id:string;reason:keyof typeof exclusionLabels}[];land_code_mismatch:number;multiple_buildings:number};
export type Neighborhood = {market_adjustment?:MarketAdjustment|null;anchor_id:string;source_id:string;releases:ComparisonRelease[];preliminary_id:string|null;certified_id:string|null;prior_id:string|null;neighborhood:string;subdivision:string|null;subject:ComparisonProperty;homes:Home[];caps:Cap[];population:Population};
export const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
export const usable=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>=1000;
export const perFoot=(value:number|null,area:number|null)=>usable(value)&&area!==null&&Number.isFinite(area)&&area>0?value/area:null;
export const percentage=(n:number,d:number)=>d>0?n/d*100:null;
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
export function summarizeGroup(homes:Home[],caps:Cap[]) {
 const byId=new Map(caps.map(c=>[c.property_id,c]));
 const paired=homes.filter(h=>usable(h.preliminary)&&usable(h.certified));
 const reduced=paired.filter(h=>h.certified!<h.preliminary!);
 const eligible=homes.filter(h=>usable(h.preliminary)&&byId.get(h.property_id)?.eligible===true&&byId.get(h.property_id)?.above!==null);
 const above=eligible.filter(h=>byId.get(h.property_id)?.above===true);
 const crossingEligible=reduced.filter(h=>{const t=byId.get(h.property_id)?.threshold;return t!=null&&t>0&&h.preliminary!>=t;});
 const crossed=crossingEligible.filter(h=>h.certified!<byId.get(h.property_id)!.threshold!);
 const row=(n:number,d:number)=>({count:n,total:d,percent:percentage(n,d)});
 return {count:homes.length,above:row(above.length,eligible.length),reduced:row(reduced.length,paired.length),crossed:row(crossed.length,crossingEligible.length),
  shares:{above:row(above.length,homes.length),reduced:row(reduced.length,homes.length),crossed:row(crossed.length,homes.length)},
  missingPair:homes.length-paired.length,unchanged:paired.filter(h=>h.certified===h.preliminary).length,increased:paired.filter(h=>h.certified!>h.preliminary!).length,
  capNotApplicable:homes.filter(h=>byId.get(h.property_id)?.eligible===false).length,capUnknown:homes.length-eligible.length-homes.filter(h=>byId.get(h.property_id)?.eligible===false).length,
  reducedWithoutThreshold:reduced.length-crossingEligible.length,remainedAbove:crossingEligible.length-crossed.length,
  averageReduction:mean(reduced.map(h=>h.preliminary!-h.certified!)),averagePercent:mean(reduced.map(h=>(h.preliminary!-h.certified!)/h.preliminary!*100)),
  medianReduction:median(reduced.map(h=>h.preliminary!-h.certified!)),medianPercent:median(reduced.map(h=>(h.preliminary!-h.certified!)/h.preliminary!*100)),
  preliminaryMedian:median(paired.map(h=>h.preliminary!)),certifiedMedian:median(paired.map(h=>h.certified!)),
  certifiedPerFoot:median(paired.map(h=>perFoot(h.certified,h.certified_area)).filter((n):n is number=>n!==null))};
}
export function distribution(values:number[],subject:number|null) {
 const sorted=[...values].sort((a,b)=>a-b),mid=median(sorted);
 if(!sorted.length)return {bins:[],min:0,max:0,median:mid,subject,percentile:null,count:0};
 const min=sorted[0],max=sorted.at(-1)!,width=(max-min)/16||1;
 const bins=Array.from({length:max===min?1:16},(_,i)=>({low:min+i*width,high:max===min?max:min+(i+1)*width,count:0}));
 sorted.forEach(v=>bins[Math.min(bins.length-1,Math.floor((v-min)/width))].count++);
 return {bins,min,max,median:mid,subject,percentile:subject===null?null:percentage(sorted.filter(v=>v<subject).length,sorted.length),count:sorted.length};
}
export function neighborhoodSummary(data:Neighborhood) {
 const all=summarizeGroup(data.homes,data.caps),protested=data.homes.filter(h=>h.protested);
 const currentValues=data.homes.map(h=>h.market).filter(usable);
 const ppsf=data.homes.map(h=>perFoot(h.market,h.area)).filter((n):n is number=>n!==null);
 const med=median(currentValues),subjectValue=usable(data.subject.market_value)?data.subject.market_value:null;
 const subjectHome=data.homes.find(h=>h.property_id===data.subject.property_id),cap=data.caps.find(c=>c.property_id===data.subject.property_id);
 const ownCrossed=subjectHome&&cap?.threshold!=null&&usable(subjectHome.preliminary)&&usable(subjectHome.certified)&&subjectHome.preliminary>=cap.threshold&&subjectHome.certified<cap.threshold;
 const own=ownCrossed?{dollars:cap!.threshold!-subjectHome!.certified!,percent:(cap!.threshold!-subjectHome!.certified!)/cap!.threshold!*100,threshold:cap!.threshold!,final:subjectHome!.certified!}:null;
 const annual=data.homes.filter(h=>usable(h.prior)&&usable(h.market));
 const priorMedian=median(annual.map(h=>h.prior!)),currentMedian=median(annual.map(h=>h.market!));
 const entities=new Map<string,{code:string;name:string;count:number;applies:boolean}>();
 data.homes.forEach(h=>new Map(h.entities.map(e=>[e.code,e])).forEach(e=>{
  const found=entities.get(e.code)??{...e,count:0,applies:false};found.count++;found.applies||=h.property_id===data.subject.property_id;entities.set(e.code,found);
 }));
 return {all,protested:summarizeGroup(protested,data.caps),other:summarizeGroup(data.homes.filter(h=>!h.protested),data.caps),
  participation:percentage(protested.length,data.homes.length),median:med,medianPerFoot:median(ppsf),valueCount:currentValues.length,areaCount:ppsf.length,
  difference:med!==null&&subjectValue!==null?subjectValue-med:null,differencePercent:med!==null&&med>0&&subjectValue!==null?(subjectValue-med)/med*100:null,
  marketDistribution:distribution(currentValues,subjectValue),areaDistribution:distribution(ppsf,perFoot(data.subject.market_value,data.subject.living_area)),
  own,subjectIncluded:!!subjectHome,entities:[...entities.values()].sort((a,b)=>Number(b.applies)-Number(a.applies)||a.name.localeCompare(b.name)),
  entityCoverage:data.homes.filter(h=>h.entities.length).length,
  annual:priorMedian!==null&&priorMedian>0&&currentMedian!==null?{count:annual.length,percent:(currentMedian-priorMedian)/priorMedian*100}:null};
}
