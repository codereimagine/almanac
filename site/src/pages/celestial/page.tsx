// STARS · PLANETS — the sky projected onto the Earth, on the CONTRACT renderer.
// Zenith sub-points computed locally with astronomy-engine (bewthr's ephemeris
// lib): Sun in gold, Moon in white-cyan, the seven planets in amber, the 25
// brightest stars in mint (J2000 catalog, bundled facts). No network — the
// ephemeris is always live. Readouts: moon phase, subsolar, next full/new moon.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { angularDeg, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import * as A from "astronomy-engine";
import { useEffect, useState } from "react";
import snapshot from "./snapshot.json";
import starsTable from "./stars.json";

interface CelBody {
  name: string;
  lat: number;
  lon: number;
  kind: "sun" | "moon" | "planet";
}
interface CelStar {
  name: string;
  lat: number;
  lon: number;
  mag: number;
}
interface CelData {
  asOf: number;
  bodies: CelBody[];
  stars: CelStar[];
  phaseDeg: number;
  illum: number;
  nextNew: number;
  nextFull: number;
}

const STARS = starsTable as unknown as [string, number, number, number][];
const PLANETS: [string, A.Body][] = [
  ["MERCURY", A.Body.Mercury],
  ["VENUS", A.Body.Venus],
  ["MARS", A.Body.Mars],
  ["JUPITER", A.Body.Jupiter],
  ["SATURN", A.Body.Saturn],
  ["URANUS", A.Body.Uranus],
  ["NEPTUNE", A.Body.Neptune],
];

const norm = (lon: number): number => ((lon + 540) % 360) - 180;

function subPoint(body: A.Body, t: Date, gast: number): { lat: number; lon: number } {
  const eq = A.Equator(body, t, new A.Observer(0, 0, 0), true, true);
  return { lat: eq.dec, lon: norm(eq.ra * 15 - gast * 15) };
}

function compute(): CelData {
  const t = new Date();
  const gast = A.SiderealTime(t);
  const bodies: CelBody[] = [
    { name: "SUN", kind: "sun", ...subPoint(A.Body.Sun, t, gast) },
    { name: "MOON", kind: "moon", ...subPoint(A.Body.Moon, t, gast) },
    ...PLANETS.map(([name, b]) => ({ name, kind: "planet" as const, ...subPoint(b, t, gast) })),
  ];
  // J2000 catalog positions ≈ of-date at pip scale; the stars ride sidereal time
  const stars: CelStar[] = STARS.map(([name, ra, dec, mag]) => ({
    name,
    lat: dec,
    lon: norm(ra * 15 - gast * 15),
    mag,
  }));
  let q = A.SearchMoonQuarter(t);
  let nextNew = 0;
  let nextFull = 0;
  for (let i = 0; i < 5 && !(nextNew && nextFull); i++) {
    if (q.quarter === 0 && !nextNew) nextNew = q.time.date.getTime();
    if (q.quarter === 2 && !nextFull) nextFull = q.time.date.getTime();
    q = A.NextMoonQuarter(q);
  }
  return {
    asOf: t.getTime(),
    bodies,
    stars,
    phaseDeg: A.MoonPhase(t),
    illum: A.Illumination(A.Body.Moon, t).phase_fraction,
    nextNew,
    nextFull,
  };
}

const feed: DataFeed<CelData> = {
  id: "ephemeris-zenith",
  snapshot: snapshot as CelData,
  refreshMs: 60_000,
  // no network — the ephemeris computes live, always
  fetchLive: async () => compute(),
};

const MINT = "rgba(127,230,200,.92)";
const AMBER = "rgba(255,180,94,.95)";
const GOLD = "rgba(240,206,150,.95)";
const WHITE = "rgba(234,249,255,.95)";

const PHASES = [
  "NEW MOON", "WAXING CRESCENT", "FIRST QUARTER", "WAXING GIBBOUS",
  "FULL MOON", "WANING GIBBOUS", "THIRD QUARTER", "WANING CRESCENT", "NEW MOON",
];
const phaseName = (deg: number): string => PHASES[Math.floor(((deg + 22.5) % 360) / 45)];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dstamp = (t: number): string => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} · ${d.toISOString().slice(11, 16)} UTC`;
};
const fmt = (v: number, pos: string, neg: string): string => `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`;

function CelCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as CelData);
  const pips: HoloPip[] = [
    ...d.stars.map((s) => ({ lat: s.lat, lon: s.lon, size: Math.max(0.5, 1.8 - s.mag * 0.5), color: MINT })),
    ...d.bodies.map((b) => ({
      lat: b.lat,
      lon: b.lon,
      size: b.kind === "sun" ? 6 : b.kind === "moon" ? 5 : 3,
      color: b.kind === "sun" ? GOLD : b.kind === "moon" ? WHITE : AMBER,
    })),
  ];
  const marks: HoloMark[] = d.bodies
    .filter((b) => ["SUN", "MOON", "VENUS"].includes(b.name))
    .map((b) => ({ deg: ((b.lon % 360) + 360) % 360, color: "#F0CE96" }));
  return <HoloCanvas pips={pips} marks={marks} />;
}

function LeftCol() {
  const state = useFeed(feed);
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const d = state?.data ?? (snapshot as CelData);
  const sun = d.bodies.find((b) => b.kind === "sun");
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">moon</span>
        <span className="v m">{phaseName(d.phaseDeg)}</span>
        <span className="u">{(d.illum * 100).toFixed(0)}% ILLUMINATED</span>
      </div>
      <div className="cell">
        <span className="k">subsolar</span>
        <span className="v g">{sun ? `${fmt(sun.lat, "N", "S")} ${fmt(sun.lon, "E", "W")}` : "—"}</span>
      </div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as CelData);
  return (
    <>
      <div className="cell">
        <span className="k">next full moon</span>
        <span className="v g">{dstamp(d.nextFull).split(" · ")[0]}</span>
        <span className="u">{dstamp(d.nextFull).split(" · ")[1]}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">next new moon</span>
        <span className="v">{dstamp(d.nextNew).split(" · ")[0]}</span>
        <span className="u">{dstamp(d.nextNew).split(" · ")[1]}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">bodies · stars</span><span className="v">{d.bodies.length} · {d.stars.length}</span></div>
      <div className="cell"><span className="k">source</span><span className="v">EPHEMERIS</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 celestial cells. */
function Preview() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as CelData);
  return (
    <>
      <div className="cell">
        <span className="k">moon</span>
        <span className="v m">{phaseName(d.phaseDeg)}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">next full moon</span>
        <span className="v g">{dstamp(d.nextFull).split(" · ")[0]}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">bodies · stars</span><span className="v">{d.bodies.length} · {d.stars.length}</span></div>
    </>
  );
}

const page: AlmanacPage<CelData> = {
  meta: {
    id: "celestial",
    title: "STARS · PLANETS · ZENITH TRACE",
    system: "celestial",
    classification: "LOCAL EPHEMERIS · ZENITH SUB-POINTS · J2000 CATALOG",
    order: 5,
    index: "STARS · PLANETS",
  },
  Canvas: CelCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what the sky does over a searched place: altitude = 90° − distance to sub-point
  probe: (p, d) => {
    const alt = (kind: string): number | null => {
      const b = d.bodies.find((x) => x.kind === kind);
      return b ? 90 - angularDeg(p.lat, p.lon, b.lat, b.lon) : null;
    };
    const sa = alt("sun");
    const ma = alt("moon");
    const cell = (k: string, a: number | null, cls: string) => ({
      k,
      v: a != null ? `${a.toFixed(1)}°` : "—",
      cls: a != null && a > 0 ? cls : "",
      u: a != null ? (a > 0 ? "ABOVE HORIZON" : "BELOW HORIZON") : "",
    });
    return [cell("sun altitude", sa, "g"), cell("moon altitude", ma, "m")];
  },
};

export default page;
