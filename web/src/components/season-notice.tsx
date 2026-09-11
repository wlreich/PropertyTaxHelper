import { dateLabel, type Snapshot, type ProtestObservation } from "@/lib/property-history";
import { phaseNames, validDate, officialSource, type SeasonContext } from "@/lib/seasons";

export function SeasonNotice({ season, current, recordYear, evidence = [] }: { season: SeasonContext | null; current?: Snapshot; recordYear?: number; evidence?: ProtestObservation[] }) {
  if (!season) return <p className="overview-note">Season guidance is unavailable. The dated property records below remain available. <a href="https://traviscad.org/protests">Check TCAD for current filing information.</a></p>;
  const { config, phase } = season;
  const sameYear = (current?.tax_year ?? recordYear) === config.tax_year;
  const protest = evidence.some(s => s.tax_year === config.tax_year && (s.protest_flag || s.arb_case_listed));
  const headings = { preliminary: "Understand the proposed value before deciding your next step", protest: "Follow the available records and prepare your evidence", post: "Review the result and what changed" };
  return <section className="season-notice" aria-labelledby="season-heading">
    <p className="eyebrow">{config.tax_year} · {phaseNames[phase]}</p>
    <h2 id="season-heading">{headings[phase]}</h2>
    <p>{phase === "preliminary" ? "Compare this year’s proposed value with last year’s certified value. Check the property details and supporting comparisons, whether you prepare your own protest or work with an agent."
      : phase === "protest" ? "The general filing window has closed. Hearings and decisions are underway; individual cases may be at different stages."
      : "Compare the proposed and certified values, review the recorded agent, and keep useful evidence for next year. The county’s season does not establish that every individual case is resolved."}</p>
    {!sameYear && <p><strong>{config.tax_year} values are not available for this property yet.</strong> The latest published record below is {current ? `from ${current.tax_year}` : "shown with its source date"}.</p>}
    {phase !== "post" && <p>{protest ? `A protest is recorded for ${config.tax_year}. The available records do not establish its current hearing or decision status.` : `No protest is identified in the available ${config.tax_year} records. That does not establish whether you have filed.`}</p>}
    {sameYear && phase !== "preliminary" && current?.roll_stage === "preliminary" && <p><strong>No certified result is available for this property yet.</strong> A missing update is not an unsuccessful protest.</p>}
    {validDate(config.filing_deadline) && officialSource(config.deadline_source) && validDate(config.verified_on) && <p>General filing deadline: <strong>{dateLabel(config.filing_deadline)}</strong>. <a href={config.deadline_source!}>Official deadline information</a> · verified {dateLabel(config.verified_on)}. Check your notice for the deadline that applies to your property.</p>}
    {!config.filing_deadline && <p><a href="https://traviscad.org/protests">Check TCAD’s current protest information</a> for filing requirements and your next steps.</p>}
    {phase === "protest" && <a href="#next-heading">Review preparation steps</a>}
  </section>;
}
