// CALIBRATION — the engine's reference instrument (and P1's proof page).
// v2: the canvas is the engine's HoloGlobe (real coastlines, graticule, scan
// sweep) with the obliquity ring composed on top, plus the right axis strip.
// Still entirely in site/ — the zero-engine-edit plugin gate holds.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { HOLO, HoloGlobe } from "@almanac/engine";
import { Canvas as R3F, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
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

/** Obliquity reference ring at the true 23.44° tilt — engineering as ornament. */
function ObliquityRing() {
  const ring = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    ring.current.rotation.z += dt * 0.05;
  });
  const tilt = Math.PI / 2 + (23.44 * Math.PI) / 180;
  return (
    <mesh ref={ring} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[1.95, 0.0035, 8, 140]} />
      <meshBasicMaterial color={HOLO} transparent opacity={0.5} />
    </mesh>
  );
}

function AxisStrip() {
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const c = feed.snapshot;
  return (
    <div className="axis-strip">
      <span className="ax">UTC<b>{utc}</b></span>
      <span className="ax">DATUM<b>{c.datum}</b></span>
      <div className="ruler" />
      <span className="ax">RADIUS·EQ<b>{c.earthRadiusKm.toLocaleString()} km</b></span>
      <span className="ax">OBLIQUITY<b>{c.obliquityDeg}°</b></span>
      <span className="ax">SIDEREAL<b>{c.siderealDayH} h</b></span>
      <div className="spacer" />
      <div className="ruler" />
      <span className="ax sat">SOURCE<b>LAND-110M</b></span>
      <span className="ax sat">MODE<b>REFERENCE</b></span>
    </div>
  );
}

function CalCanvas(_props: CanvasProps) {
  return (
    <>
      <R3F
        camera={{ fov: 45, position: [0, 0.5, 4.6] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <HoloGlobe radius={1.4} spin={0.1}>
          <ObliquityRing />
        </HoloGlobe>
      </R3F>
      <AxisStrip />
    </>
  );
}

function Content() {
  const c = feed.snapshot;
  return (
    <>
      Reference instrument. Confirms the engine's chrome, canvas and feed seams against known
      constants: equatorial radius <span className="num">{c.earthRadiusKm.toLocaleString()} km</span>,
      axial obliquity <span className="num">{c.obliquityDeg}°</span>, sidereal day{" "}
      <span className="num">{c.siderealDayH} h</span>, datum <b>{c.datum}</b>. Coastlines are real
      (Natural Earth land-110m) — the same <b>HoloGlobe</b> substrate every globe instrument composes on.
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
  content: Content,
  Canvas: CalCanvas,
  feed,
};

export default page;
