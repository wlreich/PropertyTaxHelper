// Synthetic values exercise the complete property page without committing homeowner records.
const component = (code, description, value, area = 1) => ({
  id: code,
  improvement_id: "1",
  code,
  description,
  class_code: "R3",
  year_built: 2014,
  area,
  value,
});
const base = {
  neighborhood: "TEST01",
  land_acres: 0.25,
  land_value: 100000,
  improvement_value: 350000,
  protest_flag: false,
  arb_case_listed: false,
  arb_agent_listed: false,
  exemptions: ["HS"],
  components: [
    component("1ST", "1st Floor", 200000, 1500),
    component("2ND", "2nd Floor", 80000, 500),
    component("252", "BEDROOMS", 0, 4),
    component("251", "BATHROOM", 0, 2),
    component("250", "HALF BATHROOM", 0, 1),
    component("604", "POOL RES CONC", 30000),
  ],
  entities: [
    {
      code: "69",
      name: "FIXTURE ISD",
      taxable_value: 320000,
      exemptions: { HS: 100000 },
    },
    {
      code: "03",
      name: "FIXTURE COUNTY",
      taxable_value: 380000,
      exemptions: { HS: 40000 },
    },
  ],
};
export const fixtureHistory = {
  snapshots: [
    {
      ...base,
      dataset_id: "old",
      tax_year: 2025,
      roll_stage: "certified",
      export_date: "2025-07-19",
      export_time_raw: "07/19/2025 20:02",
      market_value: 400000,
      assessed_value: 380000,
      components: [...base.components, component("605", "SPA CONCRETE", 14000)],
      entities: [
        { ...base.entities[0], taxable_value: 280000 },
        { ...base.entities[1], taxable_value: 340000 },
      ],
    },
    {
      ...base,
      dataset_id: "april",
      tax_year: 2026,
      roll_stage: "preliminary",
      export_date: "2026-04-02",
      export_time_raw: "04/02/2026 22:24",
      market_value: 550000,
      assessed_value: 500000,
      components: [...base.components, component("605", "SPA CONCRETE", 13000)],
    },
    {
      ...base,
      dataset_id: "latest",
      tax_year: 2026,
      roll_stage: "certified",
      export_date: "2026-07-18",
      export_time_raw: "07/18/2026 16:27",
      market_value: 450000,
      assessed_value: 420000,
    },
  ],
};
