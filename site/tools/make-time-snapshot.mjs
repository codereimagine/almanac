// Snapshot generator for 07 TIME — mirrors page.tsx compute() exactly.
// Usage: cp to site/ and run (needs site node_modules), > src/pages/time/snapshot.json
import * as A from "astronomy-engine";

const D = Math.PI / 180;
const norm = (lon) => ((lon + 540) % 360) - 180;
const t = new Date();
const gast = A.SiderealTime(t);
const eq = A.Equator(A.Body.Sun, t, new A.Observer(0, 0, 0), true, true);
const subsolar = { lat: eq.dec, lon: norm(eq.ra * 15 - gast * 15) };
const antisolar = { lat: -subsolar.lat, lon: norm(subsolar.lon + 180) };
const terminator = [];
for (let az = 0; az < 360; az += 3) {
  const sinLat = Math.cos(az * D) * Math.cos(subsolar.lat * D);
  const lat = Math.asin(sinLat) / D;
  const lon = subsolar.lon + Math.atan2(Math.sin(az * D) * Math.cos(subsolar.lat * D), -Math.sin(subsolar.lat * D) * sinLat) / D;
  terminator.push({ lat, lon: norm(lon) });
}
const doy = Math.floor((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 0)) / 86400000);
console.log(JSON.stringify({
  asOf: t.getTime(), subsolar, antisolar, terminator,
  gastH: gast, jd: t.getTime() / 86400000 + 2440587.5, doy,
}));
