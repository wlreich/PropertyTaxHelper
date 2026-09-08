import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDatabaseHealth,
  diagnoseDatabaseHealth,
} from "../src/lib/supabase/health.ts";

const configuration = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
};

test("missing or privileged keys never initiate a database request", async () => {
  for (const config of [
    {},
    { ...configuration, SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" },
  ]) {
    const result = await checkDatabaseHealth(config, async () => {
      assert.fail("Invalid configuration must not make a request");
    });
    assert.equal(result, "not_configured");
  }
});

test("success requires the read-only RPC response, using the publishable key", async () => {
  const result = await checkDatabaseHealth(
    configuration,
    async (input, init) => {
      assert.equal(new URL(input).pathname, "/rest/v1/rpc/database_health");
      assert.equal(init.method, "GET");
      assert.equal(
        new Headers(init.headers).get("apikey"),
        configuration.SUPABASE_PUBLISHABLE_KEY,
      );
      assert.equal(init.cache, "no-store");
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json(1);
    },
  );
  assert.equal(result, "ok");
});

test("an HTTP success with an unexpected result is not database health", async () => {
  for (const value of [null, 0, "1", { status: "ok" }]) {
    assert.equal(
      await checkDatabaseHealth(configuration, async () =>
        Response.json(value),
      ),
      "unavailable",
    );
  }
});

test("missing migrations and rejected keys return only an unavailable status", async () => {
  for (const status of [401, 404, 503]) {
    const result = await checkDatabaseHealth(configuration, async () =>
      Response.json({ message: "Sensitive upstream detail" }, { status }),
    );
    assert.equal(result, "unavailable");
  }
});

test("network failures and aborted requests do not escape as raw errors", async () => {
  for (const error of [
    new Error("Sensitive network detail"),
    new DOMException("timeout", "TimeoutError"),
  ]) {
    const result = await checkDatabaseHealth(configuration, async () => {
      throw error;
    });
    assert.equal(result, "unavailable");
  }
});

test("diagnostics distinguish configuration, API rejection and missing functions without exposing details", async () => {
  assert.equal(
    (await diagnoseDatabaseHealth({})).reason,
    "missing_configuration",
  );
  assert.equal(
    (
      await diagnoseDatabaseHealth({
        ...configuration,
        SUPABASE_URL: "https://example.supabase.co/rest/v1",
      })
    ).reason,
    "invalid_project_url",
  );
  const cases = [
    [401, "", "key_rejected"],
    [403, "", "access_denied"],
    [404, "PGRST202", "health_function_missing"],
    [404, "", "endpoint_not_found"],
    [400, "57014", "database_timed_out"],
    [429, "", "rate_limited"],
  ];
  for (const [status, code, reason] of cases) {
    const result = await diagnoseDatabaseHealth(configuration, async () =>
      Response.json(
        {
          code,
          message: "SECRET upstream detail",
          details: "private",
          hint: "credential",
        },
        { status },
      ),
    );
    assert.deepEqual(result, { database: "unavailable", reason });
    assert.doesNotMatch(
      JSON.stringify(result),
      /SECRET|private|credential|sb_publishable|example\.supabase/,
    );
  }
  assert.deepEqual(
    await diagnoseDatabaseHealth(configuration, async () => Response.json(1)),
    { database: "ok" },
  );
  assert.deepEqual(
    await diagnoseDatabaseHealth(configuration, async () =>
      Response.json({ bad: true }),
    ),
    { database: "unavailable", reason: "unexpected_response" },
  );
});

test("transport diagnostics separate explicit timeout errors from network failures", async () => {
  for (const [error, reason] of [
    [new TypeError("SECRET network error"), "network_error"],
    [new DOMException("SECRET timeout", "TimeoutError"), "request_timed_out"],
  ]) {
    const result = await diagnoseDatabaseHealth(configuration, async () => {
      throw error;
    });
    assert.deepEqual(result, { database: "unavailable", reason });
  }
});
