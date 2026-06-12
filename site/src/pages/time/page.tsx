// TIME · SYNCHRONIZATION — the day/night terminator on the CONTRACT renderer.
// The sunlit hemisphere's edge traced as 120 mint pips (the terminator is a
// great circle 90° from the subsolar point), subsolar in gold, the midnight
// antisolar point in magenta. All clock faces computed locally — UTC, Greenwich
// apparent sidereal time, Julian date. Always live; the terminator slides west.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { angularDeg, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import * as A from "astronomy-engine";
import { useEffect, useState } from "react";
import snapshot from "./snapshot.json";

interface Pt {
  lat: number;
  lon: number;
}
interface TimeData {
  asOf: number;
  subsolar: Pt;
  antisolar: Pt;
  terminator: Pt[];
  gastH: number;
  jd: number;
  doy: number;
}

const D = Math.PI / 180;
const norm = (lon: number): number => ((lon + 540) % 360) - 180;

/** Points at 90° angular distance from the subsolar point — the terminator. */
function terminatorRing(s: Pt, step = 3): Pt[] {
  const ring: Pt[] = [];
  for (let az = 0; az < 360; az += step) {
    const sinLat = Math.cos(az * D) * Math.cos(s.lat * D);
    const lat = Math.asin(sinLat) / D;
    const lon = s.lon + Math.atan2(Math.sin(az * D) * Math.cos(s.lat * D), -Math.sin(s.lat * D) * sinLat) / D;
    ring.push({ lat, lon: norm(lon) });
  }
  return ring;
}

function compute(): TimeData {
  const t = new Date();
  const gast = A.SiderealTime(t);
  const eq = A.Equator(A.Body.Sun, t, new A.Observer(0, 0, 0), true, true);
  const subsolar: Pt = { lat: eq.dec, lon: norm(eq.ra * 15 - gast * 15) };
  const antisolar: Pt = { lat: -subsolar.lat, lon: norm(subsolar.lon + 180) };
  const doy = Math.floor((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 0)) / 86400000);
  return {
    asOf: t.getTime(),
    subsolar,
    antisolar,
    terminator: terminatorRing(subsolar),
    gastH: gast,
    jd: t.getTime() / 86400000 + 2440587.5,
    doy,
  };
}

const feed: DataFeed<TimeData> = {
  id: "time-terminator",
  snapshot: snapshot as TimeData,
  refreshMs: 60_000,
  // no network — the clock computes live, always
  fetchLive: async () => compute(),
};

const MINT = "rgba(127,230,200,.92)";
const GOLD = "rgba(240,206,150,.95)";
const MAGENTA = "rgba(255,43,214,.95)";

const hms = (h: number): string => {
  const x = ((h % 24) + 24) % 24;
  const m = (x * 60) % 60;
  const s = (x * 3600) % 60;
  return `${String(Math.floor(x)).padStart(2, "0")}:${String(Math.floor(m)).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}`;
};

function TimeCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as TimeData);
  const pips: HoloPip[] = [
    ...d.terminator.map((p) => ({ lat: p.lat, lon: p.lon, size: 0.9, color: MINT })),
    { lat: d.subsolar.lat, lon: d.subsolar.lon, size: 6, color: GOLD },
    { lat: d.antisolar.lat, lon: d.antisolar.lon, size: 4, color: MAGENTA },
  ];
  const marks: HoloMark[] = [
    { deg: ((d.subsolar.lon % 360) + 360) % 360, color: "#F0CE96" },
    { deg: ((d.antisolar.lon % 360) + 360) % 360, color: "#ff2bd6" },
  ];
  return <HoloCanvas pips={pips} marks={marks} />;
}

function LeftCol() {
  const state = useFeed(feed);
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const d = state?.data ?? (snapshot as TimeData);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">sidereal · gast</span>
        <span className="v m">{hms(d.gastH)}</span>
      </div>
      <div className="cell">
        <span className="k">solar noon at</span>
        <span className="v g">{Math.abs(d.subsolar.lon).toFixed(1)}°{d.subsolar.lon >= 0 ? "E" : "W"}</span>
      </div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as TimeData);
  return (
    <>
      <div className="cell">
        <span className="k">julian date</span>
        <span className="v g">{d.jd.toFixed(3)}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">day of year</span><span className="v">{d.doy}</span></div>
      <div className="cell"><span className="k">epoch</span><span className="v">J2000 +{((d.jd - 2451545) / 365.25).toFixed(2)}<span className="u"> Y</span></span></div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">LOCAL CLOCK</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 time cells. */
function Preview() {
  const state = useFeed(feed);
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const d = state?.data ?? (snapshot as TimeData);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v m">{utc}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">sidereal</span><span className="v g">{hms(d.gastH)}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">day of year</span><span className="v">{d.doy}</span></div>
    </>
  );
}

const page: AlmanacPage<TimeData> = {
  meta: {
    id: "time",
    title: "TIME · SYNCHRONIZATION",
    system: "time",
    classification: "UTC · SIDEREAL · JULIAN EPOCH · DAY/NIGHT TERMINATOR",
    order: 6,
  },
  Canvas: TimeCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what TIME reads at a searched place: local solar time + which side of the terminator
  probe: (lat, lon, d) => {
    const solar = new Date(Date.now() + lon * 4 * 60_000).toISOString().slice(11, 16);
    const day = angularDeg(lat, lon, d.subsolar.lat, d.subsolar.lon) < 90;
    return [
      { k: "solar time", v: solar, cls: "g" },
      { k: "state", v: day ? "DAYLIGHT" : "NIGHT", cls: day ? "" : "m" },
    ];
  },
};

export default page;
