// POSITION · GEODETIC FIX — the WGS-84 frame on the CONTRACT renderer.
// The UNIVERSAL coordinate is the subsolar point: the lat/lon where the Sun is
// directly overhead right now. Like UTC, it is the same for everyone, needs no
// permission, and ticks live — the spatial companion to the universal clock,
// shown in gold. The visitor's own GNSS fix is an optional upgrade (magenta),
// and only the instrument page may prompt for it.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import * as A from "astronomy-engine";
import { useEffect, useState } from "react";

interface Fix {
  lat: number;
  lon: number;
  accM: number | null;
  altM: number | null;
}
interface Sub {
  lat: number;
  lon: number;
}
interface PosData {
  asOf: number;
  /** universal: the subsolar point (sun overhead) — always present, no permission */
  subsolar: Sub;
  /** the visitor's own position — only when GNSS is granted */
  fix: Fix | null;
}

/** The subsolar point now — universal, permission-free, derived from time itself. */
function subsolarNow(): Sub {
  const t = new Date();
  const gast = A.SiderealTime(t);
  const eq = A.Equator(A.Body.Sun, t, new A.Observer(0, 0, 0), true, true);
  const lon = ((eq.ra * 15 - gast * 15 + 540) % 360) - 180;
  return { lat: eq.dec, lon };
}

/** Precise browser GNSS — prompts; only called on the instrument page. */
function gnssFix(): Promise<Fix> {
  return new Promise<Fix>((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, accM: p.coords.accuracy, altM: p.coords.altitude }),
      () => rej(new Error("gnss denied")),
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

const feed: DataFeed<PosData> = {
  id: "geodetic-fix",
  snapshot: { asOf: 0, subsolar: subsolarNow(), fix: null },
  refreshMs: 60_000,
  // universal subsolar always; the personal GNSS fix only on the instrument page
  fetchLive: async () => {
    const subsolar = subsolarNow();
    let fix: Fix | null = null;
    if (window.location.hash === "#/page/position" && navigator.geolocation) {
      const perm = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
      if (perm?.state !== "denied") {
        fix = await gnssFix().catch(() => null);
      }
    }
    return { asOf: Date.now(), subsolar, fix };
  },
};

const MINT = "rgba(127,230,200,.92)";
const GOLD = "rgba(240,206,150,.95)";
const MAGENTA = "rgba(255,43,214,.95)";

const fmt = (v: number, pos: string, neg: string): string => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;

function PosCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const sub = state?.data.subsolar ?? subsolarNow();
  const fix = state?.data.fix ?? null;
  const pips: HoloPip[] = [];
  // the reference frame: equator + prime meridian + Greenwich origin
  for (let lon = -180; lon < 180; lon += 5) pips.push({ lat: 0, lon, size: 0.9, color: MINT });
  for (let lat = -85; lat <= 85; lat += 5) if (lat !== 0) pips.push({ lat, lon: 0, size: 0.9, color: MINT });
  pips.push({ lat: 0, lon: 0, size: 3.5, color: MINT });
  // the universal subsolar point — always lit, in gold
  pips.push({ lat: sub.lat, lon: sub.lon, size: 6, color: GOLD });
  if (fix) pips.push({ lat: fix.lat, lon: fix.lon, size: 5, color: MAGENTA });
  const marks: HoloMark[] = [{ deg: ((sub.lon % 360) + 360) % 360, color: "#F0CE96" }];
  if (fix) marks.push({ deg: ((fix.lon % 360) + 360) % 360, color: "#ff2bd6" });
  return <HoloCanvas pips={pips} marks={marks} />;
}

/** Universal column — UTC + subsolar lat/lon, all ticking, all permission-free. */
function LeftCol() {
  const [now, setNow] = useState(() => ({ utc: new Date().toISOString().slice(11, 19), sub: subsolarNow() }));
  useEffect(() => {
    const t = setInterval(() => setNow({ utc: new Date().toISOString().slice(11, 19), sub: subsolarNow() }), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{now.utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">subsolar lat</span>
        <span className="v g">{fmt(now.sub.lat, "N", "S")}</span>
        <span className="u">UNIVERSAL · SUN OVERHEAD</span>
      </div>
      <div className="cell">
        <span className="k">subsolar lon</span>
        <span className="v g">{fmt(now.sub.lon, "E", "W")}</span>
      </div>
    </>
  );
}

/** Personal column — the visitor's own GNSS fix (optional). */
function RightCol() {
  const state = useFeed(feed);
  const fix = state?.data.fix ?? null;
  return (
    <>
      <div className="cell">
        <span className="k">your latitude</span>
        <span className="v m">{fix ? fmt(fix.lat, "N", "S") : "—"}</span>
        {!fix && <span className="u">GRANT LOCATION FOR YOUR FIX</span>}
      </div>
      <div className="cell">
        <span className="k">your longitude</span>
        <span className="v m">{fix ? fmt(fix.lon, "E", "W") : "—"}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">accuracy</span>
        <span className="v">{fix?.accM != null ? `±${fix.accM.toFixed(0)}` : "—"}<span className="u"> M</span></span>
      </div>
      <div className="cell"><span className="k">datum</span><span className="v">WGS-84</span></div>
    </>
  );
}

/** Globe-index preview — universal subsolar + datum. */
function Preview() {
  const [sub, setSub] = useState(subsolarNow);
  useEffect(() => {
    const t = setInterval(() => setSub(subsolarNow()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="cell">
        <span className="k">subsolar lat</span>
        <span className="v g">{fmt(sub.lat, "N", "S")}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">subsolar lon</span>
        <span className="v g">{fmt(sub.lon, "E", "W")}</span>
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
    classification: "WGS-84 · SUBSOLAR UNIVERSAL · GNSS PERSONAL FIX",
    order: 7,
  },
  Canvas: PosCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what POSITION reads at a searched place: range from the universal subsolar
  // point (always), and from your own fix when granted
  probe: (p, d) => {
    const cells = [
      {
        k: "from subsolar",
        v: haversineKm(p.lat, p.lon, d.subsolar.lat, d.subsolar.lon).toFixed(0),
        cls: "g",
        u: "KM · UNIVERSAL",
      },
    ];
    if (d.fix) {
      cells.push({ k: "from your fix", v: haversineKm(p.lat, p.lon, d.fix.lat, d.fix.lon).toFixed(0), cls: "m", u: "KM" });
    }
    return cells;
  },
};

export default page;
