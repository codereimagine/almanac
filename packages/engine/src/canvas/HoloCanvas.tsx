/**
 * HoloCanvas — THE contract globe. A 1:1 port of the renderer inside
 * mockups/almanac-fused.html (canvas 2D): same constants, same draw order,
 * same blur values. Atmosphere halos → bezel ring/ticks/numerals → gold
 * diamonds → graticule → double-pass bloomed coastlines → night wash → limb
 * → data pips. Nothing else — pixel fidelity by construction.
 */

import { useEffect, useRef } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";

export interface HoloPip {
  lat: number;
  lon: number;
  /** pip size driver (e.g. quake magnitude) */
  size: number;
  color: string;
}
export interface HoloMark {
  deg: number;
  color?: string;
}

/** Rotation lives at module scope so the Earth keeps turning across remounts —
 *  the index swaps the focused instrument's canvas without the globe snapping back. */
let ROT = 0;

let COAST: number[][][] | null = null;
function coastlines(): number[][][] {
  if (COAST) return COAST;
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);
  const rings: number[][][] = [];
  for (const f of land.features ?? [land as never]) {
    const g = (f as GeoJSON.Feature).geometry;
    if (g.type === "Polygon") for (const r of g.coordinates) rings.push(r as number[][]);
    if (g.type === "MultiPolygon")
      for (const poly of g.coordinates) for (const r of poly) rings.push(r as number[][]);
  }
  COAST = rings;
  return rings;
}

export interface HoloCanvasProps {
  pips?: HoloPip[];
  marks?: HoloMark[];
  /** deg/frame at 60fps — contract value .05 */
  spin?: number;
}

export function HoloCanvas({ pips = [], marks = [], spin = 0.05 }: HoloCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ pips, marks });
  propsRef.current = { pips, marks };

  useEffect(() => {
    const c = ref.current!;
    const X = c.getContext("2d")!;
    let W = 0,
      H = 0,
      R = 0,
      pipA = 0, // pip bloom: eases 0 → 1 on mount (contract: hover a row, the Earth answers)
      alive = true;
    const fit = () => {
      W = c.width = innerWidth * 2;
      H = c.height = innerHeight * 2;
      R = Math.min(W, H) * 0.3;
      c.style.width = innerWidth + "px";
      c.style.height = innerHeight + "px";
    };
    fit();
    window.addEventListener("resize", fit);
    const cx = () => W / 2;
    const cy = () => (H / 2) * 1.08;
    const proj = (lon: number, lat: number): [number, number, number] | null => {
      const l = ((lon + ROT) * Math.PI) / 180;
      const p = (lat * Math.PI) / 180;
      const x = Math.cos(p) * Math.sin(l);
      const y = Math.sin(p);
      const z = Math.cos(p) * Math.cos(l);
      return z > 0 ? [cx() + x * R, cy() - y * R, z] : null;
    };

    const draw = () => {
      if (!alive) return;
      X.clearRect(0, 0, W, H);
      ROT += spin;
      const t = Date.now();
      // atmosphere bloom halos (contract constants)
      for (const [r, o] of [
        [1.16, 0.05],
        [1.08, 0.09],
        [1.03, 0.13],
      ] as const) {
        const gr = X.createRadialGradient(cx(), cy(), R * 0.9, cx(), cy(), R * r);
        gr.addColorStop(0, "rgba(127,217,255,0)");
        gr.addColorStop(0.85, `rgba(127,217,255,${o})`);
        gr.addColorStop(1, "rgba(127,217,255,0)");
        X.fillStyle = gr;
        X.beginPath();
        X.arc(cx(), cy(), R * r, 0, 7);
        X.fill();
      }
      // bezel — degree ring, ticks, numerals
      X.strokeStyle = "rgba(127,217,255,.28)";
      X.lineWidth = 2;
      X.beginPath();
      X.arc(cx(), cy(), R * 1.34, 0, 7);
      X.stroke();
      X.strokeStyle = "rgba(127,217,255,.12)";
      X.beginPath();
      X.arc(cx(), cy(), R * 1.24, 0, 7);
      X.stroke();
      for (let d = 0; d < 360; d += 5) {
        const big = d % 30 === 0;
        const a = ((d - 90) * Math.PI) / 180;
        X.strokeStyle = big ? "rgba(127,217,255,.55)" : "rgba(127,217,255,.2)";
        X.lineWidth = big ? 3 : 1.5;
        X.beginPath();
        X.moveTo(cx() + Math.cos(a) * R * 1.34, cy() + Math.sin(a) * R * 1.34);
        X.lineTo(cx() + Math.cos(a) * R * (big ? 1.27 : 1.3), cy() + Math.sin(a) * R * (big ? 1.27 : 1.3));
        X.stroke();
        if (big) {
          X.fillStyle = "#4d6076";
          X.font = "600 15px JetBrains Mono Variable, JetBrains Mono, monospace";
          X.textAlign = "center";
          X.textBaseline = "middle";
          X.fillText(String(d).padStart(3, "0"), cx() + Math.cos(a) * R * 1.43, cy() + Math.sin(a) * R * 1.43);
        }
      }
      // gold diamonds (tracked events)
      for (const m of propsRef.current.marks) {
        const a = ((m.deg - 90) * Math.PI) / 180;
        const x = cx() + Math.cos(a) * R * 1.34;
        const y = cy() + Math.sin(a) * R * 1.34;
        const col = m.color ?? "#F0CE96";
        X.save();
        X.translate(x, y);
        X.rotate(Math.PI / 4);
        X.fillStyle = col;
        X.shadowColor = col;
        X.shadowBlur = 14;
        X.fillRect(-7, -7, 14, 14);
        X.restore();
        X.shadowBlur = 0;
      }
      // graticule (15°)
      X.strokeStyle = "rgba(127,217,255,.10)";
      X.lineWidth = 1.6;
      for (let la = -60; la <= 60; la += 15) {
        X.beginPath();
        let on = false;
        for (let lo = -180; lo <= 180; lo += 4) {
          const q = proj(lo, la);
          if (q) {
            on ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]);
            on = true;
          } else on = false;
        }
        X.stroke();
      }
      for (let lo = -180; lo < 180; lo += 15) {
        X.beginPath();
        let on = false;
        for (let la = -88; la <= 88; la += 4) {
          const q = proj(lo, la);
          if (q) {
            on ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]);
            on = true;
          } else on = false;
        }
        X.stroke();
      }
      // coastlines — double-pass bloom (contract constants)
      for (const [w, al, bl] of [
        [6, 0.16, 28],
        [2.2, 0.95, 12],
      ] as const) {
        X.strokeStyle = `rgba(186,240,255,${al})`;
        X.lineWidth = w;
        X.shadowColor = "#7fd9ff";
        X.shadowBlur = bl;
        for (const ring of coastlines()) {
          X.beginPath();
          let on = false;
          for (let i = 0; i < ring.length; i += 2) {
            const q = proj(ring[i][0], ring[i][1]);
            if (q) {
              on ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]);
              on = true;
            } else on = false;
          }
          X.stroke();
        }
      }
      X.shadowBlur = 0;
      // subtle night-side wash
      const sg = X.createLinearGradient(cx() - R, cy(), cx() + R, cy());
      sg.addColorStop(0, "rgba(1,3,8,.5)");
      sg.addColorStop(0.55, "rgba(1,3,8,0)");
      X.fillStyle = sg;
      X.beginPath();
      X.arc(cx(), cy(), R, 0, 7);
      X.fill();
      // limb
      X.strokeStyle = "rgba(127,217,255,.5)";
      X.lineWidth = 2.4;
      X.beginPath();
      X.arc(cx(), cy(), R, 0, 7);
      X.stroke();
      // data pips (the only thing on the planet) — bloom in via pipA easing
      pipA += (1 - pipA) * 0.06;
      for (const q of propsRef.current.pips) {
        const pp = proj(q.lon, q.lat);
        if (!pp) continue;
        const s = (3 + q.size * 1.8) * (1 + 0.25 * Math.sin(t / 280 + q.lon)) * pipA;
        X.fillStyle = q.color;
        X.shadowColor = q.color;
        X.shadowBlur = 16;
        X.globalAlpha = pipA;
        X.beginPath();
        X.arc(pp[0], pp[1], s, 0, 7);
        X.fill();
        X.globalAlpha = 1;
        X.shadowBlur = 0;
      }
      requestAnimationFrame(draw);
    };
    draw();
    return () => {
      alive = false;
      window.removeEventListener("resize", fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0 }} />;
}
