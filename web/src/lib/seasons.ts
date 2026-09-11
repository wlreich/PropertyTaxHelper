export const phases = ["preliminary", "protest", "post"] as const;
export type Phase = (typeof phases)[number];
export const phaseNames: Record<Phase, string> = {
  preliminary: "Preliminary protest season",
  protest: "Protest season",
  post: "Post-protest season",
};
export type Season = {
  county: string;
  tax_year: number;
  starts_on: string | null;
  filing_deadline: string | null;
  post_starts_on: string | null;
  deadline_source: string | null;
  verified_on: string | null;
  mode: "automatic" | "manual";
  manual_phase: Phase | null;
  published: boolean;
  revision: number;
};
export type SeasonContext = { config: Season; phase: Phase };
export function countyToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function officialSource(value: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && ["traviscad.org", "www.traviscad.org", "comptroller.texas.gov"].includes(url.hostname) && !url.username && !url.password && !url.port;
  } catch { return false; }
}
export function seasonProblems(s: Season, today = countyToday()) {
  const errors: string[] = [];
  if (s.county !== "travis" || !Number.isInteger(s.tax_year) || s.tax_year < 1900 || s.tax_year > 2200) errors.push("Choose Travis County and a valid tax year.");
  if (!["automatic", "manual"].includes(s.mode)) errors.push("Choose a transition mode.");
  for (const date of [s.starts_on, s.filing_deadline, s.post_starts_on, s.verified_on]) if (date !== null && !validDate(date)) errors.push("Enter valid calendar dates.");
  if (s.starts_on && Number(s.starts_on.slice(0, 4)) !== s.tax_year) errors.push("The season must start in its tax year.");
  if (s.starts_on && s.filing_deadline && s.starts_on > s.filing_deadline) errors.push("The filing deadline must follow the assessment release.");
  if (s.filing_deadline && s.post_starts_on && s.filing_deadline >= s.post_starts_on) errors.push("Post-season must start after the filing deadline.");
  if (s.verified_on && s.verified_on > today) errors.push("The verification date cannot be in the future.");
  if (s.deadline_source && !officialSource(s.deadline_source)) errors.push("Use an official TCAD or Texas Comptroller source link.");
  if (s.published) {
    if (!s.starts_on) errors.push("Set the date this season begins before publishing.");
    if (s.mode === "automatic" && (!s.filing_deadline || !s.post_starts_on || !s.deadline_source || !s.verified_on)) errors.push("Automatic transitions need all phase dates and a verified deadline source.");
    if (s.mode === "manual" && !phases.includes(s.manual_phase as Phase)) errors.push("Choose the manual phase.");
    if (s.filing_deadline && (!s.deadline_source || !s.verified_on)) errors.push("Verify the deadline source before publishing it.");
  }
  return errors;
}
export function phaseOn(s: Season, today = countyToday()): Phase | null {
  if (!s.published || seasonProblems(s, today).length || !s.starts_on || today < s.starts_on) return null;
  if (s.mode === "manual") return s.manual_phase;
  if (today >= s.post_starts_on!) return "post";
  // The filing day itself is included; transition at midnight in the county timezone.
  return today > s.filing_deadline! ? "protest" : "preliminary";
}
export function activeSeason(configs: Season[], today = countyToday()): SeasonContext | null {
  for (const config of [...configs].sort((a, b) => b.tax_year - a.tax_year)) {
    const phase = phaseOn(config, today);
    if (phase) return { config, phase };
  }
  return null;
}
export function parseSeasons(value: unknown): Season[] | null {
  if (!Array.isArray(value) || value.length > 301) return null;
  const result: Season[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const s = item as Season;
    if (typeof s.published !== "boolean" || !Number.isInteger(s.revision) || s.revision < 0 ||
      ![null, ...phases].includes(s.manual_phase) ||
      ![s.starts_on, s.filing_deadline, s.post_starts_on, s.deadline_source, s.verified_on].every(v => v === null || typeof v === "string") || seasonProblems(s).length) return null;
    result.push({ county:s.county, tax_year:s.tax_year, starts_on:s.starts_on, filing_deadline:s.filing_deadline, post_starts_on:s.post_starts_on, deadline_source:s.deadline_source, verified_on:s.verified_on, mode:s.mode, manual_phase:s.manual_phase, published:s.published, revision:s.revision });
  }
  return result;
}
