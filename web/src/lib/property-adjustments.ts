import type { ComparisonProperty } from "./property-comparisons.ts";
import { comparisonSummary } from "./property-comparisons.ts";

export const adjustmentFactors = [
  "Land", "Living area", "Construction class", "Depreciation",
  "Non-living details", "Additional improvements", "Neighborhood",
] as const;
export type AdjustmentFactor = typeof adjustmentFactors[number];
export type AdjustmentLine = {
  factor: AdjustmentFactor;
  amount: number | null;
  explanation: string;
  inputs: { label: string; value: number | null }[];
};
const validValue = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0;
const money = (value: number) => Math.round(value * 100) / 100;

// Only a complete, finite set of applicable factors can produce a final estimate.
// Explicit zero is a calculated adjustment; missing factors are never zero.
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

export function propertyAdjustments(subject: ComparisonProperty, comparable: ComparisonProperty) {
  const land = validValue(subject.land_value) && validValue(comparable.land_value)
    ? money(subject.land_value - comparable.land_value) : null;
  const lines: AdjustmentLine[] = [
    { factor: "Land", amount: land,
      explanation: land === null ? "Land value is missing for your property or this comparable." : "Your land value minus the comparable’s land value.",
      inputs: [{ label: "Your land value", value: subject.land_value }, { label: "Comparable land value", value: comparable.land_value }] },
    { factor: "Living area", amount: null, explanation: "Replacement-cost and applicable depreciation inputs are not available. Square footage alone does not determine the dollar adjustment.", inputs: [] },
    { factor: "Construction class", amount: null, explanation: "The class cost inputs are not available. A matching class code alone does not establish a zero adjustment.", inputs: [] },
    { factor: "Depreciation", amount: null, explanation: "TCAD’s applicable depreciation inputs are not available. Year built is not a substitute.", inputs: [] },
    { factor: "Non-living details", amount: null, explanation: "The required detail-level costs and depreciation for non-living features are not available.", inputs: [] },
    { factor: "Additional improvements", amount: null, explanation: "The required improvement costs and depreciation are not available. Missing feature records do not establish that there are no features.", inputs: [] },
    { factor: "Neighborhood", amount: null, explanation: "The applicable neighborhood adjustment factors are not available. A matching market area alone does not establish a zero adjustment.", inputs: [] },
  ];
  const subtotal = validValue(comparable.market_value) && land !== null ? money(comparable.market_value + land) : null;
  return {
    property: comparable, lines, ...totalAdjustments(comparable.market_value, lines),
    landSubtotal: subtotal !== null && subtotal >= 0 && Number.isFinite(subtotal) ? subtotal : null,
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
