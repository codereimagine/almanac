/**
 * Offline fetch for the tests. Every live feed is answered from a REAL response
 * saved in test/fixtures/, so the suite runs with no network at all.
 *
 *   RECORD=1 npm test   → hit the real APIs once and (re)write the fixtures
 *   npm test            → replay only; an unrecorded URL fails the test loudly
 *
 * Fixtures are keyed by host + path (query strings carry dates/coordinates that
 * change every run), so several calls to one endpoint share its recorded body.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(__dirname, "fixtures");
const key = (url: string) => {
  const u = new URL(url);
  const product = u.searchParams.get("product"); // NOAA datagetter serves tide predictions AND water levels
  const multi = (u.searchParams.get("latitude") ?? "").includes(","); // Open-Meteo: city grid vs one point
  return (u.host + u.pathname + (product ? "_" + product : "") + (multi ? "_grid" : "")).replace(/[^a-z0-9.]+/gi, "_");
};

export function installFetch() {
  const record = process.env.RECORD === "1";
  const real = globalThis.fetch;
  const calls: string[] = [];
  /** hosts to answer with HTTP 503 — exercises each feed's fallback path */
  const down = new Set<string>();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (down.has(new URL(url).host)) return new Response("unavailable", { status: 503 });
    const file = path.join(DIR, key(url) + ".json");
    if (record) {
      const r = await real(url, init);
      const body = await r.text();
      if (r.ok) {
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(file, body);
      }
      return new Response(body, { status: r.status, headers: { "content-type": "application/json" } });
    }
    if (!fs.existsSync(file)) throw new Error(`no recorded fixture for ${url} (run RECORD=1 npm test)`);
    return new Response(fs.readFileSync(file), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, down, restore: () => (globalThis.fetch = real) };
}
