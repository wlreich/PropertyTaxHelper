import { annualHistory, changeLabel } from './annual-history.ts';
import { currentAssessmentStory, selectCurrentAssessment } from './current-assessment.ts';
import { capModel, propertyFeatures, valueDriverSummary } from './property-sections.ts';
import { componentKey, componentName, constructionClasses, dateLabel, propertyFacts, protestEvidence, snapshotLabel, type Snapshot, type ProtestObservation } from './property-history.ts';
import { adjustmentReasons, adjustmentSummary, type MarketAdjustment } from './market-adjustments.ts';
import { neighborhoodAnalysis, type NeighborhoodAnalysisData } from './neighborhood-analysis.ts';
import { median, perFoot } from './neighborhood.ts';
import { currency } from './property-search.ts';
import type { Property } from './supabase/properties.ts';

export type ReportRow = { id: string; cells: string[]; note?: string };
export type ReportBlock =
  | { kind: 'note'; title?: string; text: string; emphasis?: boolean }
  | { kind: 'table'; title: string; columns: string[]; rows: ReportRow[] }
  | { kind: 'chart'; subject: number; median: number };
export type ReportSection = { id: string; title: string; blocks: ReportBlock[] };

// Keep only aggregate public metrics in the report, not the neighborhood roster.
export function reportNeighborhood(data: NeighborhoodAnalysisData) {
  const analysis = neighborhoodAnalysis(data), summary = analysis.currentSummary;
  return {
    propertyId: data.subject.property_id, neighborhood: data.neighborhood,
    release: analysis.current, count: data.homes.length,
    median: summary.median, medianPerFoot: summary.medianPerFoot,
    valueCount: summary.valueCount, areaCount: summary.areaCount,
    medianLivingArea: median(data.homes.flatMap(h => h.area !== null && h.area > 0 ? [h.area] : [])),
    livingAreaCount: data.homes.filter(h => h.area !== null && h.area > 0).length,
    latestOutcome: analysis.latestOutcome && { year: analysis.latestOutcome.certified.tax_year, ...analysis.latestOutcome.all },
    carryForward: analysis.carryForward[0] ?? null,
    coverage: analysis.coverage.map(c => ({release:c.release, eligible:c.eligibleCount, base:c.baseCount})),
  };
}
export type ReportNeighborhood = ReturnType<typeof reportNeighborhood>;
export type PropertyReportInput = {
  property: Property; snapshots: Snapshot[]; protests?: ProtestObservation[];
  historyUnavailable?: boolean; protestsUnavailable?: boolean;
  adjustment?: MarketAdjustment | null; neighborhood?: ReportNeighborhood | null;
  release?: string; reportDate: string;
};
const number = (v: number | null | undefined, suffix = '') => v == null ? 'Unavailable' : `${v.toLocaleString('en-US',{maximumFractionDigits:4})}${suffix}`;
const money = (v: number | null | undefined) => v == null ? 'Unavailable' : currency(v);
const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${currency(Math.abs(v))}`;
const pct = (v: number | null) => v === null ? 'Unavailable' : `${v.toFixed(1)}%`;
const share = (v: {count:number;total:number;percent:number|null}) => v.total ? `${v.count} / ${v.total} (${pct(v.percent)})` : 'Unavailable — no eligible records';
const note = (text: string, title?: string, emphasis = false): ReportBlock => ({kind:'note',text,title,emphasis});
const table = (title: string, columns: string[], rows: ReportRow[]): ReportBlock => ({kind:'table',title,columns,rows});
const row = (id: string, ...cells: string[]): ReportRow => ({id,cells});
const difference = (subject: number | null, group: number | null) => subject === null || group === null || group <= 0 ? 'Unavailable' : `${signed(subject-group)} (${pct((subject/group-1)*100)})`;

export function buildPropertyReport(input: PropertyReportInput) {
  const {property:p, reportDate} = input;
  const selected = selectCurrentAssessment(p,input.snapshots);
  const current = input.release && input.release !== selected.dataset_id ? input.snapshots.find(s=>s.dataset_id===input.release) : selected;
  if (!current) return null;
  // Under-review profiles must never recover withheld values from older snapshots.
  if (p.values_under_review && current.dataset_id !== selected.dataset_id) return null;
  const snapshots = (p.values_under_review ? [] : input.snapshots).filter(s=>s.tax_year<current.tax_year || s.tax_year===current.tax_year && (!current.export_date || s.export_date!==null && s.export_date<=current.export_date));
  const evidence = protestEvidence(snapshots,input.protests ?? []);
  const story = currentAssessmentStory(current,snapshots,evidence,null,input.protestsUnavailable);
  const available = !input.historyUnavailable && snapshots.some(s=>s.dataset_id===current.dataset_id);
  const cap = capModel(current,story.previous,available,story.initial);
  const facts = propertyFacts(current);
  const history = annualHistory(snapshots,evidence).filter(r=>r.year<=current.tax_year);
  const n = input.neighborhood;
  const neighborhood = !p.values_under_review && n?.propertyId===p.property_id && n.release.dataset_id===current.dataset_id ? n : null;
  const compact = current.roll_stage === 'preliminary' && !current.exemptions.length && !current.entities.length && !story.previous && current.components.length <= 3 && !neighborhood && history.length <= 1;
  const sections: ReportSection[] = [];
  const summary: ReportBlock[] = [note(`${story.narrative}${story.outcome?.explanation ? ` ${story.outcome.explanation}` : ''}`,current.preliminary_baseline_eligible===false ? `Your ${snapshotLabel(current)}` : story.headline,true),
    table(`${snapshotLabel(current)} assessment`,['Measure','Value','Annual change'],[
      row('current-market',`${current.roll_stage === 'certified' ? 'Certified' : current.roll_stage === 'preliminary' ? current.preliminary_baseline_eligible===false ? 'Interim' : 'Proposed' : 'Supplemental'} market value`,money(current.market_value),changeLabel(story.annual)),
      row('current-assessed','Assessed before exemptions',money(current.assessed_value),changeLabel(story.assessed)),
    ]), note(`${story.protest}.${story.agents.length ? ` Identified agent assignment: ${story.agents.map(a=>a.name).join('; ')}. Assignment does not establish who handled a protest.` : ' No agent identified in available records.'} A recorded protest and a reduction do not establish causation. These are valuation changes, not tax savings.`)];
  if (story.outcome && story.initial) summary.push(table('From proposal to final assessment',['Measure','Amount'],[
    row('proposed-market','Proposed market value',money(story.initial.market_value)),
    row('cap-excluded','Value already excluded by the proposed cap',money(story.outcome.capExcluded)),
    row('proposed-assessed','Proposed assessed value',money(story.initial.assessed_value)),
    row('assessed-change','Assessed change from proposal',signed(-story.outcome.assessedReduction)),
    row('final-assessed','Final assessed before exemptions',money(current.assessed_value)),
  ]));
  if (cap.outlook) summary.push(note(`${cap.outlook.explanation} Starting assessed value: ${money(cap.outlook.base)}. Conditional 10% ceiling for ${cap.outlook.year}: ${money(cap.outlook.ceiling)}. Assumes continued eligibility and no qualifying new improvements. This is a ceiling, not a forecast or tax bill.`,cap.outlook.title,true));
  else summary.push(note(`${cap.paragraphs[0]} No next-year cap ceiling is estimated from unconfirmed eligibility or an unfinished assessment.`));
  if (p.values_under_review) summary.unshift(note('Shared ownership or differing source values prevent reliable comparisons. Unreconciled amounts are withheld.','Values need further review',true));
  sections.push({id:'summary',title:'Your year in review',blocks:summary});

  const inventory: ReportBlock[] = [table('Recorded property details',['Property detail','Recorded value'],[
    row('living-area','Living area',number(facts.livingArea,' sq ft')),
    row('land-area','Land area',number(current.land_acres,' acres')),
    row('year-built','Year built',facts.yearBuilt === null ? 'Unavailable' : String(facts.yearBuilt)),
    row('bedrooms','Bedrooms',number(facts.bedrooms)),
    row('bathrooms','Bathrooms',`${number(facts.fullBaths)} full · ${number(facts.halfBaths)} half`),
    row('garage','Attached garage',number(facts.garage,' sq ft')),
    row('class','Construction class',facts.classCode ?? 'Unavailable'),
    row('neighborhood','Appraisal District neighborhood',current.neighborhood ?? 'Unavailable'),
  ].filter(r=>!compact || !r.cells[1].includes('Unavailable')))];
  if (facts.classCode && constructionClasses[facts.classCode]) inventory.push(note(`${constructionClasses[facts.classCode].replaceAll('TCAD','Appraisal District')} Class does not verify present condition.`));
  const featureChanges = propertyFeatures(current,story.previous);
  const groups = new Map<string,typeof current.components>();
  current.components.forEach(c=>{const key=c.improvement_id ?? 'Unassigned';groups.set(key,[...(groups.get(key) ?? []),c]);});
  groups.forEach((components,id)=>inventory.push(table(`Improvement ${id} · recorded inventory`,['Feature / classification','Area or quantity','Year built','Recorded value'],components.map((c,i)=>({
    id:`feature-${id}-${i}`,cells:[`${componentName(c)} · ${c.code}${c.class_code ? ` · Class ${c.class_code}` : ''}`,number(c.area,['250','251','252'].includes(c.code) ? ' rooms' : ['1ST','2ND','3RD','041','011','095'].includes(c.code) ? ' sq ft' : ['522','604','447'].includes(c.code) ? ' units' : ' (source units)'),c.year_built === null ? 'Unavailable' : String(c.year_built),money(c.value)],
    note:[c.description && componentName(c).toLowerCase()!==c.description.toLowerCase() ? `Recorded description: ${c.description}` : '',story.previous ? featureChanges.find(f=>f.key===componentKey(c) && !f.change.startsWith('Newly listed'))?.change : ''].filter(Boolean).join(' ') || undefined,
  })))));
  if (!current.components.length) inventory.push(note('Detailed improvement and feature records are unavailable. Missing records do not prove a structure or feature is absent.'));
  inventory.push(note('Feature values can be nested within improvement totals; do not add them to the total again. Condition and effective-age fields are not supplied by the current public record contract. Multiple structures remain grouped by their recorded improvement IDs. Newly listed records do not prove new construction.'));
  if (story.previous && !compact) {
    const changes=featureChanges.filter(f=>f.value==='No longer separately listed');
    if(changes.length)inventory.push(table('Features no longer separately listed',['Feature','Current record','Comparison'],changes.map((f,i)=>row(`feature-change-${i}`,f.label,f.value,f.change))));
  }
  sections.push({id:'inventory',title:'The home in the records',blocks:inventory});

  if (!compact || current.land_value!==null || current.improvement_value!==null) {
    const valuation: ReportBlock[] = [table('Recorded valuation components',['Component',story.previous ? `${story.previous.tax_year} certified` : 'Prior year',`${current.tax_year} ${current.roll_stage}`,'Annual change'],[
      row('value-land','Land',money(story.previous?.land_value),money(current.land_value),story.previous?.land_value != null && current.land_value !== null ? signed(current.land_value-story.previous.land_value) : 'Unavailable'),
      row('value-improvements','Home & improvements',money(story.previous?.improvement_value),money(current.improvement_value),story.previous?.improvement_value != null && current.improvement_value !== null ? signed(current.improvement_value-story.previous.improvement_value) : 'Unavailable'),
      row('value-total','Total market value',money(story.previous?.market_value),money(current.market_value),story.previous?.market_value != null && current.market_value !== null ? signed(current.market_value-story.previous.market_value) : 'Unavailable'),
    ]),note(valueDriverSummary(current,story.previous))];
    const adjustment=input.adjustment;
    if(adjustment && adjustment.year===current.tax_year && adjustment.neighborhood===current.neighborhood && !p.values_under_review) {
      const a=adjustmentSummary(adjustment),own=adjustment.homes.find(h=>h.property_id===p.property_id);
      valuation.push(table('Market-area multiplier',['Year','Published multiplier'],adjustment.history.map(h=>row(`factor-${h.year}`,`${h.year}`,`${h.factor.toFixed(2)}×`))));
      if(own?.effect!==null && own?.effect!==undefined)valuation.push(note(`Estimated effect on this home: ${signed(own.effect)}. Changes only the multiplier, holding the other ${adjustment.year} preliminary inputs fixed. This is not the annual change or an explanation of the full certified result. Preliminary sources: ${dateLabel(own.prior_preliminary_date)} and ${dateLabel(own.preliminary_date)}.`, 'One input to the proposed valuation',true));
      else valuation.push(note(`Isolated multiplier effect unavailable: ${own ? adjustmentReasons[own.status] : 'property estimate not supplied'}.`));
      if(a.percent!==null)valuation.push(note(`Multiplier change: ${pct(a.percent)}. The multiplier adjusts building value after allowance for age and wear; land is separate. Published source: ${a.current?.filename ?? 'Unavailable'}, page ${a.current?.page ?? 'unavailable'}.`));
    } else valuation.push(note('A same-year, same-neighborhood multiplier estimate is unavailable for this report.'));
    sections.push({id:'valuation',title:'What makes up your value',blocks:valuation});
  }

  if(neighborhood) {
    const per=perFoot(current.market_value,facts.livingArea);
    const context: ReportBlock[] = [note(`Appraisal District group ${neighborhood.neighborhood} · ${neighborhood.count} single-family homes · ${snapshotLabel(current)}. A neighborhood group is not an individually matched comparable set.`),
      table('Same-period neighborhood comparison',['Measure','Your home','Group median','Difference'],[
        row('group-market','Market value',money(current.market_value),money(neighborhood.median),difference(current.market_value,neighborhood.median)),
        row('group-foot','Market value / living sq ft',money(per),money(neighborhood.medianPerFoot),difference(per,neighborhood.medianPerFoot)),
        row('group-area','Living area',number(facts.livingArea,' sq ft'),number(neighborhood.medianLivingArea,' sq ft'),'Size context'),
      ]),note(`Market-value median: ${neighborhood.valueCount} eligible homes. Value-per-square-foot median: ${neighborhood.areaCount} eligible homes. Living-area median: ${neighborhood.livingAreaCount} records. Market value includes land. Lot-area medians are not supplied. Differences in size, land, condition and features can explain differences from a median.`)];
    if(current.market_value!==null && neighborhood.median!==null)context.push({kind:'chart',subject:current.market_value,median:neighborhood.median});
    const outcome=neighborhood.latestOutcome;
    if(outcome)context.push(table(`${outcome.year} neighborhood outcomes`,['Outcome','Eligible result'],[
      row('group-reduced','Lower certified than proposed value',share(outcome.reduced)),
      row('group-reduction','Median dollar reduction among reduced homes',money(outcome.medianReduction)),
      row('group-reduction-percent','Median individual percentage reduction',pct(outcome.medianPercent)),
      row('group-cap','Reduced homes crossing below a usable recorded cap',share(outcome.crossed)),
    ]),note('Cap crossings use reduced homes with a usable recorded cap threshold and a proposal at or above that threshold. That denominator differs from the full neighborhood. A reduction alone does not establish that a protest occurred.'));
    const carry=neighborhood.carryForward;
    if(carry)context.push(note(`${carry.full.count} / ${carry.full.total} homes reduced at least ${carry.thresholdPercent}% in ${carry.prior.tax_year} received a ${carry.current.tax_year} proposal at or above their prior proposal (${pct(carry.full.percent)}). ${carry.matchedCount} matched eligible records; ${carry.excludedCount} excluded or unavailable. This is neighborhood context, not proof that a valuation is incorrect.`,'Did prior reductions carry forward?'));
    sections.push({id:'neighborhood',title:'Your home, in context',blocks:context});
  } else sections.push({id:'neighborhood',title:'Neighborhood context',blocks:[note('A reliable neighborhood comparison for this property and release is unavailable. No median, percentile or apparent zero replaces missing information.')]});

  if(!compact && history.length) {
    sections.push({id:'history',title:'Your assessment over time',blocks:[
      note('All available years through this assessment year. Annual changes compare consecutive certified years; within-year changes compare usable proposed and certified releases. Missing years and excluded baselines are not zero.'),
      table('Assessment and protest history',['Year / stage','Proposed market','Certified market','Assessed before exemptions','Within-year change'],history.map(h=>({id:`history-${h.year}`,cells:[`${h.year} · ${h.status}`,money(h.preliminary),money(h.market),money(h.afterCap),changeLabel(h.within)],note:[
        `Annual certified market change: ${changeLabel(h.annual)}; assessed change: ${changeLabel(h.annualAssessed)}.`,
        h.outcome?.explanation ?? '',
        h.protests.length ? h.protests.map(p=>`${p.basis} (${p.date})${p.agent ? `; agent: ${p.agent}` : ''}${p.codes.length ? `; recorded status: ${p.codes.join(', ')}` : ''}`).join('. ') : input.protestsUnavailable ? 'Protest records temporarily unavailable.' : 'No protest found in available records; this does not establish that none was filed.',
        `Sources: ${h.sources.map(s=>`${s.label}, ${s.date}`).join('; ') || 'Valuation sources unavailable'}.`,
        ...snapshots.filter(s=>s.tax_year===h.year && s.valuation_note).map(s=>s.valuation_note!),
      ].filter(Boolean).join(' ')}))),
      note('An agent assignment does not confirm who handled a case. Interim releases remain identified by date and stage; known conflicting preliminary baselines are excluded from reduction calculations. A recorded protest alongside a reduction does not establish causation.'),
    ]});
  }
  const closing: ReportBlock[] = [note(`${cap.exemptionNames.length ? `Recorded exemptions: ${cap.exemptionNames.join(', ')}.` : 'Residence homestead and other exemptions are not confirmed in available records.'} ${cap.paragraphs[0]}`)];
  if(cap.authorities.length)closing.push(table('Authority-specific taxable values',['Taxing authority','Assessed','Deduction','Taxable'],cap.authorities.map(a=>({id:`authority-${a.code}`,cells:[a.name,money(current.assessed_value),a.reconciles ? money(a.exemptions) : 'Not reconciled',money(a.taxable)],note:a.entries.length ? `${a.entries.map(e=>`${e.label}: ${money(e.value)}`).join('; ')}.${a.reconciles ? '' : ' Recorded exemptions do not reconcile to the taxable value shown; verify the official record.'}` : a.reconciles ? undefined : 'Exemption breakdown unavailable.'}))),note('Deductions reconcile the listed exemptions to assessed and taxable values. These amounts are not taxes. Exemption rules, tax rates and any tax ceilings differ by authority.'));
  else closing.push(note('Authority-specific taxable values and reconciled deductions are unavailable.'));
  closing.push(note(`Confirm ${facts.livingArea!==null ? `${number(facts.livingArea)} living sq ft, ` : ''}${current.land_acres!==null ? `${number(current.land_acres)} acres, ` : ''}structures and recorded features against your home. Keep supporting measurements, photos or documents. Compare genuinely similar homes; a group median alone does not establish an accurate assessment. Review the next proposal and verify eligibility with the Appraisal District.`,'Useful things to check'));
  const sources=snapshots.filter(s=>s.tax_year<=current.tax_year);
  closing.push(note(`Assessment and feature coverage: ${sources.length ? sources.map(s=>`${snapshotLabel(s)} — ${s.export_date ? dateLabel(s.export_date) : s.export_time_raw ?? 'date unavailable'}`).join('; ') : `${snapshotLabel(current)} — ${current.export_date ? dateLabel(current.export_date) : 'date unavailable'}`}.${input.historyUnavailable ? ' Detailed history is temporarily unavailable.' : ''} Protest observations: ${evidence.length ? [...new Set(evidence.map(e=>`${e.tax_year}: ${dateLabel(e.export_date)}`))].join('; ') : 'not supplied'}. Report prepared ${dateLabel(reportDate)}. Later corrections may exist. ParcelSavvy is independent of the Appraisal District; official records and notices remain the reference.`,'Source coverage and limits'));
  sections.push({id:'review',title:'Exemptions & items to review',blocks:closing});
  if(compact) {
    summary.splice(2,summary.length-2,note(`${story.protest}. A missing record does not rule out a protest. Cap eligibility is unconfirmed; no next-year ceiling is estimated. Authority-specific taxable values are unavailable.`));
    inventory.splice(0,inventory.length,note(`Living area: ${number(facts.livingArea,' sq ft')}. Year built: ${facts.yearBuilt ?? 'unavailable'}. Neighborhood group: ${current.neighborhood ?? 'unavailable'}.`),...inventory.filter(b=>b.kind==='table'&&b.title!=='Recorded property details'));
    const compactSummary=summary.find(b=>b.kind==='table');if(compactSummary?.kind==='table'){compactSummary.columns=compactSummary.columns.slice(0,2);compactSummary.rows.forEach(r=>{r.cells=r.cells.slice(0,2);});}
    sections.splice(sections.findIndex(s=>s.id==='neighborhood'),1);
    closing.splice(0,closing.length,note('A reliable same-period neighborhood comparison is unavailable. Missing values are not zero.'),note('Verify the physical record, exemptions and deadlines against your official notice. Keep supporting measurements, photos or documents.','Items to review'),note(`${snapshotLabel(current)} · ${dateLabel(current.export_date)}. Prepared ${dateLabel(reportDate)}. Detailed features and history are limited to available records. ParcelSavvy is independent of the Appraisal District; official records remain the reference.`, 'Source coverage and limits'));
  }
  return {propertyId:p.property_id,address:p.address,location:[p.city,p.postal_code].filter(Boolean).join(', '),releaseId:current.dataset_id,year:current.tax_year,stage:current.roll_stage,releaseLabel:snapshotLabel(current),reportDate,compact,sections};
}
export type PropertyReport = NonNullable<ReturnType<typeof buildPropertyReport>>;

// A pathological source label must continue explicitly, never be clipped by a
// print page. Normal rows remain intact; no meaningful source text is discarded.
export function reportRowParts(row: ReportRow) {
  const split=(text:string,size=240)=>text.match(new RegExp(`[\\s\\S]{1,${size}}`,'g')) ?? [''];
  const cells=row.cells.map(text=>split(text)), notes=row.note ? split(row.note,1200) : [];
  const count=Math.max(...cells.map(c=>c.length),notes.length);
  return Array.from({length:count},(_,i)=>({id:i===0 ? row.id : `${row.id}-continued-${i}`,continued:i>0,cells:cells.map((c,j)=>c[i] ?? (j===0 ? 'Detail (continued)' : '')),note:notes[i]}));
}
