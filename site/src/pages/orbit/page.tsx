// EARTH ORBIT · HELIOCENTRIC — the analemma on the CONTRACT renderer. The
// sun's sub-point sampled at this exact UTC clock-time across all 365 days of
// the year traces the figure-8 signature of orbital eccentricity × axial tilt;
// today's sun rides it in gold. Readouts: heliocentric distance, orbital
// velocity, next season point, next apsis. Computed locally — always live.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import * as A from "astronomy-engine";
import { useEffect, useState } from "react";
import snapshot from "./snapshot.json";

interface Pt {
  lat: number;
  lon: number;
}
interface OrbitData {
  asOf: number;
  analemma: Pt[];
  subsolar: Pt;
  distAu: number;
  velKms: number;
  nextSeason: { name: string; t: number };
  nextApsis: { name: string; t: number; distAu: number };
}

const AU_KM = 149_597_870.7;
const norm = (lon: number): number => ((lon + 540) % 360) - 180;

function subsolarAt(t: Date): Pt {
  const gast = A.SiderealTime(t);
  const eq = A.Equator(A.Body.Sun, t, new A.Observer(0, 0, 0), true, true);
  return { lat: eq.dec, lon: norm(eq.ra * 15 - gast * 15) };
}

function compute(): OrbitData {
  const t = new Date();
  const year = t.getUTCFullYear();
  // the analemma: this clock-time, every 4th day of the year
  const analemma: Pt[] = [];
  for (let doy = 0; doy < 365; doy += 4) {
    const d = new Date(Date.UTC(year, 0, 1) + doy * 86400000);
    d.setUTCHours(t.getUTCHours(), t.getUTCMinutes(), 0, 0);
    analemma.push(subsolarAt(d));
  }
  const v1 = A.HelioVector(A.Body.Earth, t);
  const v2 = A.HelioVector(A.Body.Earth, new Date(t.getTime() + 3600_000));
  const distAu = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const velKms = (Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2 + (v2.z - v1.z) ** 2) * AU_KM) / 3600;
  const ss = [...Object.entries(seasonTimes(year)), ...Object.entries(seasonTimes(year + 1))]
    .map(([name, time]) => ({ name, t: time }))
    .filter((s) => s.t > t.getTime())
    .sort((a, b) => a.t - b.t)[0];
  const ap = A.SearchPlanetApsis(A.Body.Earth, t);
  return {
    asOf: t.getTime(),
    analemma,
    subsolar: subsolarAt(t),
    distAu,
    velKms,
    nextSeason: ss,
    nextApsis: { name: ap.kind === 1 ? "APHELION" : "PERIHELION", t: ap.time.date.getTime(), distAu: ap.dist_au },
  };
}

function seasonTimes(year: number): Record<string, number> {
  const s = A.Seasons(year);
  return {
    "MAR EQUINOX": s.mar_equinox.date.getTime(),
    "JUN SOLSTICE": s.jun_solstice.date.getTime(),
    "SEP EQUINOX": s.sep_equinox.date.getTime(),
    "DEC SOLSTICE": s.dec_solstice.date.getTime(),
  };
}

const feed: DataFeed<OrbitData> = {
  id: "earth-orbit-ephemeris",
  snapshot: snapshot as OrbitData,
  refreshMs: 60_000,
  // no network — the orbit computes live, always
  fetchLive: async () => compute(),
};

const MINT = "rgba(127,230,200,.92)";
const GOLD = "rgba(240,206,150,.95)";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dstamp = (t: number): string => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

function OrbitCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as OrbitData);
  const pips: HoloPip[] = [
    ...d.analemma.map((p) => ({ lat: p.lat, lon: p.lon, size: 1.1, color: MINT })),
    { lat: d.subsolar.lat, lon: d.subsolar.lon, size: 6, color: GOLD },
  ];
  const marks: HoloMark[] = [{ deg: ((d.subsolar.lon % 360) + 360) % 360, color: "#F0CE96" }];
  return <HoloCanvas pips={pips} marks={marks} />;
}

function LeftCol() {
  const state = useFeed(feed);
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const d = state?.data ?? (snapshot as OrbitData);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">sun distance</span>
        <span className="v g">{d.distAu.toFixed(4)}<span className="u"> AU</span></span>
      </div>
      <div className="cell">
        <span className="k">orbital velocity</span>
        <span className="v">{d.velKms.toFixed(2)}<span className="u"> KM/S</span></span>
      </div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as OrbitData);
  return (
    <>
      <div className="cell">
        <span className="k">next season point</span>
        <span className="v g">{d.nextSeason.name}</span>
        <span className="u">{dstamp(d.nextSeason.t)}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">next apsis</span>
        <span className="v m">{d.nextApsis.name}</span>
        <span className="u">{dstamp(d.nextApsis.t)} · {d.nextApsis.distAu.toFixed(4)} AU</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">EPHEMERIS</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 orbit cells. */
function Preview() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as OrbitData);
  return (
    <>
      <div className="cell">
        <span className="k">next</span>
        <span className="v m">{d.nextSeason.name}</span>
        <span className="u">{dstamp(d.nextSeason.t)}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">sun distance</span>
        <span className="v g">{d.distAu.toFixed(3)}<span className="u"> AU</span></span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">velocity</span>
        <span className="v">{d.velKms.toFixed(1)}<span className="u"> KM/S</span></span>
      </div>
    </>
  );
}

const page: AlmanacPage<OrbitData> = {
  meta: {
    id: "orbit",
    title: "EARTH ORBIT · HELIOCENTRIC",
    system: "orbit",
    classification: "EPHEMERIS · ANALEMMA · APSIDES & SEASON POINTS",
    order: 8,
    index: "EARTH ORBIT",
  },
  Canvas: OrbitCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
};

export default page;
