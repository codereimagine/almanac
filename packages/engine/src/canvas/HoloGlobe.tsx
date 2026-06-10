/**
 * HoloGlobe — the engine's holographic Earth substrate.
 *
 * Real coastlines (world-atlas land-110m) rendered as luminous linework, a dim
 * graticule, brightened equator, polar axis, coastal data-motes, and a Halo
 * scan sweep. Every globe instrument (ocean, seismic, geothermal, position,
 * orbit...) composes on this — pass children to overlay markers/arcs in the
 * same coordinate space. lat/lon helpers exported for overlays.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import { HOLO, HOLO_HI } from "../tokens";

/** lat/lon (deg) → unit-sphere position (y = north). Use for instrument overlays. */
export function latLonToVec3(latDeg: number, lonDeg: number, radius = 1): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

function coastlineGeometry(radius: number): { lines: THREE.BufferGeometry; dots: THREE.BufferGeometry } {
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);
  const seg: number[] = [];
  const dot: number[] = [];
  const push = (ring: number[][]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = latLonToVec3(ring[i][1], ring[i][0], radius);
      const b = latLonToVec3(ring[i + 1][1], ring[i + 1][0], radius);
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      if (i % 6 === 0) dot.push(a.x, a.y, a.z); // sparse coastal motes
    }
  };
  for (const f of land.features ?? [land as never]) {
    const g = (f as GeoJSON.Feature).geometry;
    if (g.type === "Polygon") for (const ring of g.coordinates) push(ring as number[][]);
    if (g.type === "MultiPolygon")
      for (const poly of g.coordinates) for (const ring of poly) push(ring as number[][]);
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  const dots = new THREE.BufferGeometry();
  dots.setAttribute("position", new THREE.Float32BufferAttribute(dot, 3));
  return { lines, dots };
}

function graticuleGeometry(radius: number, stepDeg = 15): THREE.BufferGeometry {
  const seg: number[] = [];
  const N = 72;
  for (let lat = -75; lat <= 75; lat += stepDeg) {
    for (let i = 0; i < N; i++) {
      const a = latLonToVec3(lat, (i / N) * 360, radius);
      const b = latLonToVec3(lat, ((i + 1) / N) * 360, radius);
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  for (let lon = 0; lon < 360; lon += stepDeg) {
    for (let i = 0; i < N / 2; i++) {
      const a = latLonToVec3(-90 + (i / (N / 2)) * 180, lon, radius);
      const b = latLonToVec3(-90 + ((i + 1) / (N / 2)) * 180, lon, radius);
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  return g;
}

export interface HoloGlobeProps {
  radius?: number;
  /** rad/s — serene by default */
  spin?: number;
  accent?: string;
  /** overlays rendered INSIDE the rotating group (markers placed via latLonToVec3) */
  children?: ReactNode;
  /** overlays in WORLD space (non-rotating) — sun-anchored things like the terminator */
  space?: ReactNode;
}

export function HoloGlobe({ radius = 1.4, spin = 0.1, accent = HOLO, children, space }: HoloGlobeProps) {
  const grp = useRef<THREE.Group>(null!);
  const scan = useRef<THREE.Mesh>(null!);
  const t = useRef(0);

  const { lines, dots } = useMemo(() => coastlineGeometry(radius), [radius]);
  const grat = useMemo(() => graticuleGeometry(radius * 0.998), [radius]);
  const equator = useMemo(() => graticuleEquator(radius * 1.002), [radius]);

  useFrame((_, dt) => {
    t.current += dt;
    grp.current.rotation.y += dt * spin;
    // Halo scan sweep: a latitude band gliding pole-to-pole
    const phase = (Math.sin(t.current * 0.35) * 0.5 + 0.5) * Math.PI - Math.PI / 2;
    const y = Math.sin(phase) * radius;
    const r = Math.max(0.02, Math.cos(phase) * radius);
    scan.current.position.y = y;
    scan.current.scale.set(r, r, r);
    (scan.current.material as THREE.MeshBasicMaterial).opacity =
      0.25 + 0.15 * Math.sin(t.current * 2.2);
  });

  return (
    <group>
      <group ref={grp}>
        {/* continents — the hologram's subject */}
        <lineSegments geometry={lines}>
          <lineBasicMaterial color={HOLO_HI} transparent opacity={0.85} />
        </lineSegments>
        <points geometry={dots}>
          <pointsMaterial color={accent} size={0.016} transparent opacity={0.75} sizeAttenuation />
        </points>
        {/* graticule — dim reference lattice */}
        <lineSegments geometry={grat}>
          <lineBasicMaterial color={HOLO} transparent opacity={0.1} />
        </lineSegments>
        <lineSegments geometry={equator}>
          <lineBasicMaterial color={accent} transparent opacity={0.4} />
        </lineSegments>
        {/* polar axis */}
        <mesh>
          <cylinderGeometry args={[0.0035, 0.0035, radius * 2.55, 6]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.5} />
        </mesh>
        {/* inner volume glow */}
        <mesh>
          <sphereGeometry args={[radius * 0.985, 32, 24]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.045} blending={THREE.AdditiveBlending} />
        </mesh>
        {children}
      </group>
      {/* atmosphere rim — additive backside shell reads as a glow halo at the limb */}
      <mesh>
        <sphereGeometry args={[radius * 1.06, 48, 32]} />
        <meshBasicMaterial
          color={HOLO}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* scan ring lives outside the spin group — it sweeps the world */}
      <mesh ref={scan} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.0045, 6, 90]} />
        <meshBasicMaterial color={HOLO_HI} transparent opacity={0.3} />
      </mesh>
      {space}
    </group>
  );
}

function graticuleEquator(radius: number): THREE.BufferGeometry {
  const seg: number[] = [];
  const N = 128;
  for (let i = 0; i < N; i++) {
    const a = latLonToVec3(0, (i / N) * 360, radius);
    const b = latLonToVec3(0, ((i + 1) / N) * 360, radius);
    seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  return g;
}
