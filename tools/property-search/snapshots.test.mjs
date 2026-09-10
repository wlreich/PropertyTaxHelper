import { fixtureDatabase } from "./projection.test.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const dataset = "11111111-1111-4111-8111-111111111111";
test("snapshot publication: privacy, absence, entity amounts, repeat batches and RLS", async (t) => {
  const db = await fixtureDatabase();
  t.after(() => db.close());
  await db.exec(
    `update tcad_ingest.files set record_type=case member_name when '3.txt' then 'ImprovementDetail' when '4.txt' then 'PropertyEntity' when '5.txt' then 'ARB' when '6.txt' then 'Agent' else record_type end;`,
  );
  const add = async (member, id, fields, year = "2026") =>
    db.query(
      `insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,$2,1,$3,$4,$5)`,
      [dataset, member, id, year, fields],
    );
  await add("3.txt", "101", {
    imprv_det_id: "001",
    imprv_id: "01",
    imprv_det_type_cd: "604",
    imprv_det_type_desc: "POOL",
    imprv_det_val: "0",
    imprv_det_area: "1",
  });
  await add("4.txt", "101", {
    entity_cd: "69",
    entity_name: "TEST ISD",
    taxable_val: "300000",
    hs_amt: "140000",
    hs_local_amt: "0",
    hs_state_amt: "140000",
  });
  await add("5.txt", "101", { arb_status: "OPEN" }, "2025"); // Different tax year is not evidence of a 2026 case.
  await add("6.txt", null, {
    agent_id: "0007",
    agent_name: "PRIVATE CONTACT",
    phone: "PRIVATE PHONE",
  });
  await db.query(
    `update tcad_ingest.records set fields=fields||'{"hs_exempt":"T","arb_protest_flag":"F","arb_agent_id":"0007"}' where prop_id='101' and member_name='0.txt'`,
  );
  await db.query("select tcad_ingest.publish_property_search($1)", [dataset]);
  const publish = async () =>
    db.query("select tcad_ingest.publish_property_snapshots($1,$2,$3) result", [
      dataset,
      "",
      1000,
    ]);
  await publish();
  const history = async (id) =>
    (await db.query("select public.property_history($1) result", [id])).rows[0]
      .result.snapshots;
  const before = await history("101");
  assert.equal(before.length, 1);
  assert.equal(before[0].components[0].value, 0);
  assert.equal(before[0].components.length, 1);
  assert.equal(before[0].arb_case_listed, false);
  assert.equal(before[0].arb_agent_listed, true);
  assert.deepEqual(before[0].exemptions, ["HS"]);
  assert.deepEqual(before[0].entities[0].exemptions, { HS: 140000 });
  await publish();
  assert.deepEqual(await history("101"), before);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    assert.deepEqual(await history("000101"), before);
    for (const id of [
      "100",
      "102",
      "103",
      "104",
      "106",
      "107",
      "108",
      "invalid",
    ])
      assert.deepEqual(await history(id), []);
    assert.ok(!JSON.stringify(before).includes("PRIVATE"));
    await assert.rejects(publish(), /permission denied/);
    await assert.rejects(
      db.query("delete from public.property_snapshot_profiles"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select fields from tcad_ingest.records"),
      /permission denied/,
    );
    await db.exec("reset role");
  }
  await db.query(
    "update tcad_ingest.records set fields=fields-'ownership_pct' where prop_id='101' and member_name='0.txt'",
  );
  await publish();
  assert.deepEqual(await history("101"), []);
  await db.query(
    'update tcad_ingest.datasets set header=header||\'{"export_version":"8.0.0.30"}\'::jsonb where id=$1',
    [dataset],
  );
  await publish();
  assert.equal((await history("101")).length, 1);
  await db.query(
    'update tcad_ingest.datasets set header=header||\'{"export_version":"8.0.0.32"}\'::jsonb where id=$1',
    [dataset],
  );
  await publish();
  assert.deepEqual(await history("101"), []);
  await db.query(
    "update tcad_ingest.records set fields=fields||'{\"ownership_pct\":\"100\"}'::jsonb where prop_id='101' and member_name='0.txt'",
  );
  await db.query(
    `update tcad_ingest.records set fields=fields||'{"py_confidential_flag":"T"}' where prop_id='101' and member_name='0.txt'`,
  );
  await publish();
  assert.deepEqual(await history("101"), []); // Re-publication removes newly withheld data.
});
