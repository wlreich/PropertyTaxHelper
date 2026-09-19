import { depreciationSchedules } from "./tcad-depreciation.ts";

export const tcadMethod = {year:2026, version:"TCAD formulas · published age schedules · record-based improvements v4", mainAreaFactor:1};
export function estimatePercentGood(classCode:string|null, taxYear:number, effectiveYear:number|null, actualYear:number|null) {
  const hasEffectiveYear=effectiveYear!==null && Number.isInteger(effectiveYear) && effectiveYear>=1800;
  const year=hasEffectiveYear ? effectiveYear : actualYear;
  if(!year || !Number.isInteger(year) || year<1800 || year>taxYear || !classCode) return null;
  const schedule=depreciationSchedules[String(taxYear)]?.classes[classCode];
  if(!schedule) return null;
  const age=taxYear-year;
  // Tables specify each age followed by a terminal 999 band; never extrapolate.
  const row=schedule.rows.find(([upperAge])=>upperAge>=age);
  if(!row) return null;
  return {value:row[1],year,age,basis:`TCAD ${taxYear} published ${classCode} schedule ${schedule.pricingId}, condition A (average). Condition is assumed because it is not reported in these inputs; other depreciation adjustments are not included.${hasEffectiveYear?"":" Actual year built substitutes for an unreported depreciation year."}`};
}
export type TcadInputs={market:number|null;land:number|null;area:number|null;classCode:string|null;
 mainRcn:number|null;mainRcnld:number|null;percentGood:number|null;nonliving:number|null;secondary:number|null;mass:number|null};
const finite=(n:number|null):n is number=>n!==null&&Number.isFinite(n);
const subtract=(a:number|null,b:number|null)=>finite(a)&&finite(b)?a-b:null;
// TCAD's worked examples round unit costs to cents, then truncate each line.
export const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const truncate=(n:number|null)=>finite(n)?Math.trunc(n+Math.sign(n)*1e-8):null;
export function calculateTcadAdjustments(s:TcadInputs,c:TcadInputs,mode:"equity"|"sales"="equity",adjustedSalePrice:number|null=null) {
 const subjectRate=finite(s.mainRcn)&&finite(s.area)&&s.area>0?cents(s.mainRcn/s.area):null;
 const compRate=finite(c.mainRcn)&&finite(c.area)&&c.area>0?cents(c.mainRcn/c.area):null;
 const start=mode==="sales"?adjustedSalePrice:c.market;
 const factor=finite(s.mass)&&finite(c.mass)&&c.mass>0?(s.mass-c.mass)/c.mass:null;
 return {subjectRate,compRate,start,amounts:{
  Land:truncate(subtract(s.land,c.land)),
  "Living area":finite(subjectRate)&&finite(s.area)&&finite(c.area)?truncate((s.area-c.area)*subjectRate*tcadMethod.mainAreaFactor):null,
  "Construction class":s.classCode&&s.classCode===c.classCode?0:finite(subjectRate)&&finite(compRate)&&compRate>0&&finite(c.mainRcn)?truncate((subjectRate/compRate-1)*c.mainRcn):null,
  "Percent good":finite(s.percentGood)&&finite(c.percentGood)&&finite(c.mainRcnld)?truncate((s.percentGood-c.percentGood)/100*c.mainRcnld):null,
  "Non-living details":truncate(subtract(s.nonliving,c.nonliving)),
  "Additional improvements":truncate(subtract(s.secondary,c.secondary)),
  Neighborhood:factor===0?0:finite(factor)&&finite(start)&&finite(c.land)?truncate((start-c.land)*factor):null,
 }};
}
