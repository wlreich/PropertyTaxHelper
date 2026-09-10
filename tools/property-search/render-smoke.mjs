// Exercise the built Next.js server against synthetic PostgreSQL RPC data.
// Run after `npm run build` in web/. This never contacts hosted Supabase.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const processes = [];
function start(args, cwd, env, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    processes.push(child);
    let log = "";
    const timer = setTimeout(
      () =>
        reject(new Error(`Local server did not start: ${log.slice(-1500)}`)),
      15000,
    );
    const receive = (chunk) => {
      log += chunk.toString();
      if (log.includes(ready)) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", receive);
    child.stderr.on("data", receive);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code)
        reject(new Error(`Local server exited ${code}: ${log.slice(-1500)}`));
    });
  });
}
const base = "http://127.0.0.1:3056";
async function page(path) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(12000) });
  assert.ok(r.status < 500);
  return (await r.text()).replace(/<!--[\s\S]*?-->/g, "");
}
const cards = (html) => (html.match(/class="result-card"/g) ?? []).length;
try {
  await start(
    ["tools/property-search/preview-data.mjs"],
    root,
    process.env,
    "Synthetic property RPC listening",
  );
  await start(
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      "3056",
      "--hostname",
      "127.0.0.1",
    ],
    root + "web",
    {
      ...process.env,
      SUPABASE_URL: "http://127.0.0.1:4055",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    "Ready",
  );
  const home = await page("/");
  assert.match(home, /Property address or property ID/);
  assert.match(home, /Skip to content/);
  assert.match(home, /<title>ParcelSavvy/);
  assert.match(home, /alt="ParcelSavvy"/);
  assert.match(home, /Know your property/);
  assert.match(home, /Understand your assessment/);
  const one = await page("/?q=123+Oak");
  assert.equal(cards(one), 1);
  assert.match(one, /123 N OAK ST/);
  assert.match(one, /\$450,000/);
  const multi = await page("/?q=Oak");
  assert.equal(cards(multi), 2);
  assert.match(multi, /TCAD market value/);
  assert.match(multi, /role="tooltip"/);
  assert.match(multi, /Source: TCAD/);
  const first = await page("/?q=Map");
  const second = await page("/?q=Map&page=1");
  const last = await page("/?q=Map&page=2");
  assert.deepEqual([cards(first), cards(second), cards(last)], [20, 20, 5]);
  assert.match(second, /Page 2/);
  const defaultParcels = await page("/?q=Parkdemo");
  assert.equal(cards(defaultParcels),5);
  assert.match(defaultParcels,/Show all parcels/);
  const allParcels = await page("/?q=Parkdemo&all=1");
  assert.equal(cards(allParcels),20);
  assert.match(allParcels,/Parkland/);
  assert.match(allParcels, /page=1&amp;all=1/);
  assert.equal(cards(await page("/?q=Parkdemo&page=1&all=1")),5);
  assert.match(await page("/property/505?q=Parkdemo&page=1&all=1"), /href="\/\?q=Parkdemo&amp;page=1&amp;all=1"/);
  assert.equal(cards(await page("/?q=505")),1);
  const profile = await page("/property/100?q=Oak&page=1");
  assert.match(profile, /Assessment history/);
  assert.match(profile, /Protest recorded · 2026/);
  assert.match(profile, /2026 tax year · Apr 29, 2026/);
  assert.match(profile, /TCAD status code: EF/);
  assert.match(profile, /FIXTURE TAX PARTNERS/);
  assert.match(profile, /A promising protest-season result/);
  assert.match(profile, /Browse my street/);
  assert.match(profile, /View all assessment values/);
  assert.match(profile, /\$420,000/);
  assert.match(profile, /Separately valued features/);
  assert.match(profile, /Not listed/);
  assert.match(profile, /Exemptions &amp; taxable values/);
  assert.match(profile, /Back to search results/);
  assert.match(profile, /q=Oak&amp;page=1/);
  assert.match(await page("/property/106"), /Some values need further review/);
  assert.match(await page("/property/103"), /Let’s try another address/);
  assert.match(await page("/?q=NoSuchStreet"), /No matching addresses found/);
  assert.match(await page("/?q=ab"), /at least three letters or digits/);
  for (const html of [home, one, multi, first, second, last, profile])
    assert.doesNotMatch(
      html,
      /PRIVATE SYNTHETIC OWNER|sb_publishable_fixture|data-nextjs-dialog/,
    );
  const cssPath = home.match(/href="([^"]+\.css[^"]*)"/)[1];
  const css = await page(cssPath.replaceAll("&amp;", "&"));
  assert.match(css, /@media/);
  console.log(
    "Rendered-page checks passed: home, partial/exact/multiple matches, pagination, profile, return link, confidential 404, no-results, invalid input, stylesheet, and no credential/owner leakage.",
  );
} finally {
  for (const child of processes) child.kill("SIGTERM");
}
