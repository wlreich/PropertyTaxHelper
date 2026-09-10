import { TermDefinition } from "./term-definition";
import { currency } from "@/lib/property-search";
import {
  constructionClasses,
  entityDisplayName,
  annualBaseline,
  preliminaryBaseline,
  comparison,
  dateLabel,
  snapshotLabel,
  componentKey,
  matchComponent,
  componentName,
  exemptionName,
  propertyFacts,
  type Snapshot,
  type Entity,
} from "@/lib/property-history";
import type { Property } from "@/lib/supabase/properties";

type Change = ReturnType<typeof comparison>;
function ChangeLabel({
  change,
  suffix = "",
}: {
  change: Change;
  suffix?: string;
}) {
  if (!change)
    return <span className="overview-muted">Comparison unavailable</span>;
  const sign = change.dollars > 0 ? "+" : change.dollars < 0 ? "−" : "";
  return (
    <span
      className={
        change.significant ? "overview-change-attention" : "overview-muted"
      }
    >
      {sign}
      {currency(Math.abs(change.dollars))}
      {change.percent !== null
        ? ` (${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%)`
        : ""}
      {suffix}
    </span>
  );
}
const amount = (n: number | null | undefined, unit = "") =>
  n == null
    ? "Not reported"
    : `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}${unit}`;
function Metric({
  title,
  help,
  value,
  change,
  year,
}: {
  title: string;
  help: string;
  value: number | null;
  change: Change;
  year?: number;
}) {
  return (
    <div
      className={`overview-metric${change?.significant ? " overview-metric-attention" : ""}`}
    >
      <dt>
        <TermDefinition term={title}>{help}</TermDefinition>
      </dt>
      <dd className="overview-number">{currency(value)}</dd>
      <dd className="overview-metric-change">
        <ChangeLabel change={change} suffix={year ? ` vs. ${year}` : ""} />
      </dd>
    </div>
  );
}
const fieldHelp = {
  market:
    "TCAD’s reported market value for this snapshot. It is not a tax bill or an independent sale-price estimate.",
  cap: "The assessed amount reported after the appraisal cap, before the taxing entity’s exemptions. It is distinct from taxable value.",
  taxable:
    "The amount remaining after this taxing entity’s applicable reductions and exemptions. Each taxing entity can have a different taxable value. This is not your tax bill.",
};
function EntityExemptions({ entity }: { entity: Entity }) {
  const entries = Object.entries(entity.exemptions);
  return entries.length ? (
    <ul className="overview-exemption-amounts">
      {entries.map(([code, value]) => (
        <li key={code}>
          <span>{code}</span> {currency(value)}
        </li>
      ))}
    </ul>
  ) : (
    <>None recorded</>
  );
}
export function PropertyOverview({
  property: p,
  snapshots,
  historyUnavailable,
}: {
  property: Property;
  snapshots: Snapshot[];
  historyUnavailable: boolean;
}) {
  // Never substitute a different release for the active property profile.
  const current = snapshots.find(
    (s) =>
      s.tax_year === p.tax_year &&
      s.roll_stage === p.roll_stage &&
      s.export_time_raw === p.export_time_raw,
  );
  const previous = current ? annualBaseline(snapshots, current) : undefined;
  const initial = current ? preliminaryBaseline(snapshots, current) : undefined;
  const facts = propertyFacts(current);
  const entity =
    current?.entities.find((e) => /\bISD\b|SCHOOL/i.test(e.name)) ??
    current?.entities[0];
  const priorEntity = previous?.entities.find((e) => e.code === entity?.code);
  const initialEntity = initial?.entities.find((e) => e.code === entity?.code);
  const marketChange = comparison(previous?.market_value, p.market_value);
  const capChange = comparison(previous?.assessed_value, p.assessed_value);
  const taxChange = comparison(
    priorEntity?.taxable_value,
    entity?.taxable_value,
  );
  const withinMarket = comparison(initial?.market_value, current?.market_value);
  const withinTax = comparison(
    initialEntity?.taxable_value,
    entity?.taxable_value,
  );
  const highlight = withinMarket?.significant
    ? { change: withinMarket, label: "Market value" }
    : withinTax?.significant
      ? {
          change: withinTax,
          label: `${entity ? entityDisplayName(entity) : ""} taxable value`,
        }
      : null;
  const yearsWithProtest = [
    ...new Set(
      snapshots
        .filter((s) => s.protest_flag || s.arb_case_listed)
        .map((s) => s.tax_year),
    ),
  ];
  const dated = snapshots.filter((s) => s.export_date);
  const featureSnapshots = current
    ? dated.filter((s) => s.tax_year <= current.tax_year)
    : [];
  const featureMap = new Map<string, Snapshot["components"][number]>();
  for (const s of featureSnapshots)
    for (const c of s.components) {
      // Floor/room counts belong in property facts. Include separately valued features, even ones absent now.
      if (!["1ST", "2ND", "3RD", "250", "251", "252"].includes(c.code))
        featureMap.set(componentKey(c), c);
    }
  const features = [...featureMap.values()].sort((a, b) => {
    const rank = (c: typeof a) => (/POOL|SPA/i.test(c.description) ? 0 : 1);
    return (
      rank(a) - rank(b) ||
      componentName(a).localeCompare(componentName(b)) ||
      (a.area ?? 0) - (b.area ?? 0)
    );
  });
  const exemptionCodes = [
    ...new Set([
      ...(current?.exemptions ?? []),
      ...(current?.entities.flatMap((e) => Object.keys(e.exemptions)) ?? []),
    ]),
  ];
  const hasSources = current !== undefined;
  return (
    <>
      <div className="profile-heading overview-heading">
        <div>
          <p className="eyebrow">TCAD PROPERTY {p.property_id}</p>
          <h1>{p.address}</h1>
          <p>{[p.city, p.postal_code].filter(Boolean).join(", ")}</p>
        </div>
        <div className="overview-release">
          <span className="release-badge">
            {p.tax_year} {p.roll_stage} snapshot
          </span>
          <p>
            {current?.export_date
              ? `Exported ${dateLabel(current.export_date)}`
              : (p.export_time_raw ?? "Export date not reported")}
          </p>
        </div>
      </div>
      {p.values_under_review && (
        <div className="notice">
          <h2>Some values need further review</h2>
          <p>
            Shared ownership or differing source values prevent reliable
            comparisons. Unreconciled amounts are withheld.
          </p>
        </div>
      )}
      <div className="overview-layout">
        <aside
          className="overview-sidebar"
          aria-labelledby="property-facts-heading"
        >
          <h2 id="property-facts-heading">Your property</h2>
          <p className="eyebrow">RECORDED FACTS</p>
          <dl className="overview-facts">
            {[
              ["Living area", amount(facts.livingArea, " sq ft")],
              ["Lot size", amount(p.land_acres, " acres")],
              ["Year built", facts.yearBuilt ?? "Not reported"],
              ["Bedrooms", amount(facts.bedrooms)],
              ["Full bathrooms", amount(facts.fullBaths)],
              ["Half bathrooms", amount(facts.halfBaths)],
              ["Attached garage", amount(facts.garage, " sq ft")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <section>
            <h3>Neighborhood</h3>
            <p className="overview-code">
              {current?.neighborhood ?? "Not reported"}
            </p>
            <p>
              TCAD studies value patterns within neighborhood groups.
              Neighborhood market adjustments affect improvement values.
            </p>
            <p>
              Start comparisons here, then match the size, age and construction
              of the homes.
            </p>
            <a href="https://traviscad.org/wp-content/uploads/2026_Mass-Appraisal-Report.pdf">
              TCAD appraisal methodology ↗
            </a>
          </section>
          <section>
            <h3>Construction class</h3>
            <p className="overview-code">{facts.classCode ?? "Not reported"}</p>
            {facts.classCode && constructionClasses[facts.classCode] && (
              <p>{constructionClasses[facts.classCode]}</p>
            )}
            <p>
              Construction quality is separate from current condition. Multiple
              structures may have different classes.
            </p>
            <a href="https://traviscad.org/wp-content/uploads/Single-Family-Construction.pdf">
              TCAD class definitions ↗
            </a>
          </section>
          <section>
            <h3>Protest evidence</h3>
            <p className="overview-evidence">
              {yearsWithProtest.length
                ? `Protest evidence recorded for ${yearsWithProtest.join(", ")}.`
                : hasSources
                  ? "No protest indication in the available snapshots."
                  : "Protest information unavailable."}
            </p>
            <p>
              This does not establish that no protest was filed. ARB files
              describe active cases at export time.
            </p>
            <p>
              <strong>ARB correspondence agent</strong>
              <br />
              {!current
                ? "Not available"
                : current.arb_agent_listed
                  ? "Agent listed in this snapshot"
                  : "None linked in this snapshot"}
            </p>
            {yearsWithProtest.length > 0 && (
              <p>
                A filing flag or listed ARB case is historical evidence; it does
                not establish an active case today.
              </p>
            )}
          </section>
          <p className="overview-sidebar-source">
            {snapshots.length} available{" "}
            {snapshots.length === 1 ? "snapshot" : "snapshots"}
          </p>
        </aside>
        <div className="overview-content">
          <section aria-label="Primary assessment values">
            <dl className="overview-metrics">
              <Metric
                title="TCAD market value"
                help={fieldHelp.market}
                value={p.market_value}
                change={marketChange}
                year={previous?.tax_year}
              />
              <Metric
                title="Value after appraisal cap"
                help={fieldHelp.cap}
                value={p.assessed_value}
                change={capChange}
                year={previous?.tax_year}
              />
              <Metric
                title={
                  entity
                    ? `Taxable value · ${entityDisplayName(entity)}`
                    : "Taxable value"
                }
                help={fieldHelp.taxable}
                value={entity?.taxable_value ?? null}
                change={taxChange}
                year={previous?.tax_year}
              />
            </dl>
          </section>
          {highlight && initial && current && (
            <section
              className="overview-insight"
              aria-labelledby="change-heading"
            >
              <h2 id="change-heading">
                A substantial change within {current.tax_year}
              </h2>
              <p className="overview-insight-lead">
                {highlight.label}{" "}
                {highlight.change.dollars < 0 ? "fell" : "rose"}{" "}
                {currency(Math.abs(highlight.change.dollars))}
                {highlight.change.percent !== null
                  ? ` (${Math.abs(highlight.change.percent).toFixed(1)}%)`
                  : ""}{" "}
                from {dateLabel(initial.export_date)} to{" "}
                {dateLabel(current.export_date)}.
              </p>
              {withinTax && withinMarket?.significant && entity && (
                <p>
                  {entityDisplayName(entity)} taxable value changed{" "}
                  <ChangeLabel change={withinTax} /> over the same period.
                </p>
              )}
              <p>
                The exports show the changes but do not establish their cause.
              </p>
            </section>
          )}
          <p className="overview-attention-key">
            <TermDefinition term="About highlighted changes">
              A change is highlighted at $25,000 or more, or at least 10% and
              $10,000. This is a review threshold, not a finding of an appraisal
              error. Percentages are unavailable when the earlier value is zero.
            </TermDefinition>
          </p>
          {!current && (
            <div className="notice">
              <h2>
                {historyUnavailable
                  ? "Snapshot comparisons are temporarily unavailable"
                  : "More comparison data needed"}
              </h2>
              <p>
                {historyUnavailable
                  ? "The current property values are shown above. Try again in a few minutes for history and detailed records."
                  : "Detailed comparisons for this record have not been published or are withheld because the source cannot be reconciled safely."}
              </p>
            </div>
          )}
          <section
            className="overview-section"
            aria-labelledby="history-heading"
          >
            <div className="section-heading">
              <h2 id="history-heading">Assessment history</h2>
            </div>
            {snapshots.length ? (
              <div className="overview-table-wrap">
                <table className="overview-table">
                  <caption>Values as recorded in each TCAD export</caption>
                  <thead>
                    <tr>
                      <th scope="col">Value</th>
                      {snapshots.map((s) => (
                        <th key={s.dataset_id} scope="col">
                          {snapshotLabel(s)}
                          <span>{dateLabel(s.export_date)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        "market_value",
                        "assessed_value",
                        "land_value",
                        "improvement_value",
                      ] as const
                    ).map((key, i) => (
                      <tr
                        key={key}
                        className={
                          i === 0 ? "overview-row-highlight" : undefined
                        }
                      >
                        <th scope="row">
                          {
                            [
                              "Market value",
                              "Value after cap",
                              "Land value",
                              "Improvement value",
                            ][i]
                          }
                        </th>
                        {snapshots.map((s) => (
                          <td
                            key={s.dataset_id}
                            data-label={`${snapshotLabel(s)} · ${dateLabel(s.export_date)}`}
                          >
                            {currency(s[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {entity && (
                      <tr>
                        <th scope="row">
                          Taxable · {entityDisplayName(entity)}
                        </th>
                        {snapshots.map((s) => (
                          <td
                            key={s.dataset_id}
                            data-label={`${snapshotLabel(s)} · ${dateLabel(s.export_date)}`}
                          >
                            {currency(
                              s.entities.find((e) => e.code === entity.code)
                                ?.taxable_value ?? null,
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No comparable snapshots available.</p>
            )}
          </section>
          <section
            className="overview-section"
            aria-labelledby="features-heading"
          >
            <h2 id="features-heading">Separately valued features</h2>
            <p className="overview-muted">
              Pool, spa and other improvement details recorded by TCAD.
            </p>
            {features.length ? (
              <>
                <div className="overview-table-wrap">
                  <table className="overview-table overview-components">
                    <caption>
                      Feature details matched by type and recorded area or
                      quantity
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Component</th>
                        {featureSnapshots.map((s) => (
                          <th key={s.dataset_id} scope="col">
                            {snapshotLabel(s)}
                            <span>{dateLabel(s.export_date)}</span>
                          </th>
                        ))}
                        <th scope="col">
                          Annual change
                          <span>
                            {previous
                              ? `${previous.tax_year} certified to ${current?.tax_year} ${current?.roll_stage}`
                              : "Prior certified year unavailable"}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((c) => {
                        const now = current ? matchComponent(current, c) : null,
                          old = previous ? matchComponent(previous, c) : null;
                        return (
                          <tr
                            key={componentKey(c)}
                            className={
                              current && !now
                                ? "overview-row-highlight"
                                : undefined
                            }
                          >
                            <th scope="row">
                              {componentName(c)}
                              {["011", "041"].includes(c.code) &&
                                c.area !== null && (
                                  <span>{amount(c.area, " sq ft")}</span>
                                )}
                            </th>
                            {featureSnapshots.map((s) => {
                              const list = s.components.filter(
                                (x) => componentKey(x) === componentKey(c),
                              );
                              return (
                                <td
                                  key={s.dataset_id}
                                  data-label={`${snapshotLabel(s)} · ${dateLabel(s.export_date)}`}
                                >
                                  {list.length === 0
                                    ? "Not listed"
                                    : list.length > 1
                                      ? "Multiple details; comparison withheld"
                                      : currency(list[0].value)}
                                </td>
                              );
                            })}
                            <td data-label="Annual change">
                              {!now ? (
                                "Not listed / not comparable"
                              ) : (
                                <ChangeLabel
                                  change={comparison(old?.value, now.value)}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="overview-note">
                  A missing detail is not a zero-dollar valuation or proof of
                  physical removal. Detail values may not reconcile to the main
                  improvement total; amounts are shown as recorded. Changed
                  areas or quantities appear separately.
                </p>
              </>
            ) : (
              <p>No comparable feature details available.</p>
            )}
          </section>
          <section
            className="overview-section"
            aria-labelledby="exemptions-heading"
          >
            <div className="section-heading">
              <h2 id="exemptions-heading">Exemptions & taxable values</h2>
              {current && (
                <span className="release-badge">
                  {exemptionCodes.length}{" "}
                  {exemptionCodes.length === 1 ? "exemption" : "exemptions"}{" "}
                  listed
                </span>
              )}
            </div>
            {exemptionCodes.length ? (
              <ul className="overview-exemptions">
                {exemptionCodes.map((code) => (
                  <li key={code}>
                    <TermDefinition term={`${exemptionName(code)} (${code})`}>
                      An exemption recorded in this TCAD snapshot. Its effect
                      can differ by taxing entity; amounts below are reductions
                      in taxable value, not tax savings.
                    </TermDefinition>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {current
                  ? "No exemptions listed in this snapshot."
                  : "Exemption information unavailable."}
              </p>
            )}
            {current && current.entities.length > 0 && (
              <div className="overview-table-wrap">
                <table className="overview-table">
                  <caption>
                    {snapshotLabel(current)} · {dateLabel(current.export_date)}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Taxing entity</th>
                      <th scope="col">Exemption amounts</th>
                      <th scope="col">Taxable value</th>
                      <th scope="col">
                        Change vs. {previous?.tax_year ?? "prior year"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.entities.map((e) => (
                      <tr key={e.code}>
                        <th scope="row">{entityDisplayName(e)}</th>
                        <td data-label="Exemption amounts">
                          <EntityExemptions entity={e} />
                        </td>
                        <td data-label="Taxable value">
                          {currency(e.taxable_value)}
                        </td>
                        <td
                          data-label={`Change vs. ${previous?.tax_year ?? "prior year"}`}
                        >
                          <ChangeLabel
                            change={comparison(
                              previous?.entities.find((x) => x.code === e.code)
                                ?.taxable_value,
                              e.taxable_value,
                            )}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="overview-note">
              Each entity has its own taxable value. These are tax bases, not
              tax bills. Exemptions and amounts reflect the dated exports.
            </p>
          </section>
          <section className="overview-source">
            <h2>A record with a date</h2>
            <p>
              Later corrections may appear in TCAD’s live records. Export times
              are shown as supplied without an assumed timezone. Only available,
              comparable snapshots are shown; missing records are not treated as
              zero.
            </p>
            <a href="https://traviscad.org/propertysearch/">
              Check TCAD’s current records ↗
            </a>
            <span> · </span>
            <a href={p.source_url}>TCAD source ↗</a>
          </section>
        </div>
      </div>
    </>
  );
}
