// SEISMIC · TECTONIC ACTIVITY — the first LIVE instrument.
// Real USGS earthquakes (past 24h) as pips on the HoloGlobe at true coordinates,
// magnitude-scaled and -colored; bezel diamonds mark the three largest events
// by longitude. Bundled snapshot = real data (beautiful offline); fetchLive
// earns the magenta ● SEISMIC LIVE. Entirely in site/ — the plugin gate holds.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { Bezel, HoloGlobe, latLonToVec3, useFeed, type BezelMark } from "@almanac/engine";
import { Canvas as R3F } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import snapshot from "./snapshot.json";

interface Quake {
  lat: number;
  lon: number;
  depth: number;
  mag: number;
  place: string;
  time: number;
}
interface QuakeData {
  asOf: number;
  quakes: Quake[];
}

const USGS = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

const feed: DataFeed<QuakeData> = {
  id: "usgs-quakes-24h",
  snapshot: snapshot as QuakeData,
  refreshMs: 120_000,
  fetchLive: async () => {
    const r = await fetch(USGS);
    if (!r.ok) throw new Error(`usgs ${r.status}`);
    const d = (await r.json()) as {
      metadata?: { generated?: number };
      features?: {
        properties?: { mag?: number | null; place?: string | null; time?: number };
        geometry?: { coordinates?: number[] };
      }[];
    };
    const quakes: Quake[] = [];
    for (const f of d.features ?? []) {
      const mag = f.properties?.mag;
      const c = f.geometry?.coordinates ?? [0, 0, 0];
      if (mag == null) continue;
      quakes.push({
        lat: c[1],
        lon: c[0],
        depth: c[2] ?? 0,
        mag,
        place: (f.properties?.place ?? "").slice(0, 48),
        time: f.properties?.time ?? 0,
      });
    }
    quakes.sort((a, b) => b.mag - a.mag);
    return { asOf: d.metadata?.generated ?? Date.now(), quakes: quakes.slice(0, 300) };
  },
};

const GLOBE_R = 1.4;

function magColor(m: number): string {
  if (m >= 5.5) return "#ff5c47"; // major — hot
  if (m >= 4) return "#ffb45e"; // significant — gold-amber
  return "#7dffc4"; // minor — mint
}

/** Quake pips — data on the planet (the only thing allowed to sit on it). */
function QuakePips({ quakes }: { quakes: Quake[] }) {
  const pips = useMemo(
    () =>
      quakes.map((q) => ({
        pos: latLonToVec3(q.lat, q.lon, GLOBE_R * 1.004),
        size: 0.012 + Math.max(0, q.mag) * 0.007,
        color: magColor(q.mag),
        big: q.mag >= 5,
      })),
    [quakes],
  );
  return (
    <group>
      {pips.map((p, i) => (
        <group key={i} position={p.pos}>
          <mesh>
            <sphereGeometry args={[p.size, 8, 8]} />
            <meshBasicMaterial color={p.color} />
          </mesh>
          {p.big && (
            <mesh>
              <sphereGeometry args={[p.size * 2.4, 8, 8]} />
              <meshBasicMaterial color={p.color} transparent opacity={0.25} blending={THREE.AdditiveBlending} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function SeisCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const quakes = state?.data.quakes ?? [];
  // bezel diamonds: the three largest events, placed by longitude on the 0–360 ring
  const marks: BezelMark[] = quakes.slice(0, 3).map((q) => ({
    deg: ((q.lon % 360) + 360) % 360,
    color: magColor(q.mag),
  }));
  return (
    <>
      <R3F
        camera={{ fov: 45, position: [0, 0.18, 5.5] }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* contract: the globe is ALWAYS cyan — gold is for telemetry/bezel only */}
        <HoloGlobe radius={GLOBE_R} spin={0.08}>
          <QuakePips quakes={quakes} />
        </HoloGlobe>
      </R3F>
      <Bezel marks={marks} />
    </>
  );
}

function LeftCol() {
  const state = useFeed(feed);
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  const qs = state?.data.quakes ?? [];
  const max = qs[0];
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">max 24h</span>
        <span className="v m">M {max ? max.mag.toFixed(1) : "—"}</span>
        <span className="u">{max ? max.place.toUpperCase().slice(0, 26) : ""}</span>
      </div>
      <div className="cell">
        <span className="k">events 24h</span>
        <span className="v">{qs.length}</span>
      </div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const qs = state?.data.quakes ?? [];
  const max = qs[0];
  const m5 = qs.filter((q) => q.mag >= 5).length;
  const m25 = qs.filter((q) => q.mag >= 2.5).length;
  return (
    <>
      <div className="cell">
        <span className="k">max depth</span>
        <span className="v">{max ? max.depth.toFixed(0) : "—"}<span className="u"> KM</span></span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">m5.0+</span><span className="v g">{m5}</span></div>
      <div className="cell"><span className="k">m2.5+</span><span className="v">{m25}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">USGS</span></div>
    </>
  );
}

const page: AlmanacPage<QuakeData> = {
  meta: {
    id: "seismic",
    title: "SEISMIC · TECTONIC ACTIVITY",
    system: "seismic",
    classification: "USGS · ALL EVENTS 24H · MAGNITUDE-SCALED",
    order: 1,
  },
  content: (
    <>
      Every pip is a real earthquake from the past 24 hours at its true coordinates —
      <b> mint</b> &lt; M4 · <b>amber</b> M4–5.5 · <b>hot</b> ≥ M5.5. Bezel diamonds mark the
      three largest by longitude. Live from <b>USGS</b>; snapshot when offline.
    </>
  ),
  Canvas: SeisCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
};

export default page;
