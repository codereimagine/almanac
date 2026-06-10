// CALIBRATION — the engine's reference instrument, v5: the CONTRACT renderer.
// HoloCanvas is the 1:1 port of almanac-fused.html's globe — this page is now
// pixel-faithful to the locked design. Subsolar lives as data in the readouts.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { HoloCanvas } from "@almanac/engine";
import { useEffect, useState } from "react";

interface CalConstants {
  earthRadiusKm: number;
  obliquityDeg: number;
  siderealDayH: number;
  datum: string;
}

const feed: DataFeed<CalConstants> = {
  id: "calibration-constants",
  // snapshot-only by design: calibration is the offline reference instrument
  snapshot: { earthRadiusKm: 6371.0, obliquityDeg: 23.44, siderealDayH: 23.934, datum: "WGS-84" },
};

/** Subsolar point right now (approx ±0.5°). */
function subsolarNow(d = new Date()): { lat: number; lon: number } {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = (d.getTime() - start) / 86400000;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
  const h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  let lon = (12 - h) * 15;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`;

function LeftCol() {
  const [utc, setUtc] = useState("--:--:--");
  const [sun, setSun] = useState(subsolarNow());
  useEffect(() => {
    const t = setInterval(() => {
      setUtc(new Date().toISOString().slice(11, 19));
      setSun(subsolarNow());
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">subsolar</span>
        <span className="v g">{fmt(sun.lat, "N", "S")} {fmt(sun.lon, "E", "W")}</span>
      </div>
      <div className="cell"><span className="k">mode</span><span className="v">REFERENCE</span></div>
    </>
  );
}

function RightCol() {
  const c = feed.snapshot;
  return (
    <>
      <div className="cell">
        <span className="k">radius · eq</span>
        <span className="v">{c.earthRadiusKm.toLocaleString()}<span className="u"> KM</span></span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">obliquity</span><span className="v g">{c.obliquityDeg}°</span></div>
      <div className="cell"><span className="k">sidereal day</span><span className="v">{c.siderealDayH}<span className="u"> H</span></span></div>
      <div className="rule" />
      <div className="cell"><span className="k">datum</span><span className="v">{c.datum}</span></div>
    </>
  );
}

function CalCanvas(_props: CanvasProps) {
  return <HoloCanvas />;
}

const page: AlmanacPage<CalConstants> = {
  meta: {
    id: "calibration",
    title: "CALIBRATION · REFERENCE SPHERE",
    system: "calibration",
    classification: "ENGINE REFERENCE · OFFLINE CONSTANTS · WGS-84",
    order: 0,
  },
  content: null,
  Canvas: CalCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
};

export default page;
