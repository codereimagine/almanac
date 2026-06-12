// POSITION · GEODETIC FIX — the WGS-84 reference frame on the CONTRACT
// renderer: equator and prime meridian traced in mint, the Greenwich origin
// in gold. With a granted browser fix the visitor appears as a magenta pip at
// true coordinates. LIVE = fix acquired; otherwise the frame renders from
// snapshot. The permission prompt only ever fires on THIS page — the index
// previews the frame silently and shows the fix once granted elsewhere.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import { useEffect, useState } from "react";

interface Fix {
  lat: number;
  lon: number;
  accM: number;
  altM: number | null;
}
interface PosData {
  asOf: number;
  fix: Fix | null;
}

const feed: DataFeed<PosData> = {
  id: "gnss-browser-fix",
  snapshot: { asOf: 0, fix: null },
  refreshMs: 120_000,
  fetchLive: async () => {
    if (!navigator.geolocation) throw new Error("no geolocation");
    const perm = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
    // never prompt from the index — only the instrument itself may ask
    if (perm?.state !== "granted" && window.location.hash !== "#/page/position") throw new Error("fix deferred");
    const p = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, () => rej(new Error("fix denied")), {
        timeout: 8000,
        maximumAge: 60_000,
      }),
    );
    return {
      asOf: p.timestamp,
      fix: {
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accM: p.coords.accuracy,
        altM: p.coords.altitude,
      },
    };
  },
};

const MINT = "rgba(127,230,200,.92)";
const GOLD = "rgba(240,206,150,.95)";
const MAGENTA = "rgba(255,43,214,.95)";

const fmt = (v: number, pos: string, neg: string): string => `${Math.abs(v).toFixed(4)}°${v >= 0 ? pos : neg}`;

function PosCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const fix = state?.data.fix ?? null;
  const pips: HoloPip[] = [];
  // the reference frame itself: equator + prime meridian + Greenwich origin
  for (let lon = -180; lon < 180; lon += 5) pips.push({ lat: 0, lon, size: 0.9, color: MINT });
  for (let lat = -85; lat <= 85; lat += 5) if (lat !== 0) pips.push({ lat, lon: 0, size: 0.9, color: MINT });
  pips.push({ lat: 0, lon: 0, size: 3.5, color: GOLD });
  if (fix) pips.push({ lat: fix.lat, lon: fix.lon, size: 5, color: MAGENTA });
  const marks: HoloMark[] = [{ deg: 0, color: "#F0CE96" }];
  if (fix) marks.push({ deg: ((fix.lon % 360) + 360) % 360, color: "#ff2bd6" });
  return <HoloCanvas pips={pips} marks={marks} />;
}

function LeftCol() {
  const state = useFeed(feed);
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const fix = state?.data.fix ?? null;
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">latitude</span>
        <span className="v m">{fix ? fmt(fix.lat, "N", "S") : "NO FIX"}</span>
      </div>
      <div className="cell">
        <span className="k">longitude</span>
        <span className="v m">{fix ? fmt(fix.lon, "E", "W") : "—"}</span>
        {!fix && <span className="u">GRANT LOCATION TO ACQUIRE</span>}
      </div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const fix = state?.data.fix ?? null;
  return (
    <>
      <div className="cell">
        <span className="k">accuracy</span>
        <span className="v g">{fix ? `±${fix.accM.toFixed(0)}` : "—"}<span className="u"> M</span></span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">altitude</span>
        <span className="v">{fix?.altM != null ? fix.altM.toFixed(0) : "—"}<span className="u"> M</span></span>
      </div>
      <div className="cell"><span className="k">datum</span><span className="v">WGS-84</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">GNSS · BROWSER</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 position cells. */
function Preview() {
  const state = useFeed(feed);
  const fix = state?.data.fix ?? null;
  return (
    <>
      <div className="cell">
        <span className="k">fix</span>
        <span className="v m">{fix ? "ACQUIRED" : "NO FIX"}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">datum</span><span className="v g">WGS-84</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">accuracy</span>
        <span className="v">{fix ? `±${fix.accM.toFixed(0)}` : "—"}<span className="u"> M</span></span>
      </div>
    </>
  );
}

const page: AlmanacPage<PosData> = {
  meta: {
    id: "position",
    title: "POSITION · GEODETIC FIX",
    system: "position",
    classification: "WGS-84 · GNSS BROWSER FIX · REFERENCE FRAME",
    order: 7,
  },
  Canvas: PosCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what POSITION reads at a searched place: range from your fix (or from Greenwich)
  probe: (lat, lon, d) => {
    if (d.fix)
      return [
        { k: "from your fix", v: haversineKm(lat, lon, d.fix.lat, d.fix.lon).toFixed(0), cls: "g", u: "KM" },
        { k: "datum", v: "WGS-84" },
      ];
    return [
      { k: "from greenwich", v: haversineKm(lat, lon, 51.4769, 0).toFixed(0), cls: "g", u: "KM" },
      { k: "fix", v: "NO FIX", cls: "m" },
    ];
  },
};

export default page;
