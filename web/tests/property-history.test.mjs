import test from "node:test";
import assert from "node:assert/strict";
import {
  comparison,
  annualBaseline,
  preliminaryBaseline,
  parseHistory,
  propertyFacts,
  matchComponent,
} from "../src/lib/property-history.ts";
import { getPropertyHistory } from "../src/lib/supabase/properties.ts";
const sample = {
  dataset_id: "current",
  tax_year: 2026,
  roll_stage: "certified",
  export_date: "2026-07-18",
  export_time_raw: "07/18/2026 16:27",
  market_value: 1285275,
  assessed_value: 1285275,
  land_value: 357492,
  improvement_value: 927783,
  land_acres: 1.4309,
  neighborhood: "T2450",
  protest_flag: false,
  arb_case_listed: false,
  arb_agent_listed: false,
  exemptions: ["HS"],
  components: [],
  entities: [],
};
test("changes retain zero, missing, direction and distinct attention thresholds", () => {
  assert.equal(comparison(null, 10), null);
  assert.equal(comparison(undefined, 10), null);
  assert.deepEqual(comparison(0, 20000), {
    dollars: 20000,
    percent: null,
    significant: false,
  });
  assert.equal(comparison(100000, 0).percent, -100);
  const within = comparison(1611803, 1285275);
  assert.equal(within.dollars, -326528);
  assert.equal(within.percent.toFixed(1), "-20.3");
  assert.equal(within.significant, true);
  assert.equal(comparison(1230591, 1285275).dollars, 54684);
  assert.equal(comparison(10, 100).significant, false);
  assert.equal(comparison(1000000, 1025000).significant, true);
});
test("annual and within-year baselines do not mix years, stages or unknown dates", () => {
  const old = {
    ...sample,
    dataset_id: "old",
    tax_year: 2025,
    export_date: "2025-07-19",
  };
  const preliminary = {
    ...sample,
    dataset_id: "apr",
    roll_stage: "preliminary",
    export_date: "2026-04-02",
  };
  const list = [old, preliminary, sample];
  assert.equal(annualBaseline(list, sample), old);
  assert.equal(preliminaryBaseline(list, sample), preliminary);
  assert.equal(annualBaseline([{ ...old, tax_year: 2024 }], sample), undefined);
  assert.equal(
    preliminaryBaseline([{ ...preliminary, export_date: null }], sample),
    undefined,
  );
});
test("strict history allowlist strips raw fields and rejects malformed financial data", () => {
  const p = parseHistory({
    snapshots: [
      {
        ...sample,
        owner_name: "PRIVATE",
        entities: [
          {
            code: "69",
            name: "TEST ISD",
            taxable_value: 1145275,
            exemptions: { HS: 140000 },
            phone: "PRIVATE",
          },
        ],
      },
    ],
  });
  assert.ok(p);
  assert.ok(!JSON.stringify(p).includes("PRIVATE"));
  assert.equal(
    parseHistory({ snapshots: [{ ...sample, market_value: "1285275" }] }),
    null,
  );
  assert.equal(parseHistory({ snapshots: [sample, sample] }), null);
  assert.equal(parseHistory(null), null);
  assert.deepEqual(parseHistory({ snapshots: [] }), []);
});
test("facts use floor area rather than room quantities and withhold mixed buildings", () => {
  const c = (code, area, improvement_id = "1") => ({
    id: code,
    code,
    area,
    improvement_id,
    description: code,
    class_code: "R3",
    year_built: 2014,
    value: 0,
  });
  const s = {
    ...sample,
    components: [
      c("1ST", 2862),
      c("2ND", 1548),
      c("252", 4),
      c("250", 1),
      c("251", 4),
      c("604", 1),
    ],
  };
  assert.equal(propertyFacts(s).livingArea, 4410);
  assert.equal(propertyFacts(s).bedrooms, 4);
  assert.equal(
    propertyFacts({ ...s, components: [...s.components, c("1ST", 900, "2")] })
      .livingArea,
    null,
  );
  assert.equal(matchComponent(s, c("999", 1)), null);
  assert.equal(
    matchComponent(
      { ...s, components: [c("604", 1), c("604", 1)] },
      c("604", 1),
    ),
    null,
  );
});
test("history uses read-only RPC and cannot leak unlisted payload fields", async () => {
  const cfg = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  };
  let calls = 0;
  const transport = async (url, init) => {
    calls++;
    assert.match(String(url), /property_history/);
    assert.equal(init.method, "GET");
    return new Response(
      JSON.stringify({ snapshots: [{ ...sample, private_owner: "PRIVATE" }] }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  const r = await getPropertyHistory("736302", cfg, transport);
  assert.equal(r.status, "ok");
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(r).includes("PRIVATE"));
  assert.equal(
    (await getPropertyHistory("bad", cfg, transport)).status,
    "invalid",
  );
  assert.equal(calls, 1);
  assert.equal(
    (
      await getPropertyHistory(
        "736302",
        cfg,
        async () => new Response('{"snapshots":false}'),
      )
    ).status,
    "unavailable",
  );
});
