import assert from "node:assert/strict";
import test from "node:test";
import {
  searchProperties,
  getProperty,
} from "../src/lib/supabase/properties.ts";
import {
  parseSearch,
  normalizeAddress,
  resultsUrl,
  propertyUrl,
  currency,
} from "../src/lib/property-search.ts";
const config = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
};
const item = {
  property_id: "100",
  address: "123 N OAK ST",
  city: "FIXTURE CITY",
  postal_code: "78700",
  property_type: "R",
  market_value: 450000,
  values_under_review: false,
};
const release = {
  tax_year: 2026,
  roll_stage: "certified",
  export_time_raw: "07/18/2026 16:27",
};
const search = {
  available: true,
  ...release,
  items: [item],
  has_more: false,
  limit_reached: false,
};
const property = {
  ...item,
  ...release,
  appraised_value: 430000,
  assessed_value: 420000,
  land_value: 100000,
  improvement_value: 350000,
  land_acres: 0.25,
  source_record_count: 1,
  shared_ownership: false,
  improvement_records: 1,
  land_segments: 1,
  source_url: "https://traviscad.org/fixture.zip",
};

test("input validation supports partial addresses and bounds expensive queries", () => {
  assert.equal(parseSearch(" 123   Oak ").q, "123 Oak");
  for (const q of [
    "Oak",
    "123 Oak",
    "Congress",
    "000123",
    "123 N Main St Apt 2",
  ])
    assert.equal(parseSearch(q).error, null);
  for (const q of ["", "a", "%_", "North", "a ".repeat(9), "x".repeat(121)])
    assert.ok(parseSearch(q).error);
  assert.equal(parseSearch("Oak", "-1").page, 0);
  assert.equal(parseSearch("Oak", "999").page, 249);
  assert.equal(
    normalizeAddress("123 North O'Brien Road Apt. 2"),
    "123 N OBRIEN RD UNIT 2",
  );
});
test("result and back links encode user text and stay inside the site", () => {
  assert.equal(resultsUrl("Oak & Pine", 2), "/?q=Oak+%26+Pine&page=2");
  assert.equal(
    propertyUrl("100", "https://elsewhere.invalid", 0),
    "/property/100?q=https%3A%2F%2Felsewhere.invalid&page=0",
  );
  assert.equal(currency(0), "$0");
  assert.equal(currency(null), "Not reported");
});
test("valid search uses a read-only, uncached RPC and returns a strict field list", async () => {
  const r = await searchProperties("Oak", 1, config, async (input, init) => {
    const u = new URL(input);
    assert.equal(u.pathname, "/rest/v1/rpc/search_properties");
    assert.equal(u.searchParams.get("p_query"), "Oak");
    assert.equal(u.searchParams.get("p_page"), "1");
    assert.equal(init.method, "GET");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({
      ...search,
      items: [{ ...item, private_added_field: "do not pass through" }],
    });
  });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.data.items, [item]);
});
test("invalid searches, IDs and privileged configuration never make a request", async () => {
  const noRequest = async () => assert.fail("must not request");
  assert.equal(
    (await searchProperties("ab", 0, config, noRequest)).status,
    "invalid",
  );
  assert.equal(
    (await searchProperties("Oak", -1, config, noRequest)).status,
    "invalid",
  );
  assert.equal(
    (await getProperty("../x", config, noRequest)).status,
    "not_found",
  );
  assert.equal(
    (
      await searchProperties(
        "Oak",
        0,
        { ...config, SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" },
        noRequest,
      )
    ).status,
    "unavailable",
  );
});
test("outages, unavailable releases and malformed results are never empty success", async () => {
  for (const payload of [
    null,
    { available: false },
    { ...search, items: [{ ...item, market_value: "bad" }] },
    { ...search, items: Array(21).fill(item) },
    { ...search, tax_year: "2026" },
  ])
    assert.equal(
      (
        await searchProperties("Oak", 0, config, async () =>
          Response.json(payload),
        )
      ).status,
      "unavailable",
    );
  for (const status of [401, 404, 500])
    assert.deepEqual(
      await searchProperties("Oak", 0, config, async () =>
        Response.json({ message: "sensitive upstream" }, { status }),
      ),
      { status: "unavailable" },
    );
  assert.deepEqual(
    await searchProperties("Oak", 0, config, async () => {
      throw new Error("sensitive detail");
    }),
    { status: "unavailable" },
  );
});
test("profiles distinguish missing records from outages and remove extra fields", async () => {
  const r = await getProperty("000100", config, async () =>
    Response.json({
      available: true,
      property: { ...property, owner_name: "private" },
    }),
  );
  assert.equal(r.status, "ok");
  assert.deepEqual(r.data, property);
  assert.equal(
    (
      await getProperty("100", config, async () =>
        Response.json({ available: true, property: null }),
      )
    ).status,
    "not_found",
  );
  assert.equal(
    (
      await getProperty("100", config, async () =>
        Response.json({ available: false, property: null }),
      )
    ).status,
    "unavailable",
  );
  for (const changes of [
    { property_id: "101" },
    { source_url: "javascript:alert(1)" },
    { source_url: "https://evil.example/" },
    { land_acres: "bad" },
  ])
    assert.equal(
      (
        await getProperty("100", config, async () =>
          Response.json({
            available: true,
            property: { ...property, ...changes },
          }),
        )
      ).status,
      "unavailable",
    );
});
