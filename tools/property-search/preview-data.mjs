// Local browser verification only. All records are synthetic; bind to loopback.
import { createServer } from "node:http";
import { fixtureDatabase } from "./projection.test.mjs";
const db = await fixtureDatabase();
await db.query(
  "select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')",
);
await db.exec("set role anon");
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4055");
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }
    let rows;
    if (url.pathname === "/rest/v1/rpc/search_properties")
      rows = (
        await db.query("select public.search_properties($1,$2) result", [
          url.searchParams.get("p_query"),
          Number(url.searchParams.get("p_page")),
        ])
      ).rows;
    else if (url.pathname === "/rest/v1/rpc/property_profile")
      rows = (
        await db.query("select public.property_profile($1) result", [
          url.searchParams.get("p_id"),
        ])
      ).rows;
    else {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(rows[0].result));
  } catch {
    res
      .writeHead(400, { "Content-Type": "application/json" })
      .end('{"message":"Invalid fixture request"}');
  }
}).listen(4055, "127.0.0.1", () =>
  console.log("Synthetic property RPC listening on loopback port 4055"),
);
