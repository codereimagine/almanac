// Snapshot generator for 05 WEATHER — mirrors page.tsx fetchLive exactly.
// Usage: node /tmp/make-weather-snapshot.mjs > site/src/pages/weather/snapshot.json
import { readFileSync } from "fs";

const CITIES = JSON.parse(readFileSync(new URL("/home/arc/almanac/site/src/pages/weather/cities.json", "file:"), "utf8"));
const OM = "https://api.open-meteo.com/v1/forecast";

const lats = CITIES.map((c) => c[1]).join(",");
const lons = CITIES.map((c) => c[2]).join(",");
const r = await fetch(`${OM}?latitude=${lats}&longitude=${lons}&current=temperature_2m,wind_speed_10m`);
if (!r.ok) throw new Error(`open-meteo ${r.status}`);
const d = await r.json();
const cities = [];
(Array.isArray(d) ? d : [d]).forEach((e, i) => {
  const t = e.current?.temperature_2m;
  if (t == null || !CITIES[i]) return;
  cities.push({ name: CITIES[i][0], lat: CITIES[i][1], lon: CITIES[i][2], temp: t, wind: e.current?.wind_speed_10m ?? 0 });
});
if (cities.length === 0) throw new Error("open-meteo empty");
console.log(JSON.stringify({ asOf: Date.now(), cities }));
