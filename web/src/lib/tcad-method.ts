// TCAD 2026 worked-grid calibration, expressed as age so future releases work.
// These are observed examples, not the district's full depreciation schedule.
export const tcadMethod = {year:2026, version:"TCAD 2026 formulas · estimated inputs v2", mainAreaFactor:1};
const curves:Record<string,readonly (readonly [number,number])[]>={
  R3:[[0,100],[6,96],[8,95],[11,92],[12,91],[13,90],[15,88],[16,88]],
  R4:[[0,100],[12,90],[22,79]],
  R5:[[0,100],[11,90]],
};
export function estimatePercentGood(classCode:string|null, taxYear:number, effectiveYear:number|null, actualYear:number|null) {
  const year=effectiveYear && effectiveYear>=1800 ? effectiveYear : actualYear;
  if(!year || year<1800 || year>taxYear || !classCode || !/^R[1-6]$/.test(classCode)) return null;
  const age=taxYear-year, calibration=curves[classCode]?classCode:"R3", curve=curves[calibration];
  let value:number;let extrapolated=false;
  const exact=curve.find(([a])=>a===age);
  if(exact) value=exact[1];
  else {
    const upper=curve.findIndex(([a])=>a>age);
    if(upper>0) {const [a,g]=curve[upper-1],[b,h]=curve[upper];value=g+(age-a)/(b-a)*(h-g);}
    else {const [a,g]=curve[1],[b,h]=curve[curve.length-1];const slope=b>a?(h-g)/(b-a):(h-100)/b;
      value=h+(age-b)*slope;extrapolated=true;}
  }
  value=Math.round(Math.max(20,Math.min(100,value))*100)/100;
  return {value,year,age,basis:`Estimated from ${calibration} age examples${calibration!==classCode?` as a proxy for ${classCode}`:""}${extrapolated?"; extrapolated beyond the observed ages":""}. Average condition and no other depreciation adjustments are assumed.${effectiveYear?"":" Actual year built substitutes for an unreported depreciation year."}${taxYear!==2026?" Uses the 2026 calibration for this release year.":""}`};
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
