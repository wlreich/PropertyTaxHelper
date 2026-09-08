import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import test from "node:test";

const dataset = "11111111-1111-4111-8111-111111111111";
export async function fixtureDatabase({ beforeAcreageFix = false, beforeParkland = false, parklandFixtures = false } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(
    "create role anon; create role authenticated; create role service_role; grant usage on schema public to anon,authenticated;",
  );
  const directory = fileURLToPath(
    new URL("../../supabase/migrations/", import.meta.url),
  );
  for (const filename of (await readdir(directory))
    .filter((x) => x.endsWith(".sql") && !(beforeAcreageFix && x >= "20260908183146") && !((beforeParkland || beforeAcreageFix) && x.endsWith("_property_parkland_filter.sql")))
    .sort())
    await db.exec(await readFile(`${directory}/${filename}`, "utf8"));
  await db.query(
    `insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,completed_at)
    values($1,repeat('a',64),repeat('b',64),'fixture','utf-8',2026,'certified','https://traviscad.org/fixture.zip','fixture','{"run_date_time":"07/18/2026 16:27"}','ready',now())`,
    [dataset],
  );
  for (let i = 0; i < 20; i++)
    await db.query(
      `insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status)
    values($1,$2,$3,0,repeat('c',64),'complete')`,
      [
        dataset,
        `${i}.txt`,
        ["Property", "Improvement", "LandDetail"][i] ?? `Fixture${i}`,
      ],
    );
  let row = 0;
  const base = {
    situs_num: "123",
    situs_street_prefx: "N",
    situs_street: "OAK",
    situs_street_suffix: "ST",
    situs_unit: "",
    situs_city: "FIXTURE CITY",
    situs_zip: "78700",
    prop_type_cd: "R",
    market_value: "450000",
    appraised_val: "430000",
    assessed_val: "420000",
    land_hstd_val: "100000",
    land_non_hstd_val: "0",
    imprv_hstd_val: "350000",
    imprv_non_hstd_val: "0",
    land_acres: "00000000000000002500",
    partial_owner: "F",
    ownership_pct: "100",
    py_confidential_flag: "F",
    jan1_confidential_flag: "F",
    appr_confidential_flag: "F",
    udi_group: "",
    py_owner_name: "PRIVATE SYNTHETIC OWNER",
  };
  const property = async (id, changes = {}) =>
    db.query(
      "insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,$2,$3,$4,$5,$6)",
      [dataset, "0.txt", ++row, id, "02026", { ...base, ...changes }],
    );
  await property("000100");
  await property("000100"); // Identical repeated owner record must not double the value.
  await property("101", { situs_num: "1234" });
  await property("102", {
    situs_street: "CEDAR",
    situs_num: "89",
    market_value: "300000",
  });
  await property("102", {
    situs_street: "CEDAR",
    situs_num: "89",
    market_value: "150000",
  });
  await property("103", { situs_street: "SECRET", py_confidential_flag: "T" });
  await property("104", {
    situs_street: "UNKNOWN",
    jan1_confidential_flag: null,
  });
  await property("105", { situs_street: "" });
  await property("106", {
    situs_street: "SHARED",
    udi_group: "000800",
    ownership_pct: "50",
  });
  await property("107", {
    situs_street: "BLOCKED",
    udi_group: "900",
    appr_confidential_flag: "T",
  });
  await property("108", { situs_street: "BLOCKED", udi_group: "900" });
  await property("109", { situs_street: "DISAGREE" });
  await property("109", { situs_street: "DIFFERENT" });
  await property("110", {
    situs_street: "O'BRIEN",
    situs_street_suffix: "RD",
    situs_unit: "2",
  });
  for (let i = 200; i < 245; i++)
    await property(String(i), {
      situs_num: String(i),
      situs_street: "MAPLE",
      situs_street_suffix: "AVE",
    });
  for (const [i, id, year, member] of [
    [1, "000100", "2026", "1.txt"],
    [2, "800", "2026", "1.txt"],
    [3, "800", "2025", "1.txt"],
    [1, "100", "2026", "2.txt"],
  ]) {
    await db.query(
      "insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,$2,$3,$4,$5,$6)",
      [dataset, member, i, id, year, {}],
    );
  }
  if (parklandFixtures) {
    for (let i = 500; i < 525; i++) await property(String(i), {
      situs_num: String(i), situs_street: "PARKDEMO",
      market_value: "35", legal_desc: i >= 505 ? "LOT 1 (PARKLAND)" : "LOT 1 PARKLAND ESTATES",
    });
    await property("526", {situs_num: "526", situs_street: "PARKDEMO", legal_desc: "LOT 1 (PARKLAND)", py_confidential_flag: "T"});
  }
  return db;
}

if (process.argv[1]?.endsWith("projection.test.mjs"))
  test("publication, matching, pagination, privacy and release isolation", async (t) => {
    const db = await fixtureDatabase();
    t.after(() => db.close());
    const rpc = async (q, page = 0) =>
      (
        await db.query("select public.search_properties($1,$2) result", [
          q,
          page,
        ])
      ).rows[0].result;
    const profile = async (id) =>
      (await db.query("select public.property_profile($1) result", [id]))
        .rows[0].result;
    const asRole = async (role, operation) => {
      await db.exec(`set role ${role}`);
      try {
        return await operation();
      } finally {
        await db.exec("reset role");
      }
    };
    await t.test("unpublished data is unavailable", async () =>
      assert.equal((await asRole("anon", () => rpc("Oak"))).available, false),
    );
    await t.test(
      "publication deduplicates and filters source records",
      async () => {
        const r = await db.query(
          "select tcad_ingest.publish_property_search($1) result",
          [dataset],
        );
        assert.equal(r.rows[0].result.published_properties, 50);
        assert.equal((await profile("100")).property.source_record_count, 2);
        assert.equal((await profile("100")).property.market_value, 450000);
        assert.equal((await profile("100")).property.land_acres, 0.25);
        assert.equal((await profile("100")).property.improvement_records, 1);
        assert.equal((await profile("100")).property.land_segments, 1);
        assert.equal((await profile("106")).property.improvement_records, 1);
        for (const id of ["103", "104", "105", "107", "108", "109"])
          assert.equal((await profile(id)).property, null);
      },
    );
    await t.test(
      "partial words, abbreviations, direction, unit and house-number boundaries",
      async () => {
        assert.deepEqual(
          (await rpc("123 Oak")).items.map((x) => x.property_id),
          ["100"],
        );
        assert.equal((await rpc("oak")).items.length, 2);
        assert.equal((await rpc("123 NORTH OAK STREET")).items.length, 1);
        assert.equal(
          (await rpc("OBrien Road Apt 2")).items[0].property_id,
          "110",
        );
        assert.equal((await rpc("000100")).items[0].property_id, "100");
        assert.equal((await rpc("NoSuchStreet")).items.length, 0);
        await assert.rejects(rpc("%_"), /at least three/);
        await assert.rejects(rpc("Oak", -1), /Invalid search/);
        await assert.rejects(rpc("Oak", 250), /Invalid search/);
      },
    );
    await t.test(
      "ambiguous values stay withheld without dropping the property",
      async () => {
        for (const id of ["102", "106"]) {
          const p = (await profile(id)).property;
          assert.equal(p.market_value, null);
          assert.equal(p.values_under_review, true);
        }
        assert.equal((await profile("106")).property.land_acres, null);
      },
    );
    await t.test(
      "multiple pages are deterministic, disjoint and bounded",
      async () => {
        const pages = await Promise.all([
          rpc("Map", 0),
          rpc("Map", 1),
          rpc("Map", 2),
        ]);
        assert.deepEqual(
          pages.map((x) => x.items.length),
          [20, 20, 5],
        );
        assert.deepEqual(
          pages.map((x) => x.has_more),
          [true, true, false],
        );
        assert.equal(
          new Set(pages.flatMap((x) => x.items.map((p) => p.property_id))).size,
          45,
        );
      },
    );
    await t.test(
      "public roles can read only curated current records",
      async () => {
        for (const role of ["anon", "authenticated"])
          await asRole(role, async () => {
            const result = await rpc("Oak");
            assert.equal(result.items.length, 2);
            assert.ok(
              !JSON.stringify(result).includes("PRIVATE SYNTHETIC OWNER"),
            );
            await assert.rejects(
              db.query("select fields from tcad_ingest.records"),
              /permission denied/,
            );
            await assert.rejects(
              db.query("select tcad_ingest.publish_property_search($1)", [
                dataset,
              ]),
              /permission denied/,
            );
            await assert.rejects(
              db.query("delete from public.property_search_documents"),
              /permission denied/,
            );
          });
        await asRole(
          "tcad_loader",
          async () =>
            await assert.rejects(
              db.query("select tcad_ingest.publish_property_search($1)", [
                dataset,
              ]),
              /permission denied/,
            ),
        );
      },
    );
    await t.test(
      "repeat publication is idempotent and incomplete publication cannot switch releases",
      async () => {
        const again = await db.query(
          "select tcad_ingest.publish_property_search($1) result",
          [dataset],
        );
        assert.equal(again.rows[0].result.published_properties, 50);
        await db.query(
          "update tcad_ingest.files set status='loading' where dataset_id=$1 and member_name='2.txt'",
          [dataset],
        );
        await assert.rejects(
          db.query("select tcad_ingest.publish_property_search($1)", [dataset]),
          /20 completed/,
        );
        assert.equal((await asRole("anon", () => rpc("Oak"))).items.length, 2);
      },
    );
    await t.test(
      "a failure after projection writes rolls back publication",
      async () => {
        const failed = "33333333-3333-4333-8333-333333333333";
        await db.query(
          `insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,completed_at)
        values($1,repeat('d',64),repeat('b',64),'fixture','utf-8',2026,'certified','https://traviscad.org/fixture.zip','fixture','{}','ready',now())`,
          [failed],
        );
        await db.query(
          `insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status)
        select $1,member_name,record_type,0,sha256,'complete' from tcad_ingest.files where dataset_id=$2`,
          [failed, dataset],
        );
        await db.query(
          `insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields)
        select $1,'0.txt',1,prop_id,prop_val_yr,fields || '{"py_confidential_flag":"T"}'::jsonb
        from tcad_ingest.records where dataset_id=$2 and member_name='0.txt' limit 1`,
          [failed, dataset],
        );
        await assert.rejects(
          db.query("select tcad_ingest.publish_property_search($1)", [failed]),
          /No eligible properties/,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.property_releases where dataset_id=$1",
              [failed],
            )
          ).rows[0].n,
          0,
        );
        assert.equal((await asRole("anon", () => rpc("Oak"))).items.length, 2);
      },
    );
    await t.test("RLS hides inactive releases and their profiles", async () => {
      const inactive = "22222222-2222-4222-8222-222222222222";
      await db.query(
        "insert into public.property_releases values($1,2025,'certified',null,'https://traviscad.org/fixture.zip',now())",
        [inactive],
      );
      await db.query(
        "insert into public.property_search_documents select $1,property_id,address,city,postal_code,property_type,search_text,market_value,appraised_value,assessed_value,land_value,improvement_value,land_acres,source_record_count,values_under_review,shared_ownership,improvement_records,land_segments from public.property_search_documents limit 1",
        [inactive],
      );
      await asRole("anon", async () => {
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.property_releases",
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.property_search_documents",
            )
          ).rows[0].n,
          50,
        );
      });
    });
    await t.test(
      "the trigram index supports partial-address matching",
      async () => {
        await db.exec("set enable_seqscan=off");
        const plan = await db.query(
          "explain select property_id from public.property_search_documents where search_text like '%OAK%'",
        );
        assert.match(JSON.stringify(plan.rows), /property_search_address_idx/);
      },
    );
  });

if (process.argv[1]?.endsWith("projection.test.mjs"))
  test("acreage upgrade repairs existing values, preserves other fields, and is repeatable", async (t) => {
    const db = await fixtureDatabase({ beforeAcreageFix: true });
    t.after(() => db.close());
    await db.query(`update tcad_ingest.records set fields=jsonb_set(fields,'{land_acres}','"00000000000000014309"') where prop_id='000100' and member_name='0.txt'`);
    await db.query("select tcad_ingest.publish_property_search($1)",[dataset]);
    const snapshot = async () => (await db.query("select property_id,land_acres::float8 acres,to_jsonb(d)-'land_acres' remaining from public.property_search_documents d order by property_id")).rows;
    const before = await snapshot();
    assert.equal(before.find(x=>x.property_id==='100').acres,14309);
    const directory = fileURLToPath(new URL("../../supabase/migrations/",import.meta.url));
    const name = (await readdir(directory)).find(x=>x.endsWith('_property_acreage_scale.sql'));
    const sql = await readFile(`${directory}/${name}`,'utf8');
    await db.exec(sql);
    const after = await snapshot();
    assert.equal(after.find(x=>x.property_id==='100').acres,1.4309);
    assert.equal(after.find(x=>x.property_id==='106').acres,null);
    assert.deepEqual(after.map(x=>x.remaining),before.map(x=>x.remaining));
    await db.exec(sql);
    assert.deepEqual(await snapshot(),after);
    await db.query("select tcad_ingest.publish_property_search($1)",[dataset]);
    assert.deepEqual(await snapshot(),after);
    for(const [input,expected] of [['00000000000000014309',1.4309],['2500',0.25],['1',0.0001],['0',0],['1.4309',1.4309],[' 10000 ',1],['',null],[null,null],['garbage',null],['-10000',null],['1.23456',null]]) {
      const result=(await db.query('select tcad_ingest.search_acres($1)::float8 acres',[input])).rows[0].acres;
      assert.equal(result,expected);
    }
    await db.exec('set role anon');
    const profile=(await db.query("select public.property_profile('100') result")).rows[0].result;
    assert.equal(profile.property.land_acres,1.4309);
  });


if (process.argv[1]?.endsWith("projection.test.mjs"))
  test("parkland upgrade, filtering before pagination, ID access and confidentiality", async (t) => {
    const db = await fixtureDatabase({beforeParkland:true,parklandFixtures:true});
    t.after(() => db.close());
    await db.query("select tcad_ingest.publish_property_search($1)",[dataset]);
    const directory = fileURLToPath(new URL("../../supabase/migrations/",import.meta.url));
    const name = (await readdir(directory)).find(x=>x.endsWith('_property_parkland_filter.sql'));
    const sql = await readFile(`${directory}/${name}`,'utf8');
    await db.exec(sql);
    const rpc = async (q,page=0,all=false) => (await db.query('select public.search_property_parcels($1,$2,$3) result',[q,page,all])).rows[0].result;
    const check = async () => {
      await db.exec('set role anon');
      try {
        const filtered = await rpc('Parkdemo');
        assert.equal(filtered.items.length,5); // Low-value ordinary parcels remain.
        assert.equal(filtered.has_more,false);
        assert.ok(filtered.items.every(x=>x.market_value===35 && !x.is_parkland));
        const pages = [await rpc('Parkdemo',0,true),await rpc('Parkdemo',1,true)];
        assert.deepEqual(pages.map(x=>x.items.length),[20,5]);
        assert.deepEqual(pages.map(x=>x.has_more),[true,false]);
        assert.equal(new Set(pages.flatMap(x=>x.items.map(p=>p.property_id))).size,25);
        assert.equal(pages.flatMap(x=>x.items).filter(x=>x.is_parkland).length,20);
        assert.equal((await rpc('000505')).items[0].property_id,'505');
        assert.equal((await rpc('526',0,true)).items.length,0); // Confidential record stays hidden.
        const profile=(await db.query("select public.property_profile('505') result")).rows[0].result;
        assert.equal(profile.property.property_id,'505');
        const old=(await db.query("select public.search_properties('Parkdemo',0) result")).rows[0].result;
        assert.equal(old.items.length,20); // Existing RPC remains unfiltered during deployment.
        assert.ok(!JSON.stringify(pages).includes('legal_desc'));
        await assert.rejects(db.query('select fields from tcad_ingest.records'),/permission denied/);
      } finally { await db.exec('reset role'); }
    };
    await check();
    await db.exec(sql); // Source-based backfill is repeatable.
    await check();
    await db.query('select tcad_ingest.publish_property_search($1)',[dataset]);
    await check(); // Future publications carry the same classification.
    for (const [description,expected] of [['LOT 1 (PARKLAND)',true],['LOT 1 ( parkland )',true],['PARKLAND ESTATES',false],['NOT PARKLAND',false],['PARK LANDING',false],[null,false]]) {
      assert.equal((await db.query('select tcad_ingest.is_explicit_parkland($1) result',[description])).rows[0].result,expected);
    }
  });
