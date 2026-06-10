// CALIBRATION — the engine's reference instrument (and P1's proof page).
// v3: ornament must BE function (Bert's bar). The decorative ring is gone;
// in its place the real day/night TERMINATOR computed from the sun's position
// right now, with a gold subsolar marker — true astronomy as the art.
// Still entirely in site/ — the zero-engine-edit plugin gate holds.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { HoloGlobe, latLonToVec3, SAT, SAT_HI } from "@almanac/engine";
import { Canvas as R3F } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

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

/** Subsolar point right now (approx: ±0.5° — instrument-grade for a hologram). */
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

/** Day/night terminator + subsolar marker — gold, the Ghosts accent doing real work. */
function Terminator({ radius }: { radius: number }) {
  const sun = useMemo(() => subsolarNow(), []);
  const sunDir = useMemo(() => latLonToVec3(sun.lat, sun.lon, 1), [sun]);
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sunDir.clone().normalize()),
    [sunDir],
  );
  return (
    <group>
      {/* the terminator: great circle 90° from the subsolar point */}
      <mesh quaternion={quat}>
        <torusGeometry args={[radius * 1.005, 0.0032, 6, 160]} />
        <meshBasicMaterial color={SAT} transparent opacity={0.55} />
      </mesh>
      {/* night hemisphere: a whisper of shade behind the terminator plane */}
      <mesh quaternion={quat} position={sunDir.clone().multiplyScalar(-radius * 0.02)}>
        <sphereGeometry args={[radius * 0.995, 32, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      {/* subsolar marker — gold pulse where the sun is overhead right now */}
      <mesh position={sunDir.clone().multiplyScalar(radius * 1.02)}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshBasicMaterial color={SAT_HI} />
      </mesh>
      <mesh position={sunDir.clone().multiplyScalar(radius * 1.02)}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={SAT} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function AxisStrip() {
  const [utc, setUtc] = useState("--:--:--");
  const [sun, setSun] = useState(subsolarNow());
  useEffect(() => {
    const t = setInterval(() => {
      setUtc(new Date().toISOString().slice(11, 19));
      setSun(subsolarNow());
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const c = feed.snapshot;
  const fmt = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`;
  return (
    <div className="axis-strip">
      <span className="ax">UTC<b>{utc}</b></span>
      <span className="ax sat">SUBSOLAR<b>{fmt(sun.lat, "N", "S")} {fmt(sun.lon, "E", "W")}</b></span>
      <div className="ruler" />
      <span className="ax">RADIUS·EQ<b>{c.earthRadiusKm.toLocaleString()}</b></span>
      <span className="ax">OBLIQUITY<b>{c.obliquityDeg}°</b></span>
      <span className="ax">SIDEREAL<b>{c.siderealDayH}h</b></span>
      <div className="spacer" />
      <div className="ruler" />
      <span className="ax sat">SOURCE<b>LAND-110M</b></span>
      <span className="ax sat">DATUM<b>{c.datum}</b></span>
    </div>
  );
}

function CalCanvas(_props: CanvasProps) {
  return (
    <>
      <R3F
        camera={{ fov: 45, position: [0, 0.5, 4.4] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <HoloGlobe radius={1.4} spin={0.1} space={<Terminator radius={1.4} />} />
      </R3F>
      <AxisStrip />
    </>
  );
}

function Content() {
  const c = feed.snapshot;
  return (
    <>
      Reference instrument. Real coastlines (Natural Earth land-110m) on the engine's{" "}
      <b>HoloGlobe</b> substrate; the gold ring is the <b>day/night terminator</b> computed from the
      sun's position <span className="num">right now</span>, with the subsolar point marked. Constants:
      radius <span className="num">{c.earthRadiusKm.toLocaleString()} km</span> · obliquity{" "}
      <span className="num">{c.obliquityDeg}°</span> · sidereal day{" "}
      <span className="num">{c.siderealDayH} h</span> · datum <b>{c.datum}</b>.
    </>
  );
}

const page: AlmanacPage<CalConstants> = {
  meta: {
    id: "calibration",
    title: "CALIBRATION · REFERENCE SPHERE",
    system: "calibration",
    classification: "ENGINE REFERENCE · LIVE TERMINATOR · WGS-84",
    order: 0,
  },
  content: Content,
  Canvas: CalCanvas,
  feed,
};

export default page;
