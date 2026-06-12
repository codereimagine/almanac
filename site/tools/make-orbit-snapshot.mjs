// Snapshot generator for 09 EARTH ORBIT — mirrors page.tsx compute() exactly.
import * as A from "astronomy-engine";

const AU_KM = 149597870.7;
const norm = (lon) => ((lon + 540) % 360) - 180;
const subsolarAt = (d) => {
  const gast = A.SiderealTime(d);
  const eq = A.Equator(A.Body.Sun, d, new A.Observer(0, 0, 0), true, true);
  return { lat: eq.dec, lon: norm(eq.ra * 15 - gast * 15) };
};
const t = new Date();
const year = t.getUTCFullYear();
const analemma = [];
for (let doy = 0; doy < 365; doy += 4) {
  const d = new Date(Date.UTC(year, 0, 1) + doy * 86400000);
  d.setUTCHours(t.getUTCHours(), t.getUTCMinutes(), 0, 0);
  analemma.push(subsolarAt(d));
}
const v1 = A.HelioVector(A.Body.Earth, t);
const v2 = A.HelioVector(A.Body.Earth, new Date(t.getTime() + 3600000));
const distAu = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
const velKms = (Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2 + (v2.z - v1.z) ** 2) * AU_KM) / 3600;
const seasonTimes = (y) => {
  const s = A.Seasons(y);
  return {
    "MAR EQUINOX": s.mar_equinox.date.getTime(),
    "JUN SOLSTICE": s.jun_solstice.date.getTime(),
    "SEP EQUINOX": s.sep_equinox.date.getTime(),
    "DEC SOLSTICE": s.dec_solstice.date.getTime(),
  };
};
const ss = [...Object.entries(seasonTimes(year)), ...Object.entries(seasonTimes(year + 1))]
  .map(([name, time]) => ({ name, t: time }))
  .filter((s) => s.t > t.getTime())
  .sort((a, b) => a.t - b.t)[0];
const ap = A.SearchPlanetApsis(A.Body.Earth, t);
console.log(JSON.stringify({
  asOf: t.getTime(), analemma, subsolar: subsolarAt(t), distAu, velKms,
  nextSeason: ss,
  nextApsis: { name: ap.kind === 1 ? "APHELION" : "PERIHELION", t: ap.time.date.getTime(), distAu: ap.dist_au },
}));
