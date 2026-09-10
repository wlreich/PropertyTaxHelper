// Curated snapshot contract and deterministic comparison rules; no credentials.
export type Component = {
  id: string | null;
  improvement_id: string | null;
  code: string;
  description: string;
  class_code: string | null;
  year_built: number | null;
  area: number | null;
  value: number | null;
};
export type Entity = {
  code: string;
  name: string;
  taxable_value: number | null;
  exemptions: Record<string, number>;
};
export type Snapshot = {
  dataset_id: string;
  tax_year: number;
  roll_stage: string;
  export_date: string | null;
  export_time_raw: string | null;
  market_value: number | null;
  assessed_value: number | null;
  land_value: number | null;
  improvement_value: number | null;
  land_acres: number | null;
  neighborhood: string | null;
  protest_flag: boolean | null;
  arb_case_listed: boolean;
  arb_agent_listed: boolean;
  exemptions: string[];
  components: Component[];
  entities: Entity[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const amount = (v: unknown) => v === null || number(v);
const nullableText = (v: unknown) => v === null || typeof v === "string";
export function parseHistory(value: unknown): Snapshot[] | null {
  if (
    !object(value) ||
    !Array.isArray(value.snapshots) ||
    value.snapshots.length > 100
  )
    return null;
  const output: Snapshot[] = [];
  for (const s of value.snapshots) {
    if (
      !object(s) ||
      typeof s.dataset_id !== "string" ||
      !Number.isInteger(s.tax_year) ||
      Number(s.tax_year) < 1900 ||
      Number(s.tax_year) > 2200 ||
      !["certified", "preliminary", "supplemental"].includes(
        String(s.roll_stage),
      ) ||
      !nullableText(s.export_time_raw) ||
      !(
        s.export_date === null ||
        (typeof s.export_date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(s.export_date))
      ) ||
      !nullableText(s.neighborhood) ||
      ![
        s.market_value,
        s.assessed_value,
        s.land_value,
        s.improvement_value,
        s.land_acres,
      ].every(amount) ||
      !(s.protest_flag === null || typeof s.protest_flag === "boolean") ||
      typeof s.arb_case_listed !== "boolean" ||
      typeof s.arb_agent_listed !== "boolean" ||
      !Array.isArray(s.exemptions) ||
      !s.exemptions.every((x: unknown) => typeof x === "string") ||
      !Array.isArray(s.components) ||
      s.components.length > 1000 ||
      !Array.isArray(s.entities) ||
      s.entities.length > 100
    )
      return null;
    const components: Component[] = [];
    for (const c of s.components) {
      if (
        !object(c) ||
        ![c.id, c.improvement_id, c.class_code].every(nullableText) ||
        typeof c.code !== "string" ||
        typeof c.description !== "string" ||
        ![c.year_built, c.area, c.value].every(amount)
      )
        return null;
      components.push({
        id: c.id as string | null,
        improvement_id: c.improvement_id as string | null,
        code: c.code,
        description: c.description,
        class_code: c.class_code as string | null,
        year_built: c.year_built as number | null,
        area: c.area as number | null,
        value: c.value as number | null,
      });
    }
    const entities: Entity[] = [];
    for (const e of s.entities) {
      if (
        !object(e) ||
        typeof e.code !== "string" ||
        typeof e.name !== "string" ||
        !amount(e.taxable_value) ||
        !object(e.exemptions) ||
        !Object.values(e.exemptions).every(number)
      )
        return null;
      entities.push({
        code: e.code,
        name: e.name,
        taxable_value: e.taxable_value as number | null,
        exemptions: Object.fromEntries(Object.entries(e.exemptions)) as Record<
          string,
          number
        >,
      });
    }
    if (new Set(entities.map((e) => e.code)).size !== entities.length)
      return null;
    output.push({
      dataset_id: s.dataset_id,
      tax_year: s.tax_year as number,
      roll_stage: s.roll_stage as string,
      export_date: s.export_date as string | null,
      export_time_raw: s.export_time_raw as string | null,
      market_value: s.market_value as number | null,
      assessed_value: s.assessed_value as number | null,
      land_value: s.land_value as number | null,
      improvement_value: s.improvement_value as number | null,
      land_acres: s.land_acres as number | null,
      neighborhood: s.neighborhood as string | null,
      protest_flag: s.protest_flag as boolean | null,
      arb_case_listed: s.arb_case_listed,
      arb_agent_listed: s.arb_agent_listed,
      exemptions: [...s.exemptions] as string[],
      components,
      entities,
    });
  }
  if (new Set(output.map((s) => s.dataset_id)).size !== output.length)
    return null;
  return output.sort(
    (a, b) =>
      a.tax_year - b.tax_year ||
      (a.export_date ?? "").localeCompare(b.export_date ?? "") ||
      a.dataset_id.localeCompare(b.dataset_id),
  );
}
export function comparison(
  before: number | null | undefined,
  after: number | null | undefined,
) {
  if (
    before == null ||
    after == null ||
    !Number.isFinite(before) ||
    !Number.isFinite(after)
  )
    return null;
  const dollars = after - before,
    percent = before > 0 ? (dollars / before) * 100 : null;
  // Product attention threshold, not statistical significance or evidence of an error.
  const significant =
    Math.abs(dollars) >= 25000 ||
    (percent !== null && Math.abs(percent) >= 10 && Math.abs(dollars) >= 10000);
  return { dollars, percent, significant };
}
export function annualBaseline(snapshots: Snapshot[], current: Snapshot) {
  return snapshots
    .filter(
      (s) =>
        s.tax_year === current.tax_year - 1 &&
        s.roll_stage === "certified" &&
        s.export_date,
    )
    .at(-1);
}
export function preliminaryBaseline(snapshots: Snapshot[], current: Snapshot) {
  return snapshots.find(
    (s) =>
      s.tax_year === current.tax_year &&
      s.roll_stage === "preliminary" &&
      s.export_date &&
      current.export_date &&
      s.export_date < current.export_date,
  );
}
export const snapshotLabel = (s: Snapshot) => `${s.tax_year} ${s.roll_stage}`;
export function dateLabel(date: string | null) {
  if (!date) return "Export date not reported";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
export function componentKey(c: Component) {
  return `${c.code}|${c.area ?? "unknown"}|${c.description}`;
}
export function matchComponent(snapshot: Snapshot, c: Component) {
  const matches = snapshot.components.filter(
    (x) => componentKey(x) === componentKey(c),
  );
  return matches.length === 1 ? matches[0] : null;
}
export function propertyFacts(s: Snapshot | undefined) {
  const components = s?.components ?? [];
  const floors = components.filter((c) =>
    ["1ST", "2ND", "3RD"].includes(c.code),
  );
  const oneBuilding =
    new Set(floors.map((c) => c.improvement_id)).size === 1 &&
    floors.every((c) => c.improvement_id !== null);
  const sum = (list: Component[]) =>
    list.length && list.every((c) => c.area !== null)
      ? list.reduce((a, c) => a + c.area!, 0)
      : null;
  const classes = [...new Set(floors.map((c) => c.class_code).filter(Boolean))];
  const years = [
    ...new Set(
      floors.map((c) => c.year_built).filter((y) => y !== null && y > 0),
    ),
  ];
  return {
    livingArea: oneBuilding ? sum(floors) : null,
    bedrooms: oneBuilding
      ? sum(components.filter((c) => c.code === "252"))
      : null,
    fullBaths: oneBuilding
      ? sum(components.filter((c) => c.code === "251"))
      : null,
    halfBaths: oneBuilding
      ? sum(components.filter((c) => c.code === "250"))
      : null,
    garage: oneBuilding
      ? sum(components.filter((c) => c.code === "041"))
      : null,
    classCode: classes.length === 1 ? classes[0] : null,
    yearBuilt: years.length === 1 ? years[0] : null,
  };
}
const exemptionNames: Record<string, string> = {
  HS: "Residence homestead",
  OV65: "Age 65 or older",
  OV65S: "Surviving spouse age 65 exemption",
  DP: "Disability",
  DPS: "Surviving spouse disability exemption",
  DV: "Disabled veteran",
  DV1: "Disabled veteran (DV1)",
  DV2: "Disabled veteran (DV2)",
  DV3: "Disabled veteran (DV3)",
  DV4: "Disabled veteran (DV4)",
  DVHS: "Disabled veteran homestead",
  DVHSS: "Surviving spouse veteran homestead",
  SO: "Solar or wind energy",
  EX: "Exempt property",
};
export const exemptionName = (code: string) =>
  exemptionNames[code] ?? `TCAD exemption ${code}`;
export function componentName(c: Component) {
  const names: Record<string, string> = {
    "604": "Concrete pool",
    "041": "Attached garage",
    "011": "Open porch",
    "522": "Fireplace",
    "095": "HVAC",
  };
  return (
    names[c.code] ??
    c.description.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

// Plain-language summaries of TCAD's published single-family construction guide.
export const constructionClasses: Record<string, string> = {
  R1: "Distinctive homes with exceptional craftsmanship, materials and architectural detail.",
  R2: "Custom or extensively customized homes with high-quality workmanship, finishes and detailing.",
  R3: "Higher-quality builder-plan homes with upgraded materials, finishes and detailing.",
  R4: "Homes using standard or modified plans, generally builder-grade materials and some possible upgrades.",
  R5: "Basic, economical homes with simple layouts, limited detailing and few upgrades.",
  R6: "Basic, low-cost construction with minimal systems; TCAD notes some structures in this class may be unsuitable for occupancy.",
};
export function entityDisplayName(entity: Entity) {
  const names: Record<string, string> = {
    "03": "Travis County",
    "2J": "Healthcare District",
    "6F": "City of Leander",
    "68": "Austin Community College",
    "69": "Leander ISD",
  };
  return names[entity.code] ?? entity.name;
}
