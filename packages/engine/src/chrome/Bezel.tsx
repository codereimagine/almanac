/**
 * Bezel — B's instrument ring, screen-space SVG over the globe stage.
 * Degree ticks every 5°, numerals every 30°, optional gold target diamonds
 * marking tracked events (deg = bezel azimuth). Pure chrome: pointer-events none.
 */

import { useEffect, useState } from "react";

export interface BezelMark {
  deg: number;
  color?: string;
}

export function Bezel({ marks = [] }: { marks?: BezelMark[] }) {
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const fn = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const cx = dims.w / 2;
  const cy = dims.h * 0.54;
  const rGlobe = Math.min(dims.w, dims.h) * 0.305;
  const rOuter = rGlobe * 1.34;
  const rInner = rGlobe * 1.24;
  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const big = d % 30 === 0;
    const a = ((d - 90) * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * rOuter;
    const y1 = cy + Math.sin(a) * rOuter;
    const rIn = rGlobe * (big ? 1.27 : 1.3);
    ticks.push(
      <line
        key={d}
        x1={x1}
        y1={y1}
        x2={cx + Math.cos(a) * rIn}
        y2={cy + Math.sin(a) * rIn}
        stroke={big ? "rgba(127,217,255,.55)" : "rgba(127,217,255,.2)"}
        strokeWidth={big ? 1.6 : 0.8}
      />,
    );
    if (big) {
      ticks.push(
        <text
          key={`t${d}`}
          x={cx + Math.cos(a) * rGlobe * 1.43}
          y={cy + Math.sin(a) * rGlobe * 1.43}
          fill="#4d6076"
          fontSize="8"
          fontFamily="JetBrains Mono Variable, JetBrains Mono, monospace"
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing="1"
        >
          {String(d).padStart(3, "0")}
        </text>,
      );
    }
  }
  return (
    <svg
      style={{ position: "fixed", inset: 0, zIndex: 8, pointerEvents: "none" }}
      width={dims.w}
      height={dims.h}
    >
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(127,217,255,.28)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="rgba(127,217,255,.12)" strokeWidth="1" />
      {ticks}
      {marks.map((m, i) => {
        const a = ((m.deg - 90) * Math.PI) / 180;
        const x = cx + Math.cos(a) * rOuter;
        const y = cy + Math.sin(a) * rOuter;
        const c = m.color ?? "#f0ce96";
        return (
          <rect
            key={i}
            x={-5}
            y={-5}
            width={10}
            height={10}
            fill={c}
            transform={`translate(${x},${y}) rotate(45)`}
            style={{ filter: `drop-shadow(0 0 7px ${c})` }}
          />
        );
      })}
    </svg>
  );
}
