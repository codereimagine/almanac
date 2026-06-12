// Gazetteer generator — country names + centroids from world-atlas countries-110m.
// Usage (from site/): node tools/make-gazetteer.mjs > src/gazetteer-countries.json
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json")));
const tf = topo.transform;
const arcs = topo.arcs.map((a) => {
  let x = 0, y = 0;
  return a.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]];
  });
});

const D = Math.PI / 180;
const out = [];
for (const g of topo.objects.countries.geometries) {
  const name = g.properties?.name;
  if (!name) continue;
  const polys = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
  let best = null, bestLen = -1;
  for (const poly of polys) {
    const ring = [];
    for (const ix of poly[0]) ring.push(...(ix < 0 ? arcs[~ix].slice().reverse() : arcs[ix]));
    if (ring.length > bestLen) { bestLen = ring.length; best = ring; }
  }
  if (!best) continue;
  // unit-vector mean — antimeridian-safe (Russia, Fiji, USA)
  let X = 0, Y = 0, Z = 0;
  for (const [lon, lat] of best) {
    X += Math.cos(lat * D) * Math.cos(lon * D);
    Y += Math.cos(lat * D) * Math.sin(lon * D);
    Z += Math.sin(lat * D);
  }
  const lon = Math.atan2(Y, X) / D;
  const lat = Math.atan2(Z, Math.hypot(X, Y)) / D;
  out.push([name.toUpperCase(), +lat.toFixed(2), +lon.toFixed(2)]);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
console.log(JSON.stringify(out));
