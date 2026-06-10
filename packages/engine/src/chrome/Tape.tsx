/**
 * Tape — B's moving heading tape (degree ruler scrolling under the title).
 * Canvas 2D, masked edges via the #alm-tape CSS. Label shows the live value.
 */

import { useEffect, useRef } from "react";

export function Tape({ label }: { label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const x = c.getContext("2d")!;
    let off = 0;
    let alive = true;
    const fit = () => {
      c.width = c.clientWidth * 2;
      c.height = c.clientHeight * 2;
    };
    fit();
    window.addEventListener("resize", fit);
    const tick = () => {
      if (!alive) return;
      x.clearRect(0, 0, c.width, c.height);
      off += 0.4;
      x.strokeStyle = "rgba(127,217,255,.5)";
      x.fillStyle = "#4d6076";
      x.font = "14px JetBrains Mono Variable, JetBrains Mono, monospace";
      x.textAlign = "center";
      for (let px = -40; px < c.width + 40; px += 26) {
        const wx = px - (off % 26);
        const big = Math.round((wx + off) / 26) % 5 === 0;
        x.beginPath();
        x.moveTo(wx, c.height);
        x.lineTo(wx, c.height - (big ? 22 : 11));
        x.stroke();
        if (big) {
          const deg = ((Math.round((wx + off) / 26) * 2) % 360 + 360) % 360;
          x.fillText(String(deg).padStart(3, "0"), wx, 18);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
    return () => {
      alive = false;
      window.removeEventListener("resize", fit);
    };
  }, []);
  return (
    <div id="alm-tape">
      <canvas ref={ref} />
      <span className="hdg">{label}</span>
      <span className="car">▾</span>
    </div>
  );
}
