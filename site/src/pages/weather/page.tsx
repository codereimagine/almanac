// WEATHER · SURFACE SYNOPTIC — open-meteo on the CONTRACT renderer.
// A 127-city global grid (static facts, bundled) carrying live 2m temperatures:
// mint pips for the field, heat alert-coded ≥32°C amber / ≥40°C magenta.
// Readouts: hottest/coldest city, max surface wind. Bezel diamonds mark the
// three hottest longitudes.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import { useEffect, useState } from "react";
import citiesTable from "./cities.json";
import snapshot from "./snapshot.json";

interface CityWx {
  name: string;
  lat: number;
  lon: number;
  temp: number;
  wind: number;
}
interface WxData {
  asOf: number;
  cities: CityWx[];
}

const CITIES = citiesTable as unknown as [string, number, number][];
const OM = "https://api.open-meteo.com/v1/forecast";

const MINT = "rgba(127,230,200,.92)";
const AMBER = "rgba(255,180,94,.95)";
const MAGENTA = "rgba(255,43,214,.95)";

const feed: DataFeed<WxData> = {
  id: "open-meteo-synoptic",
  snapshot: snapshot as WxData,
  refreshMs: 600_000,
  fetchLive: async () => {
    const lats = CITIES.map((c) => c[1]).join(",");
    const lons = CITIES.map((c) => c[2]).join(",");
    const r = await fetch(`${OM}?latitude=${lats}&longitude=${lons}&current=temperature_2m,wind_speed_10m`);
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const d = (await r.json()) as { current?: { temperature_2m?: number; wind_speed_10m?: number } }[];
    const cities: CityWx[] = [];
    (Array.isArray(d) ? d : [d]).forEach((e, i) => {
      const t = e.current?.temperature_2m;
      if (t == null || !CITIES[i]) return;
      cities.push({ name: CITIES[i][0], lat: CITIES[i][1], lon: CITIES[i][2], temp: t, wind: e.current?.wind_speed_10m ?? 0 });
    });
    if (cities.length === 0) throw new Error("open-meteo empty");
    return { asOf: Date.now(), cities };
  },
};

const byTemp = (d: WxData): CityWx[] => [...d.cities].sort((a, b) => b.temp - a.temp);
const deg = (t: number): string => `${t.toFixed(1)}°C`;

function WxCanvas(_props: CanvasProps) {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as WxData);
  const pips: HoloPip[] = d.cities.map((c) => ({
    lat: c.lat,
    lon: c.lon,
    size: c.temp >= 40 ? 5 : c.temp >= 32 ? 4 : 1.6,
    color: c.temp >= 40 ? MAGENTA : c.temp >= 32 ? AMBER : MINT,
  }));
  const marks: HoloMark[] = byTemp(d).slice(0, 3).map((c) => ({
    deg: ((c.lon % 360) + 360) % 360,
    color: c.temp >= 40 ? "#ff2bd6" : "#F0CE96",
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
  const d = state?.data ?? (snapshot as WxData);
  const sorted = byTemp(d);
  const hot = sorted[0];
  const cold = sorted[sorted.length - 1];
  return (
    <>
      <div className="cell"><span className="k">utc</span><span className="v">{utc}</span></div>
      <div className="rule" />
      <div className="cell">
        <span className="k">hottest</span>
        <span className="v m">{hot ? deg(hot.temp) : "—"}</span>
        <span className="u">{hot ? hot.name : ""}</span>
      </div>
      <div className="cell">
        <span className="k">coldest</span>
        <span className="v">{cold ? deg(cold.temp) : "—"}</span>
        <span className="u">{cold ? cold.name : ""}</span>
      </div>
    </>
  );
}

function RightCol() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as WxData);
  const windy = [...d.cities].sort((a, b) => b.wind - a.wind)[0];
  const mean = d.cities.length ? d.cities.reduce((s, c) => s + c.temp, 0) / d.cities.length : 0;
  return (
    <>
      <div className="cell">
        <span className="k">max wind</span>
        <span className="v g">{windy ? windy.wind.toFixed(0) : "—"}<span className="u"> KM/H</span></span>
        <span className="u">{windy ? windy.name : ""}</span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">grid mean</span><span className="v">{deg(mean)}</span></div>
      <div className="cell"><span className="k">cities</span><span className="v">{d.cities.length}</span></div>
      <div className="rule" />
      <div className="cell"><span className="k">source</span><span className="v">OPEN-METEO</span></div>
    </>
  );
}

/** Globe-index preview — the entry contract's 3 weather cells. */
function Preview() {
  const state = useFeed(feed);
  const d = state?.data ?? (snapshot as WxData);
  const sorted = byTemp(d);
  const hot = sorted[0];
  const windy = [...d.cities].sort((a, b) => b.wind - a.wind)[0];
  return (
    <>
      <div className="cell">
        <span className="k">hottest</span>
        <span className="v m">{hot ? deg(hot.temp) : "—"}</span>
      </div>
      <div className="rule" />
      <div className="cell">
        <span className="k">max wind</span>
        <span className="v g">{windy ? windy.wind.toFixed(0) : "—"}<span className="u"> KM/H</span></span>
      </div>
      <div className="rule" />
      <div className="cell"><span className="k">cities</span><span className="v">{d.cities.length}</span></div>
    </>
  );
}

const page: AlmanacPage<WxData> = {
  meta: {
    id: "weather",
    title: "WEATHER · SURFACE SYNOPTIC",
    system: "weather",
    classification: "OPEN-METEO · GLOBAL SYNOPTIC GRID · 2M TEMPERATURE",
    order: 4,
  },
  Canvas: WxCanvas,
  feed,
  readouts: { left: LeftCol, right: RightCol },
  preview: Preview,
};

export default page;
