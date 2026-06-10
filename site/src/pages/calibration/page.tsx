// CALIBRATION — the engine's reference instrument, v4: the fused contract.
// Full-bleed HoloGlobe in the bezel, telemetry in the edge columns. The
// subsolar point lives as DATA in the readouts (ornament removed per contract:
// no rings, no targets on the planet). Still entirely in site/ — plugin gate holds.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { Bezel, HoloGlobe } from "@almanac/engine";
import { Canvas as R3F } from "@react-three/fiber";
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

/** Subsolar point right now (approx ±0.5° — instrument-grade for a hologram). */
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
  return (
    <>
      <R3F
        camera={{ fov: 45, position: [0, 0.18, 5.5] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <HoloGlobe radius={1.4} spin={0.1} />
      </R3F>
      <Bezel />
    </>
  );
}

const page: AlmanacPage<CalConstants> = {
  meta: {
    id: "calibration",
    title: "CALIBRATION · REFERENCE SPHERE",
    system: "calibration",
    classification: "ENGINE REFERENCE · OFFLINE CONSTANTS · WGS-84",
    order: 0,
  },
  content: (
    <>
      Reference instrument — real coastlines (Natural Earth land-110m) on the engine's{" "}
      <b>HoloGlobe</b>, mounted in the bezel. Subsolar position computed live in the readouts.
    </>
  ),
  Canvas: CalCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
};

export default page;
