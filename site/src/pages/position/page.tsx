// POSITION · GEODETIC FIX — the WGS-84 frame on the CONTRACT renderer.
// The UNIVERSAL coordinates are the celestial sub-points: where the Sun (gold)
// and Moon (silver) are directly overhead right now. Like UTC they need no
// permission, are the same for everyone, and tick live — sun on the left beside
// the clock, moon on the right. Grant location and your own GNSS fix (magenta)
// takes the right column. No empty placeholders, ever.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import * as A from "astronomy-engine";
import { useEffect, useState } from "react";

interface Fix {
  lat: number;
  lon: number;
  accM: number | null;
}
interface Sub {
  lat: number;
  lon: number;
}
interface PosData {
  asOf: number;
  /** universal: sub-points of Sun and Moon — always present, no permission */
  subsolar: Sub;
  sublunar: Sub;
  /** the visitor's own position — only when GNSS is granted */
  fix: Fix | null;
}

/** Sub-point of a body now — the lat/lon where it is directly overhead. */
function subPoint(body: A.Body): Sub {
  const t = new Date();
  const gast = A.SiderealTime(t);
  const eq = A.Equator(body, t, new A.Observer(0, 0, 0), true, true);
  return { lat: eq.dec, lon: ((eq.ra * 15 - gast * 15 + 540) % 360) - 180 };
}
const subsolarNow = (): Sub => subPoint(A.Body.Sun);
const sublunarNow = (): Sub => subPoint(A.Body.Moon);

/** Precise browser GNSS — prompts; only called on the instrument page. */
function gnssFix(): Promise<Fix> {
  return new Promise<Fix>((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, accM: p.coords.accuracy }),
      () => rej(new Error("gnss denied")),
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

const feed: DataFeed<PosData> = {
  id: "geodetic-fix",
  snapshot: { asOf: 0, subsolar: subsolarNow(), sublunar: sublunarNow(), fix: null },
  refreshMs: 60_000,
  // universal sun + moon sub-points always; the personal GNSS fix only on the page
  fetchLive: async () => {
    let fix: Fix | null = null;
    if (window.location.hash === "#/page/position" && navigator.geolocation) {
      const perm = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
      if (perm?.state !== "denied") fix = await gnssFix().catch(() => null);
    }
    return { asOf: Date.now(), subsolar: subsolarNow(), sublunar: sublunarNow(), fix };
  },
};

const MINT = "rgba(127,230,200,.92)";
const GOLD = "rgba(240,206,150,.95)";
const SILVER = "rgba(234,249,255,.95)";
const MAGENTA = "rgba(255,43,214,.95)";

const fmt = (v: number, pos: string, neg: string): string => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;

/** A 1s-ticking pair of sub-points (universal, permission-free). */
function useSubPoints(): { sun: Sub; moon: Sub } {
  const [s, setS] = useState(() => ({ sun: subsolarNow(), moon: sublunarNow() }));
  useEffect(() => {
    const t = setInterval(() => setS({ sun: subsolarNow(), moon: sublunarNow() }), 1000);
    return () => clearInterval(t);
  }, []);
  return s;
}

function PosCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const { sun, moon } = useSubPoints();
  const fix = state?.data.fix ?? null;
  const pips: HoloPip[] = [];
  // the reference frame: equator + prime meridian + Greenwich origin
  for (let lon = -180; lon < 180; lon += 5) pips.push({ lat: 0, lon, size: 0.9, color: MINT });
  for (let lat = -85; lat <= 85; lat += 5) if (lat !== 0) pips.push({ lat, lon: 0, size: 0.9, color: MINT });
  pips.push({ lat: 0, lon: 0, size: 3.5, color: MINT });
  // the universal sub-points — sun gold, moon silver
  pips.push({ lat: sun.lat, lon: sun.lon, size: 6, color: GOLD });
  pips.push({ lat: moon.lat, lon: moon.lon, size: 5, color: SILVER });
  if (fix) pips.push({ lat: fix.lat, lon: fix.lon, size: 5, color: MAGENTA });
  const marks: HoloMark[] = [
    { deg: ((sun.lon % 360) + 360) % 360, color: "#F0CE96" },
    { deg: ((moon.lon % 360) + 360) % 360, color: "#eaf9ff" },
  ];
  if (fix) marks.push({ deg: ((fix.lon % 360) + 360) % 360, color: "#ff2bd6" });
  return <HoloCanvas pips={pips} marks={marks} />;
}

/** Universal column — UTC + the Sun's sub-point, ticking, permission-free. */
function LeftCol() {
  const { sun } = useSubPoints();
  const [utc, setUtc] = useState(() => new Date().toISOString().slice(11, 19));
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">subsolar lat</span>
        <span className="v g">{fmt(sun.lat, "N", "S")}</span>
        <span className="u">SUN OVERHEAD · UNIVERSAL</span>
      </div>
      <div className="cell">
        <span className="k">subsolar lon</span>
        <span className="v g">{fmt(sun.lon, "E", "W")}</span>
      </div>
    </>
  );
}

/** Right column — your own GNSS fix when granted, else the Moon's sub-point. */
function RightCol() {
  const state = useFeed(feed);
  const { moon } = useSubPoints();
  const fix = state?.data.fix ?? null;
  if (fix) {
    return (
      <>
        <div className="cell">
          <span className="k">your latitude</span>
          <span className="v m">{fmt(fix.lat, "N", "S")}</span>
        </div>
        <div className="cell">
          <span className="k">your longitude</span>
          <span className="v m">{fmt(fix.lon, "E", "W")}</span>
        </div>
        <div className="rule" />
        <div className="cell">
          <span className="k">accuracy</span>
          <span className="v">{fix.accM != null ? `±${fix.accM.toFixed(0)}` : "GNSS"}<span className="u"> M</span></span>
        </div>
        <div className="cell"><span className="k">datum</span><span className="v">WGS-84</span></div>
      </>
    );
  }
  return (
    <>
      <div className="cell">
        <span className="k">sublunar lat</span>
        <span className="v">{fmt(moon.lat, "N", "S")}</span>
        <span className="u">MOON OVERHEAD · UNIVERSAL</span>
      </div>
      <div className="cell">
        <span className="k">sublunar lon</span>
        <span className="v">{fmt(moon.lon, "E", "W")}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">datum</span><span className="v">WGS-84</span></div>
    </>
  );
}

/** Globe-index preview — universal sun & moon sub-points. */
function Preview() {
  const { sun, moon } = useSubPoints();
  return (
    <>
      <div className="cell">
        <span className="k">subsolar</span>
        <span className="v g">{fmt(sun.lat, "N", "S")}</span>
        <span className="u">{fmt(sun.lon, "E", "W")}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">sublunar</span>
        <span className="v">{fmt(moon.lat, "N", "S")}</span>
        <span className="u">{fmt(moon.lon, "E", "W")}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">datum</span><span className="v">WGS-84</span></div>
    </>
  );
}

const page: AlmanacPage<PosData> = {
  meta: {
    id: "position",
    title: "POSITION · GEODETIC FIX",
    system: "position",
    classification: "WGS-84 · SUN & MOON UNIVERSAL · GNSS PERSONAL FIX",
    order: 7,
  },
  Canvas: PosCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // range to the universal sub-points (always), plus your own fix when granted
  probe: (p, d) => {
    const cells = [
      { k: "from subsolar", v: haversineKm(p.lat, p.lon, d.subsolar.lat, d.subsolar.lon).toFixed(0), cls: "g", u: "KM" },
      { k: "from sublunar", v: haversineKm(p.lat, p.lon, d.sublunar.lat, d.sublunar.lon).toFixed(0), u: "KM" },
    ];
    if (d.fix) {
      cells.push({ k: "from your fix", v: haversineKm(p.lat, p.lon, d.fix.lat, d.fix.lon).toFixed(0), cls: "m", u: "KM" });
    }
    return cells;
  },
};

export default page;
