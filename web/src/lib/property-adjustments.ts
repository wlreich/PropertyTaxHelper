import type { ComparisonProperty } from "./property-comparisons.ts";
import { comparisonSummary } from "./property-comparisons.ts";

export const adjustmentFactors = [
  "Land", "Living area", "Construction class", "Year built",
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

// ParcelSavvy estimate v1. Rates come only from independent public peers in the
// selected release, never from the subject's improvement assessment or selected set.
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null;
};
const unitValue = (p: ComparisonProperty) => validValue(p.market_value) && validValue(p.land_value)
  && validValue(p.living_area) && p.living_area > 0 && p.market_value > p.land_value && p.main_buildings === 1
  ? (p.market_value - p.land_value) / p.living_area : null;
const known = (value: string | null) => typeof value === "string" && value.trim() !== "" && value !== "XX";
const validYear = (year: number | null) => validValue(year) && Number.isInteger(year) && year >= 1800 && year <= 2200;

function localRates(subject: ComparisonProperty, comparable: ComparisonProperty, peers: ComparisonProperty[]) {
  const pool = [...new Map(peers.map(p => [p.property_id, p])).values()].filter(p =>
    p.property_id !== subject.property_id && p.property_id !== comparable.property_id
    && known(subject.neighborhood) && p.neighborhood === subject.neighborhood
    && p.property_type === subject.property_type && unitValue(p) !== null && validYear(p.year_built)
    && subject.living_area && Math.abs(p.living_area! / subject.living_area - 1) <= 0.15);
  const agePeers = pool.filter(p => p.class_code === subject.class_code && known(p.class_code))
    .sort((a, b) => Math.abs(a.living_area! - subject.living_area!) - Math.abs(b.living_area! - subject.living_area!) || a.property_id.localeCompare(b.property_id)).slice(0, 80);
  const slopes: number[] = [];
  const used = new Set<string>();
  for (let i = 0; i < agePeers.length; i++) for (let j = i + 1; j < agePeers.length; j++) {
    const a = agePeers[i], b = agePeers[j], years = a.year_built! - b.year_built!;
    if (Math.abs(years) < 3 || Math.abs(years) > 30 || Math.abs(a.living_area! - b.living_area!) / Math.min(a.living_area!, b.living_area!) > 0.05) continue;
    slopes.push(Math.log(unitValue(a)! / unitValue(b)!) / years);
    used.add(a.property_id); used.add(b.property_id);
  }
  const slope = used.size >= 8 && slopes.length >= 6 ? median(slopes) : null;
  // Guardrails are model limits, not TCAD depreciation schedules. Never clamp a rate.
  const ageRate = slope !== null && Number.isFinite(slope) && Math.abs(slope) <= 0.05 ? slope : null;
  const classPeers = pool.filter(p => validYear(comparable.year_built) && Math.abs(p.year_built! - comparable.year_built!) <= 3);
  const from = classPeers.filter(p => p.class_code === comparable.class_code).map(p => unitValue(p)!);
  const to = classPeers.filter(p => p.class_code === subject.class_code).map(p => unitValue(p)!);
  const ratio = from.length >= 5 && to.length >= 5 ? median(to)! / median(from)! : null;
  return { ageRate, ageCount: used.size, classRatio: ratio !== null && ratio >= 0.5 && ratio <= 2 ? ratio : null, classCount: from.length + to.length };
}

export function propertyAdjustments(subject: ComparisonProperty, comparable: ComparisonProperty, peers: ComparisonProperty[] = []) {
  const land = validValue(subject.land_value) && validValue(comparable.land_value)
    ? money(subject.land_value - comparable.land_value) : null;
  const rate = unitValue(comparable);
  const usableArea = validValue(subject.living_area) && subject.living_area > 0 && subject.main_buildings === 1;
  const size = rate !== null && usableArea ? money((subject.living_area! - comparable.living_area!) * rate) : null;
  const base = rate !== null && usableArea ? rate * subject.living_area! : null;
  const local = localRates(subject, comparable, peers);
  const sameClass = known(subject.class_code) && subject.class_code === comparable.class_code;
  const sameYear = validYear(subject.year_built) && subject.year_built === comparable.year_built;
  const sameNeighborhood = known(subject.neighborhood) && subject.neighborhood === comparable.neighborhood;
  const classRatio = sameClass ? 1 : known(subject.class_code) && known(comparable.class_code) ? local.classRatio : null;
  const classAmount = classRatio !== null && base !== null ? money(base * (classRatio - 1)) : null;
  const yearRatio = sameYear ? 1 : validYear(subject.year_built) && validYear(comparable.year_built) && local.ageRate !== null
    && Math.abs(subject.year_built! - comparable.year_built!) <= 30 ? Math.exp(local.ageRate * (subject.year_built! - comparable.year_built!)) : null;
  const yearAmount = yearRatio !== null && yearRatio >= 0.5 && yearRatio <= 2 && classRatio !== null && base !== null
    ? money(base * classRatio * (yearRatio - 1)) : null;
  const lines: AdjustmentLine[] = [
    { factor: "Land", amount: land,
      explanation: land === null ? "A reported land value is needed for both properties." : "Your land value minus the comparable’s land value.",
      inputs: [{ label: "Your land value", value: subject.land_value }, { label: "Comparable land value", value: comparable.land_value }] },
    { factor: "Living area", amount: size,
      explanation: "Living-area difference × the comparable’s assessed non-land value per square foot. This blended rate includes buildings and other improvements.",
      inputs: [{ label: "Your living area (sq ft)", value: subject.living_area, unit: "number" }, { label: "Comparable living area (sq ft)", value: comparable.living_area, unit: "number" }, { label: "Estimated value per sq ft", value: rate === null ? null : `$${rate.toFixed(2)}` }] },
    { factor: "Construction class", amount: classAmount,
      explanation: sameClass ? "Same reported class; assume no class adjustment." : classRatio !== null ? "Size-normalized improvement value × the class-rate difference, estimated from similar-size local homes built within three years of the comparable." : "The class difference needs at least five similar local homes in each class to estimate a rate.",
      inputs: [{ label: "Your class", value: subject.class_code }, { label: "Comparable class", value: comparable.class_code }, ...(!sameClass && classRatio !== null ? [{ label: "Peer properties", value: local.classCount, unit: "number" as const }, { label: "Class multiplier", value: classRatio.toFixed(3) }] : [])] },
    { factor: "Year built", amount: yearAmount,
      explanation: sameYear ? "Same reported year built; assume no age adjustment." : yearAmount !== null ? "Apply the local year-built trend to the size- and class-adjusted improvement value. The trend uses same-class homes of similar size; it is an age proxy, not a condition inspection." : "Not enough comparable local age data to price this difference. A year-built trend requires at least eight independent homes.",
      inputs: [{ label: "Your year built", value: subject.year_built, unit: "year" }, { label: "Comparable year built", value: comparable.year_built, unit: "year" }, ...(!sameYear && yearAmount !== null ? [{ label: "Peer properties", value: local.ageCount, unit: "number" as const }, { label: "Estimated change per newer year", value: `${((Math.exp(local.ageRate!) - 1) * 100).toFixed(2)}%` }] : [])] },
    { factor: "Non-living details", amount: 0, explanation: "No separate adjustment assumed. Garages and other non-living space remain in the blended improvement value; their individual differences are not priced.", inputs: [] },
    { factor: "Additional improvements", amount: 0, explanation: "No separate adjustment assumed. Pools, outbuildings, renovations, and condition differences are not separately priced; unreported features are not treated as absent.", inputs: [] },
    { factor: "Neighborhood", amount: sameNeighborhood ? 0 : null, explanation: sameNeighborhood ? "Same reported market area; assume no separate neighborhood adjustment. Lot and location differences may remain." : "Different or unreported market areas need a supported location factor. Select a property in the same market area for an estimate.", inputs: [{ label: "Your market area", value: subject.neighborhood }, { label: "Comparable market area", value: comparable.neighborhood }] },
  ];
  const totals = totalAdjustments(comparable.market_value, lines);
  const compatible = subject.property_type === comparable.property_type && sameNeighborhood;
  const knownTotal = money(lines.reduce((sum, line) => sum + (line.amount ?? 0), 0));
  const subtotal = validValue(comparable.market_value) ? money(comparable.market_value + knownTotal) : null;
  return {
    property: comparable, lines, ...(compatible ? totals : {total: null, adjustedValue: null}),
    partialSubtotal: subtotal !== null && subtotal >= 0 && Number.isFinite(subtotal) ? subtotal : null,
    landSubtotal: validValue(comparable.market_value) && land !== null && comparable.market_value + land >= 0 ? money(comparable.market_value + land) : null,
  };
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
