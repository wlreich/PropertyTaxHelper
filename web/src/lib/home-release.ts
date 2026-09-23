import type { Release } from "./supabase/properties";

export function homepageReleaseCopy(release: Release | null) {
  if (!release)
    return {
      heading: "Latest published assessment records are available",
      exportNote: null,
    };
  return {
    heading: `${release.tax_year} ${release.roll_stage} assessment records are available`,
    exportNote: release.export_time_raw
      ? `Appraisal District export: ${release.export_time_raw}`
      : "Export date not reported in this release.",
  };
}
