// OCEAN · TIDAL WATER LEVEL — NOAA CO-OPS on the CONTRACT renderer.
// The real water-level network (301 stations) as mint pips at true coordinates;
// six flagship harbors in amber carrying live levels. Readouts: The Battery
// observed level + tide direction, next high/low water. Bezel diamonds mark
// three flagship longitudes.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, kmMi, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import { useEffect, useState } from "react";
import snapshot from "./snapshot.json";

interface Station {
  lat: number;
  lon: number;
}
interface Flagship {
  id: string;
  name: string;
  lat: number;
  lon: number;
  level: number;
}
interface TideEvent {
  t: number;
  v: number;
}
interface OceanData {
  asOf: number;
  stations: Station[];
  flagships: Flagship[];
  nextHigh: TideEvent | null;
  nextLow: TideEvent | null;
}

const MD = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels";
const DG = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const FLAGSHIPS = ["8518750", "9414290", "1612340", "9447130", "8723214", "8443970"];
const PRIMARY = "8518750"; // The Battery, NY — the tide readout station

const MINT = "rgba(127,230,200,.92)";
const AMBER = "rgba(255,180,94,.95)";

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`coops ${r.status}`);
  return (await r.json()) as T;
}
const parseGmt = (t: string): number => Date.parse(t.replace(" ", "T") + ":00Z");

const feed: DataFeed<OceanData> = {
  id: "coops-water-level",
  snapshot: snapshot as OceanData,
  refreshMs: 300_000,
  fetchLive: async () => {
    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const [md, preds, ...wl] = await Promise.all([
      getJson<{ stations?: { lat?: number; lng?: number }[] }>(MD),
      getJson<{ predictions?: { t: string; v: string; type: string }[] }>(
        `${DG}?begin_date=${day}&range=48&station=${PRIMARY}&product=predictions&datum=MLLW&interval=hilo&time_zone=gmt&units=metric&format=json`,
      ),
      ...FLAGSHIPS.map((id) =>
        getJson<{
          metadata?: { id: string; name: string; lat: string; lon: string };
          data?: { v: string }[];
        }>(`${DG}?date=latest&station=${id}&product=water_level&datum=MLLW&time_zone=gmt&units=metric&format=json`),
      ),
    ]);

    const stations: Station[] = (md.stations ?? [])
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ lat: s.lat!, lon: s.lng! }));

    const flagships: Flagship[] = [];
    wl.forEach((d, i) => {
      const m = d.metadata;
      const v = d.data?.[0]?.v;
      if (m && v != null) {
        flagships.push({ id: FLAGSHIPS[i], name: m.name, lat: +m.lat, lon: +m.lon, level: +v });
      }
    });

    const now = Date.now();
    const future = (preds.predictions ?? []).filter((p) => parseGmt(p.t) > now);
    const high = future.find((p) => p.type === "H");
    const low = future.find((p) => p.type === "L");
    return {
      asOf: now,
      stations,
      flagships,
      nextHigh: high ? { t: parseGmt(high.t), v: +high.v } : null,
      nextLow: low ? { t: parseGmt(low.t), v: +low.v } : null,
    };
  },
};

function tideTrend(d: OceanData): string {
  if (!d.nextHigh || !d.nextLow) return "—";
  return d.nextHigh.t < d.nextLow.t ? "RISING" : "FALLING";
}
const hhmm = (t: number): string => new Date(t).toISOString().slice(11, 16) + " UTC";

function OceanCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as OceanData);
  const pips: HoloPip[] = [
    ...d.stations.map((s) => ({ lat: s.lat, lon: s.lon, size: 1.6, color: MINT })),
    ...d.flagships.map((f) => ({ lat: f.lat, lon: f.lon, size: 4.2, color: AMBER })),
  ];
  const marks: HoloMark[] = d.flagships.slice(0, 3).map((f) => ({
    deg: ((f.lon % 360) + 360) % 360,
    color: "#F0CE96",
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
  const d = state?.data ?? (snapshot as OceanData);
  const battery = d.flagships.find((f) => f.id === PRIMARY);
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">the battery · ny</span>
        <span className="v m">{battery ? battery.level.toFixed(2) : "—"}<span className="u"> M MLLW</span></span>
        <span className="u">TIDE {tideTrend(d)}</span>
      </div>
      <div className="cell"><span className="k">stations</span><span className="v">{d.stations.length}</span></div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as OceanData);
  return (
    <>
      <div className="cell">
        <span className="k">next high</span>
        <span className="v g">{d.nextHigh ? d.nextHigh.v.toFixed(2) : "—"}<span className="u"> M</span></span>
        <span className="u">{d.nextHigh ? hhmm(d.nextHigh.t) : ""}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">next low</span>
        <span className="v">{d.nextLow ? d.nextLow.v.toFixed(2) : "—"}<span className="u"> M</span></span>
        <span className="u">{d.nextLow ? hhmm(d.nextLow.t) : ""}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">NOAA</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 ocean cells. */
function Preview() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as OceanData);
  const battery = d.flagships.find((f) => f.id === PRIMARY);
  return (
    <>
      <div className="cell">
        <span className="k">battery ny</span>
        <span className="v g">{battery ? battery.level.toFixed(2) : "—"}<span className="u"> M MLLW</span></span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">next high</span>
        <span className="v">{d.nextHigh ? d.nextHigh.v.toFixed(2) : "—"}
          <span className="u"> M{d.nextHigh ? ` · ${hhmm(d.nextHigh.t).slice(0, 5)}` : ""}</span>
        </span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">stations</span><span className="v">{d.stations.length}</span></div>
    </>
  );
}

const page: AlmanacPage<OceanData> = {
  meta: {
    id: "ocean",
    title: "OCEAN · TIDAL WATER LEVEL",
    system: "ocean",
    classification: "NOAA CO-OPS · WATER LEVEL NETWORK · DATUM MLLW",
    order: 2,
  },
  Canvas: OceanCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
  // what OCEAN reads at a searched place
  probe: (p, d) => {
    let bf: Flagship | null = null;
    let bfd = Infinity;
    for (const f of d.flagships) {
      const k = haversineKm(p.lat, p.lon, f.lat, f.lon);
      if (k < bfd) {
        bfd = k;
        bf = f;
      }
    }
    let bsd = Infinity;
    for (const s of d.stations) bsd = Math.min(bsd, haversineKm(p.lat, p.lon, s.lat, s.lon));
    return [
      {
        k: "nearest flagship",
        v: bf ? bf.level.toFixed(2) : "—",
        cls: "g",
        u: bf ? `M MLLW · ${bf.name.toUpperCase().slice(0, 14)} · ${kmMi(bfd)}` : "",
      },
      { k: "nearest station", v: Number.isFinite(bsd) ? kmMi(bsd) : "—", u: "" },
    ];
  },
};

export default page;
