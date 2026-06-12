// Snapshot generator for 06 STARS · PLANETS — mirrors page.tsx compute() exactly.
// Usage: node /tmp/make-celestial-snapshot.mjs > site/src/pages/celestial/snapshot.json
import { readFileSync } from "fs";
import * as A from "astronomy-engine";

const STARS = JSON.parse(readFileSync("/home/arc/almanac/site/src/pages/celestial/stars.json", "utf8"));
const PLANETS = [
  ["MERCURY", A.Body.Mercury], ["VENUS", A.Body.Venus], ["MARS", A.Body.Mars],
  ["JUPITER", A.Body.Jupiter], ["SATURN", A.Body.Saturn],
  ["URANUS", A.Body.Uranus], ["NEPTUNE", A.Body.Neptune],
];
const norm = (lon) => ((lon + 540) % 360) - 180;
const t = new Date();
const gast = A.SiderealTime(t);
const subPoint = (body) => {
  const eq = A.Equator(body, t, new A.Observer(0, 0, 0), true, true);
  return { lat: eq.dec, lon: norm(eq.ra * 15 - gast * 15) };
};
const bodies = [
  { name: "SUN", kind: "sun", ...subPoint(A.Body.Sun) },
  { name: "MOON", kind: "moon", ...subPoint(A.Body.Moon) },
  ...PLANETS.map(([name, b]) => ({ name, kind: "planet", ...subPoint(b) })),
];
const stars = STARS.map(([name, ra, dec, mag]) => ({ name, lat: dec, lon: norm(ra * 15 - gast * 15), mag }));
let q = A.SearchMoonQuarter(t);
let nextNew = 0, nextFull = 0;
for (let i = 0; i < 5 && !(nextNew && nextFull); i++) {
  if (q.quarter === 0 && !nextNew) nextNew = q.time.date.getTime();
  if (q.quarter === 2 && !nextFull) nextFull = q.time.date.getTime();
  q = A.NextMoonQuarter(q);
}
console.log(JSON.stringify({
  asOf: t.getTime(), bodies, stars,
  phaseDeg: A.MoonPhase(t), illum: A.Illumination(A.Body.Moon, t).phase_fraction,
  nextNew, nextFull,
}));
