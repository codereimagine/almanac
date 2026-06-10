/**
 * The instrument shell — LOCKED to the fused contract (almanac-fused.html):
 * airy ALMA·NAC title, B's heading tape, full-bleed stage, edge telemetry
 * columns, bottom prev/live/next strip. Hash routing, zero router deps.
 */

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useFeed } from "../feeds/feed";
import type { Registry } from "../registry/registry";
import type { AlmanacPage } from "../schema/page";
import { SYSTEM_ACCENT } from "../tokens";
import { Tape } from "./Tape";

function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const fn = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}

function useUtc(): string {
  const [utc, setUtc] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(t);
  }, []);
  return utc;
}

/** Twinkling starfield — the almanac looks at Earth from space. */
function Starfield({ n = 120 }: { n?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() < 0.85 ? 1 : 2,
        tw: `${2 + Math.random() * 4}s`,
        twd: `${Math.random() * 4}s`,
      })),
    [n],
  );
  return (
    <div id="alm-stars">
      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={
            {
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              "--tw": s.tw,
              "--twd": s.twd,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Title({ sub }: { sub: string }) {
  return (
    <div id="alm-title">
      <h1>
        ALMA<b>NAC</b>
      </h1>
      <div className="s">{sub}</div>
    </div>
  );
}

function render(node: ReactNode | ComponentType | undefined): ReactNode {
  if (node == null) return null;
  if (typeof node === "function") {
    const C = node as ComponentType;
    return <C />;
  }
  return node as ReactNode;
}

function IndexView({ registry }: { registry: Registry }) {
  const utc = useUtc();
  return (
    <>
      <Title sub={`EARTH SYSTEMS · ${String(registry.pages.length).padStart(2, "0")} INSTRUMENTS`} />
      <div id="alm-rack">
        <div className="rack">
          {registry.pages.map((p, i) => (
            <div
              key={p.meta.id}
              className="inst-card"
              style={{ "--accent": p.meta.accent ?? SYSTEM_ACCENT[p.meta.system] } as React.CSSProperties}
              onClick={() => (window.location.hash = `#/page/${p.meta.id}`)}
            >
              <span className="idx">{String(i + 1).padStart(2, "0")}</span>
              <div className="sys">{p.meta.system.toUpperCase()}</div>
              <h3>{p.meta.title}</h3>
              <div className="cls">{p.meta.classification}</div>
            </div>
          ))}
        </div>
      </div>
      <div id="alm-strip">
        <span>
          UTC <b>{utc}</b>
        </span>
        <span>
          REF <b>WGS-84</b>
        </span>
      </div>
    </>
  );
}

function PageView({ page, registry }: { page: AlmanacPage; registry: Registry }) {
  const feed = useFeed(page.feed);
  const utc = useUtc();
  const Canvas = page.Canvas;
  const idx = registry.pages.findIndex((p) => p.meta.id === page.meta.id);
  const prev = registry.pages[(idx - 1 + registry.pages.length) % registry.pages.length];
  const next = registry.pages[(idx + 1) % registry.pages.length];
  return (
    <>
      <Title sub={page.meta.classification} />
      <Tape label={`UTC ${utc}`} />
      <div id="alm-stage">{Canvas && <Canvas live={feed?.live ?? false} />}</div>
      {page.readouts?.left && <div className="alm-col left">{render(page.readouts.left)}</div>}
      {page.readouts?.right && <div className="alm-col right">{render(page.readouts.right)}</div>}
      <div id="alm-readout">{render(page.content)}</div>
      <div id="alm-strip">
        <span className="navlink" onClick={() => (window.location.hash = prev ? `#/page/${prev.meta.id}` : "#/")}>
          <b>◂ PREV</b> {prev ? prev.meta.id.toUpperCase() : "INDEX"}
        </span>
        <span
          className={page.feed ? (feed?.live ? "live" : "snap") : "navlink"}
          onClick={() => (window.location.hash = "#/")}
        >
          {page.feed ? (feed?.live ? `● ${page.meta.system.toUpperCase()} LIVE` : "◈ SNAPSHOT") : "≡ INDEX"}
        </span>
        <span className="navlink" onClick={() => (window.location.hash = next ? `#/page/${next.meta.id}` : "#/")}>
          {next ? next.meta.id.toUpperCase() : "INDEX"} <b>NEXT ▸</b>
        </span>
      </div>
    </>
  );
}

export function Shell({ registry }: { registry: Registry }) {
  const route = useRoute();
  const pageId = route.startsWith("/page/") ? route.slice(6) : null;
  const page = pageId ? registry.byId.get(pageId) : null;
  return (
    <>
      <Starfield />
      {page ? <PageView key={page.meta.id} page={page} registry={registry} /> : <IndexView registry={registry} />}
    </>
  );
}
