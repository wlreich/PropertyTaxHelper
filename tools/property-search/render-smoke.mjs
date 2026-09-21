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
  const suggestionPayload = { submissionId: "88888888-8888-4888-8888-888888888888", category: "metric", message: "Compare neighborhood values in the smoke test.", website: "" };
  const saveSuggestion = await fetch(base + "/api/suggestions", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(suggestionPayload),
  });
  const savedSuggestionBody = await saveSuggestion.text();
  assert.equal(saveSuggestion.status, 200, savedSuggestionBody);
  assert.deepEqual(JSON.parse(savedSuggestionBody), { ok: true });
  const home = await page("/");
  assert.match(home, /Property address or property ID/);
  assert.match(home, /What happened to your property appraisal\?/);
  assert.match(home, /Useful property information shouldn’t disappear behind a paywall/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /Systems &amp; Sense LLC/);
  assert.match(home, /Skip to content/);
  assert.match(home, /<title>ParcelSavvy/);
  assert.match(home, /alt="ParcelSavvy"/);
  assert.match(home, /Know your property/);
  assert.match(home, /Understand your assessment/);
  assert.doesNotMatch(home, /Your records become a story you can use/);
  assert.match(home, /Independent by design\. Built for homeowners/);
  assert.doesNotMatch(home, /Source dates, calculations, and limitations stay visible/);
  const suggestionResponse = await fetch(
    base + "/api/search/suggestions?q=1104",
    { signal: AbortSignal.timeout(12000) },
  );
  assert.equal(suggestionResponse.status, 200);
  const suggestions = await suggestionResponse.json();
  assert.equal(suggestions.status, "ok");
  assert.equal(suggestions.items.length, 8);
  assert.equal(suggestions.has_more, true);
  assert.ok(suggestions.items.every((item) => item.address.startsWith("1104 ")));
  const one = await page("/?q=123+Oak");
  assert.equal(cards(one), 1);
  assert.match(one, /123 N OAK ST/);
  assert.match(one, /\$450,000/);
  const multi = await page("/?q=Oak");
  assert.equal(cards(multi), 2);
  assert.match(multi, /Market value/);
  assert.match(multi, /role="tooltip"/);
  assert.match(multi, /Source: Appraisal District/);
  const first = await page("/?q=Map");
  const second = await page("/?q=Map&page=1");
  const last = await page("/?q=Map&page=2");
  assert.deepEqual([cards(first), cards(second), cards(last)], [20, 20, 5]);
  assert.match(second, /Page 2/);
  const defaultParcels = await page("/?q=Parkdemo");
  assert.equal(cards(defaultParcels),5);
  assert.doesNotMatch(defaultParcels,/Show all parcels|Includes identified parkland/);
  const legacyAllParcels = await page("/?q=Parkdemo&all=1");
  assert.equal(cards(legacyAllParcels),5);
  assert.doesNotMatch(legacyAllParcels,/Parkland/);
  assert.equal(cards(await page("/?q=Parkdemo&page=1&all=1")),0);
  assert.match(await page("/property/505?q=Parkdemo&page=1&all=1"), /href="\/\?q=Parkdemo&amp;page=1&amp;all=1"/);
  assert.equal(cards(await page("/?q=505")),1);
  const profile = await page("/property/100?q=Oak&page=1");
  assert.match(profile, /Assessment &amp; protest history/);
  assert.match(profile, /Protest recorded/);
  assert.match(profile, /FIXTURE TAX PARTNERS/);
  assert.match(profile, /Protest recorded. Value reduced/);
  assert.match(profile, /Current assessment/);
  assert.match(profile, /Agent: /);
  assert.match(profile, /What is the cap doing for you/);
  assert.match(profile, /View exemption details/);
  assert.doesNotMatch(profile, /Browse my street/);
  assert.match(profile, /View 2026 details/);
  assert.match(profile, /\$420,000/);
  assert.match(profile, /Separately valued features/);
  assert.match(profile, /No longer separately listed/);
  assert.match(profile, /Taxable values by authority/);
  assert.match(profile, /Back to search results/);
  assert.match(profile, /q=Oak&amp;page=1/);
  const neighborhood = await page("/property/100/neighborhood");
  assert.match(neighborhood, /Subdivision on record/);
  assert.match(neighborhood, /GRAND MESA SECTION II/);
  assert.match(neighborhood, /Your neighborhood, in context/);
  assert.match(neighborhood, /Proposed values reduced/);
  assert.match(neighborhood, /Median dollar reduction/);
  assert.match(neighborhood, /Print \/ save PDF/);
  assert.doesNotMatch(neighborhood, /Which properties are included\?/);
  const printable = await page("/property/100/neighborhood/print?release=11111111-1111-4111-8111-111111111111");
  assert.match(printable, /Print or save as PDF/);
  assert.match(printable, /Look across years/);
  assert.match(printable, /market-area multiplier/);
  assert.match(printable, /identified protest activity/);
  assert.match(printable, /Median dollar reduction among/);
  assert.match(printable, /PS-NBR-2026\.1/);
  assert.match(printable, /Live analysis:/);
  assert.doesNotMatch(printable, /donat|support us/i);
  for (const [path, heading] of [
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of use"],
    ["/accessibility", "Accessibility"],
    ["/contact", "How can we help?"],
    ["/report-data-issue?property=100", "Report a data issue"],
    ["/support", "Help keep ParcelSavvy open"],
  ]) {
    const information = await page(path);
    assert.match(information, new RegExp(heading.replace(/[?]/g, "\\$&")));
    assert.match(information, /Systems &amp; Sense LLC/);
  }
  assert.match(await page("/property/106"), /Some values need further review/);
  assert.match(await page("/property/103"), /Let’s try another address/);
  assert.match(await page("/?q=NoSuchStreet"), /No matching properties found/);
  assert.match(await page("/?q=ab"), /at least three letters or digits/);
  for (const html of [home, one, multi, first, second, last, profile, neighborhood, printable])
    assert.doesNotMatch(
      html,
      /PRIVATE SYNTHETIC OWNER|sb_publishable_fixture|data-nextjs-dialog/,
    );
  const cssPath = home.match(/href="([^"]+\.css[^"]*)"/)[1];
  const css = await page(cssPath.replaceAll("&amp;", "&"));
  assert.match(css, /@media/);
  console.log(
    "Rendered-page checks passed: home, typeahead API, partial/exact/multiple matches, pagination, profile, neighborhood analysis, shared printable report, return link, confidential 404, no-results, invalid input, stylesheet, and no credential/owner leakage.",
  );
} finally {
  for (const child of processes) child.kill("SIGTERM");
}
