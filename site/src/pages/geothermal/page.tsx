// GEOTHERMAL · VOLCANIC ACTIVITY — USGS HANS advisories on the CONTRACT
// renderer. The full GVP Holocene vent field (1215 volcanoes — the Ring of
// Fire) as mint pips; US-monitored volcanoes alert-coded live: ADVISORY in
// amber, WATCH/WARNING in magenta. Bezel diamonds mark the elevated vents.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, kmMi, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import { useEffect, useState } from "react";
import coordsTable from "./gvp-coords.json";
import snapshot from "./snapshot.json";

interface Monitored {
  vnum: number;
  name: string;
  alert: string;
  color: string;
  lat: number;
  lon: number;
}
interface GeoData {
  asOf: number;
  monitored: Monitored[];
}

const HANS = "https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes";
const COORDS = coordsTable as unknown as Record<string, [number, number]>;

const MINT = "rgba(127,230,200,.92)";
const AMBER = "rgba(255,180,94,.95)";
const MAGENTA = "rgba(255,43,214,.95)";

const SEVERITY: Record<string, number> = { WARNING: 3, WATCH: 2, ADVISORY: 1 };
const sev = (a: string): number => SEVERITY[a] ?? 0;
const elevated = (d: GeoData): Monitored[] =>
  d.monitored.filter((v) => sev(v.alert) > 0).sort((a, b) => sev(b.alert) - sev(a.alert));

const feed: DataFeed<GeoData> = {
  id: "usgs-hans-volcanoes",
  snapshot: snapshot as GeoData,
  refreshMs: 300_000,
  fetchLive: async () => {
    const r = await fetch(HANS);
    if (!r.ok) throw new Error(`hans ${r.status}`);
    const raw = (await r.json()) as {
      vnum?: string;
      volcano_name?: string;
      alert_level?: string;
      color_code?: string;
    }[];
    const monitored: Monitored[] = [];
    for (const v of raw) {
      const c = COORDS[String(+(v.vnum ?? 0))];
      if (!c || !v.volcano_name) continue;
      monitored.push({
        vnum: +v.vnum!,
        name: v.volcano_name,
        alert: v.alert_level ?? "UNASSIGNED",
        color: v.color_code ?? "",
        lat: c[0],
        lon: c[1],
      });
    }
    if (monitored.length === 0) throw new Error("hans empty");
    return { asOf: Date.now(), monitored };
  },
};

function GeoCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as GeoData);
  const pips: HoloPip[] = Object.values(COORDS).map(([lat, lon]) => ({
    lat,
    lon,
    size: 1.4,
    color: MINT,
  }));
  for (const v of elevated(d)) {
    pips.push({
      lat: v.lat,
      lon: v.lon,
      size: sev(v.alert) >= 2 ? 5 : 4,
      color: sev(v.alert) >= 2 ? MAGENTA : AMBER,
    });
  }
  const marks: HoloMark[] = elevated(d).slice(0, 3).map((v) => ({
    deg: ((v.lon % 360) + 360) % 360,
    color: sev(v.alert) >= 2 ? "#ff2bd6" : "#F0CE96",
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
  const d = state?.data ?? (snapshot as GeoData);
  const top = elevated(d)[0];
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">highest alert</span>
        <span className="v m">{top ? top.alert : "—"}</span>
        <span className="u">{top ? top.name.toUpperCase().slice(0, 26) : ""}</span>
      </div>
      <div className="cell"><span className="k">elevated</span><span className="v">{elevated(d).length}</span></div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as GeoData);
  const watch = d.monitored.filter((v) => sev(v.alert) >= 2).length;
  const adv = d.monitored.filter((v) => v.alert === "ADVISORY").length;
  return (
    <>
      <div className="cell"><span className="k">watch+</span><span className="v g">{watch}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">advisory</span><span className="v">{adv}</span></div>
      <div className="cell"><span className="k">holocene vents</span><span className="v">{Object.keys(COORDS).length}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">USGS · GVP</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 geothermal cells. */
function Preview() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as GeoData);
  const top = elevated(d)[0];
  return (
    <>
      <div className="cell">
        <span className="k">highest alert</span>
        <span className="v m">{top ? top.alert : "—"}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">elevated</span><span className="v g">{elevated(d).length}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">holocene vents</span><span className="v">{Object.keys(COORDS).length}</span>
      </div>
    </>
  );
}

const page: AlmanacPage<GeoData> = {
  meta: {
    id: "geothermal",
    title: "GEOTHERMAL · VOLCANIC ACTIVITY",
    system: "geothermal",
    classification: "USGS HANS · GVP HOLOCENE VENTS · ALERT-CODED",
    order: 3,
  },
  Canvas: GeoCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what GEOTHERMAL reads at a searched place
  probe: (p, d) => {
    let bm: Monitored | null = null;
    let bmd = Infinity;
    for (const v of d.monitored) {
      const k = haversineKm(p.lat, p.lon, v.lat, v.lon);
      if (k < bmd) {
        bmd = k;
        bm = v;
      }
    }
    let bvd = Infinity;
    for (const c of Object.values(COORDS)) bvd = Math.min(bvd, haversineKm(p.lat, p.lon, c[0], c[1]));
    return [
      {
        k: "nearest monitored",
        v: bm ? bm.alert : "—",
        cls: bm && sev(bm.alert) >= 2 ? "m" : "g",
        u: bm ? `${bm.name.toUpperCase().slice(0, 14)} · ${kmMi(bmd)}` : "",
      },
      { k: "nearest vent", v: Number.isFinite(bvd) ? kmMi(bvd) : "—", u: "" },
    ];
  },
};

export default page;
