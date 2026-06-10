// CALIBRATION — the engine's reference instrument (and P1's proof page).
// Lives entirely in the site: if this renders, the plugin contract works with
// zero engine edits. Doubles as the design-language showcase: the holographic
// reference sphere is the 80 (Halo), the frame ticks around it are the 20 (Ghosts).

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { HOLO, HOLO_HI } from "@almanac/engine";
import { Canvas as R3F, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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

/** Holographic reference sphere — luminous lat/long wireframe, slow serene spin. */
function ReferenceSphere() {
  const grp = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    grp.current.rotation.y += dt * 0.12; // serene — no VIAC energy
    ring.current.rotation.z += dt * 0.04;
  });
  // axial reference ring tilted to the obliquity — engineering as ornament
  const tilt = useMemo(() => (23.44 * Math.PI) / 180, []);
  return (
    <group>
      <group ref={grp}>
        <mesh>
          <sphereGeometry args={[1.35, 28, 18]} />
          <meshBasicMaterial color={HOLO} wireframe transparent opacity={0.3} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.05, 14, 9]} />
          <meshBasicMaterial color={HOLO_HI} wireframe transparent opacity={0.1} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[Math.PI / 2 + tilt, 0, 0]}>
        <torusGeometry args={[1.85, 0.004, 8, 120]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function CalCanvas(_props: CanvasProps) {
  return (
    <R3F
      camera={{ fov: 45, position: [0, 0.4, 4.4] }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ReferenceSphere />
    </R3F>
  );
}

function Content() {
  const c = feed.snapshot;
  return (
    <>
      Reference instrument. Confirms the engine's chrome, canvas and feed seams against known
      constants: equatorial radius <span className="num">{c.earthRadiusKm.toLocaleString()} km</span>,
      axial obliquity <span className="num">{c.obliquityDeg}°</span>, sidereal day{" "}
      <span className="num">{c.siderealDayH} h</span>, datum <b>{c.datum}</b>. If this page renders,
      the page contract holds — every instrument after this one is a plugin.
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
