// SEISMIC · TECTONIC ACTIVITY — the first LIVE instrument, on the CONTRACT
// renderer (HoloCanvas = 1:1 port of almanac-fused.html). Real USGS quakes
// (24h) as pulsing pips at true coordinates, sized/colored by magnitude —
// exactly the mockup's pips, but real. Bezel diamonds mark the 3 largest.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import { useEffect, useState } from "react";
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

function magColor(m: number): string {
  // the contract pip palette: mint minor · amber significant (mockup colors)
  if (m >= 4) return "rgba(255,180,94,.95)";
  return "rgba(127,230,200,.92)";
}

function SeisCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const quakes = state?.data.quakes ?? [];
  const pips: HoloPip[] = quakes.map((q) => ({
    lat: q.lat,
    lon: q.lon,
    size: Math.max(0, q.mag),
    color: magColor(q.mag),
  }));
  const marks: HoloMark[] = quakes.slice(0, 3).map((q) => ({
    deg: ((q.lon % 360) + 360) % 360,
    color: q.mag >= 5 ? "#ffb45e" : "#F0CE96",
  }));
  return <HoloCanvas pips={pips} marks={marks} />;
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
      <div className="cell"><span className="k">events 24h</span><span className="v">{qs.length}</span></div>
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

/** Globe-index preview — the entry contract's 3 seismic cells. */
function Preview() {
  const state = useFeed(feed);
  const qs = state?.data.quakes ?? [];
  const max = qs[0];
  const m5 = qs.filter((q) => q.mag >= 5).length;
  return (
    <>
      <div className="cell">
        <span className="k">max 24h</span>
        <span className="v m">M {max ? max.mag.toFixed(1) : "—"}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">events</span><span className="v">{qs.length}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">m5.0+</span><span className="v g">{m5}</span></div>
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
  Canvas: SeisCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what SEISMIC reads at a searched place
  probe: (lat, lon, d) => {
    let best: Quake | null = null;
    let bd = Infinity;
    for (const q of d.quakes) {
      const k = haversineKm(lat, lon, q.lat, q.lon);
      if (k < bd) {
        bd = k;
        best = q;
      }
    }
    const within = d.quakes.filter((q) => haversineKm(lat, lon, q.lat, q.lon) <= 1000).length;
    return [
      {
        k: "nearest quake 24h",
        v: best ? `M ${best.mag.toFixed(1)}` : "—",
        cls: "m",
        u: best ? `${bd.toFixed(0)} KM AWAY` : "",
      },
      { k: "within 1000 km", v: String(within), cls: "g" },
    ];
  },
};

export default page;
