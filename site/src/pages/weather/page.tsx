// WEATHER · SURFACE SYNOPTIC — open-meteo on the CONTRACT renderer.
// A 127-city global grid (static facts, bundled) carrying live 2m temperatures:
// mint pips for the field, heat alert-coded ≥32°C amber / ≥40°C magenta.
// Readouts: hottest/coldest city, max surface wind. Bezel diamonds mark the
// three hottest longitudes.

import type { AlmanacPage, CanvasProps, DataFeed } from "@almanac/engine";
import { haversineKm, HoloCanvas, useFeed, type HoloMark, type HoloPip } from "@almanac/engine";
import { useEffect, useState } from "react";
import citiesTable from "./cities.json";
import snapshot from "./snapshot.json";

interface CityWx {
  name: string;
  lat: number;
  lon: number;
  temp: number;
  wind: number;
  /** wind FROM bearing, deg */
  dir: number;
  /** WMO weather code */
  code: number;
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
    const r = await fetch(
      `${OM}?latitude=${lats}&longitude=${lons}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code`,
    );
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const d = (await r.json()) as {
      current?: { temperature_2m?: number; wind_speed_10m?: number; wind_direction_10m?: number; weather_code?: number };
    }[];
    const cities: CityWx[] = [];
    (Array.isArray(d) ? d : [d]).forEach((e, i) => {
      const t = e.current?.temperature_2m;
      if (t == null || !CITIES[i]) return;
      cities.push({
        name: CITIES[i][0],
        lat: CITIES[i][1],
        lon: CITIES[i][2],
        temp: t,
        wind: e.current?.wind_speed_10m ?? 0,
        dir: e.current?.wind_direction_10m ?? 0,
        code: e.current?.weather_code ?? 0,
      });
    });
    if (cities.length === 0) throw new Error("open-meteo empty");
    return { asOf: Date.now(), cities };
  },
};

const byTemp = (d: WxData): CityWx[] => [...d.cities].sort((a, b) => b.temp - a.temp);
// temps are stored in °C — a research almanac shows BOTH scales at once.
const cMain = (t: number): string => `${t.toFixed(1)}°C`;
const fAlt = (t: number): string => `${(t * 1.8 + 32).toFixed(1)}°F`;
// both scales, co-equal — °C · °F (slightly smaller font via the .dual class to fit the column)
const dual = (t: number): string => `${cMain(t)} · ${fAlt(t)}`;

/** WMO weather code → HUD condition word (bewthr's code buckets). */
const WMO: Record<number, string> = {
  0: "CLEAR", 1: "MOSTLY CLEAR", 2: "PARTLY CLOUDY", 3: "OVERCAST",
  45: "FOG", 48: "RIME FOG",
  51: "DRIZZLE", 53: "DRIZZLE", 55: "DRIZZLE", 56: "FRZ DRIZZLE", 57: "FRZ DRIZZLE",
  61: "LIGHT RAIN", 63: "RAIN", 65: "HEAVY RAIN", 66: "FRZ RAIN", 67: "FRZ RAIN",
  71: "LIGHT SNOW", 73: "SNOW", 75: "HEAVY SNOW", 77: "SNOW GRAINS",
  80: "SHOWERS", 81: "SHOWERS", 82: "VIOLENT SHOWERS", 85: "SNOW SHOWERS", 86: "SNOW SHOWERS",
  95: "THUNDERSTORM", 96: "THUNDERSTORM", 99: "THUNDERSTORM",
};
const wmoWord = (c: number): string => WMO[c] ?? `WMO ${c}`;

const D = Math.PI / 180;
const STORM = new Set([95, 96, 99]);

/** Destination point dKm along bearing brg — the wind streak's path. */
function dest(lat: number, lon: number, brg: number, dKm: number): [number, number] {
  const dl = dKm / 6371;
  const th = brg * D;
  const ph = lat * D;
  const sin2 = Math.sin(ph) * Math.cos(dl) + Math.cos(ph) * Math.sin(dl) * Math.cos(th);
  const lat2 = Math.asin(sin2) / D;
  const lon2 = lon + Math.atan2(Math.sin(th) * Math.sin(dl) * Math.cos(ph), Math.cos(dl) - Math.sin(ph) * sin2) / D;
  return [lat2, ((lon2 + 540) % 360) - 180];
}

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
  // the planet breathes — wind streaks drifting downwind from every city,
  // speed-scaled, storm cells in magenta (bewthr's condition-driven motion, on a globe)
  const overlay = (X: CanvasRenderingContext2D, proj: (lon: number, lat: number) => [number, number, number] | null, t: number) => {
    d.cities.forEach((c, i) => {
      if (c.wind < 4) return;
      const flow = (c.dir + 180) % 360; // FROM bearing -> downwind
      const len = Math.min(700, Math.max(140, c.wind * 12));
      const phase = (t / 1500 + i * 0.37) % 1;
      const storm = STORM.has(c.code);
      X.strokeStyle = storm ? "rgba(255,43,214,.65)" : "rgba(127,217,255,.5)";
      X.lineWidth = 1.7;
      X.shadowColor = storm ? "#ff2bd6" : "#7fd9ff";
      X.shadowBlur = 7;
      X.beginPath();
      let on = false;
      for (let s = 0; s <= 4; s++) {
        const k = phase * 0.75 + (s / 4) * 0.25; // a quarter-length segment riding the path
        const [la, lo] = dest(c.lat, c.lon, flow, len * k);
        const q = proj(lo, la);
        if (q) {
          on ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]);
          on = true;
        } else on = false;
      }
      X.stroke();
    });
    X.shadowBlur = 0;
  };
  return <HoloCanvas pips={pips} marks={marks} overlay={overlay} />;
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
        <span className="v m dual">{hot ? dual(hot.temp) : "—"}</span>
        <span className="u">{hot ? hot.name : ""}</span>
      </div>
      <div className="cell">
        <span className="k">coldest</span>
        <span className="v dual">{cold ? dual(cold.temp) : "—"}</span>
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
      <div className="cell">
        <span className="k">grid mean</span>
        <span className="v dual">{dual(mean)}</span>
      </div>
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
        <span className="v m dual">{hot ? dual(hot.temp) : "—"}</span>
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
  // what WEATHER reads at a place — a REAL point forecast for the exact
  // coordinates (bewthr's fetch); if that fails, the nearest grid reading,
  // honestly labelled. The dossier never goes dark.
  probe: async (p, d) => {
    try {
      const r = await fetch(
        `${OM}?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`,
      );
      if (!r.ok) throw new Error(`open-meteo ${r.status}`);
      const e = (await r.json()) as {
        current?: {
          temperature_2m?: number;
          apparent_temperature?: number;
          relative_humidity_2m?: number;
          precipitation?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        };
      };
      const c = e.current;
      if (c?.temperature_2m == null) throw new Error("no point data");
      const precip = c.precipitation ?? 0;
      const feels = c.apparent_temperature ?? c.temperature_2m;
      return [
        { k: "now", v: dual(c.temperature_2m), cls: c.temperature_2m >= 32 ? "m" : "g", u: wmoWord(c.weather_code ?? 0) },
        { k: "feels", v: dual(feels), u: `RH ${(c.relative_humidity_2m ?? 0).toFixed(0)}%` },
        {
          k: "wind",
          v: (c.wind_speed_10m ?? 0).toFixed(0),
          u: `KM/H${precip > 0 ? ` · PRECIP ${precip.toFixed(1)} MM` : ""}`,
        },
      ];
    } catch {
      let b: CityWx | null = null;
      let bd = Infinity;
      for (const c of d.cities) {
        const k = haversineKm(p.lat, p.lon, c.lat, c.lon);
        if (k < bd) {
          bd = k;
          b = c;
        }
      }
      return b ? [{ k: "grid fallback", v: dual(b.temp), cls: "g", u: `${b.name.slice(0, 12)} GRID` }] : [];
    }
  },
};

export default page;
