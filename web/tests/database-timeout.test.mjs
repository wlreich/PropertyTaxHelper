import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseDatabaseHealth } from "../src/lib/supabase/health.ts";
import { searchProperties } from "../src/lib/supabase/properties.ts";
const config = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
};

function delayedResponse(value, delay) {
  return async (_input, init) =>
    new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(init.signal.reason);
      };
      const timer = setTimeout(() => {
        init.signal.removeEventListener("abort", abort);
        resolve(Response.json(value));
      }, delay);
      if (init.signal.aborted) abort();
      else init.signal.addEventListener("abort", abort, { once: true });
    });
}

test("health and search accept valid responses beyond the former five-second cutoff", async () => {
  const [health, search] = await Promise.all([
    diagnoseDatabaseHealth(config, delayedResponse(1, 6000)),
    searchProperties(
      "Oak",
      0,
      config,
      delayedResponse(
        {
          available: true,
          items: [],
          tax_year: 2026,
          roll_stage: "certified",
          export_time_raw: null,
          has_more: false,
          limit_reached: false,
        },
        6000,
      ),
    ),
  ]);
  assert.deepEqual(health, { database: "ok" });
  assert.equal(search.status, "ok");
});

test("an unresponsive API still aborts with a safe timeout reason", async () => {
  const start = Date.now();
  const result = await diagnoseDatabaseHealth(
    config,
    delayedResponse(1, 60000),
  );
  assert.deepEqual(result, {
    database: "unavailable",
    reason: "request_timed_out",
  });
  assert.ok(
    Date.now() - start < 20000,
    "The request must not hang indefinitely",
  );
});
