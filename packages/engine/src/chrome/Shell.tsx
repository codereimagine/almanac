/**
 * The instrument shell — telemetry bar (the Ghosts satellite framing), the index
 * rack of instruments, and the page view with the canvas frame. Hash routing,
 * zero router deps: #/ = index, #/page/<id> = an instrument.
 */

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useFeed } from "../feeds/feed";
import type { Registry } from "../registry/registry";
import type { AlmanacPage } from "../schema/page";
import { SYSTEM_ACCENT } from "../tokens";

function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const fn = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}

/** Twinkling starfield — the almanac looks at Earth from space; the stars are context, not décor. */
function Starfield({ n = 90 }: { n?: number }) {
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

function Telemetry({ registry, liveCount }: { registry: Registry; liveCount: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const utc = now.toISOString().slice(11, 19);
  return (
    <div id="alm-telemetry">
      <span className="brand">
        <span className="brand-mark">A</span>ALMANAC
      </span>
      <span className="seg">
        EARTH SYSTEMS · <b>{registry.pages.length} INSTRUMENTS</b>
      </span>
      <span className={`seg ${liveCount > 0 ? "live" : ""}`}>
        FEEDS LIVE <b>{liveCount}</b>
      </span>
      <span className="filler" />
      <span className="seg">
        UTC <b>{utc}</b>
      </span>
      <span className="seg">
        REF <b>WGS-84</b>
      </span>
    </div>
  );
}

function IndexRack({ registry }: { registry: Registry }) {
  return (
    <div className="alm-panel" style={{ flex: 1 }}>
      <span className="ret tl" /><span className="ret tr" /><span className="ret bl" /><span className="ret br" />
      <div className="p-ttl">
        INSTRUMENT INDEX <span className="k">select an earth system</span>
      </div>
      <div className="p-body">
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
      <div className="cal-ticks" />
    </div>
  );
}

function PageView({ page }: { page: AlmanacPage }) {
  const feed = useFeed(page.feed);
  const Canvas = page.Canvas;
  const Content = page.content;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}>
      <div className="page-head">
        <h2>{page.meta.title}</h2>
        <span className="cls">{page.meta.classification}</span>
        <span className="back" onClick={() => (window.location.hash = "#/")}>
          ◂ INDEX
        </span>
      </div>
      {Canvas && (
        <div className="canvas-frame">
          <span className="ret tl" /><span className="ret tr" /><span className="ret bl" /><span className="ret br" />
          {page.feed && (
            <span className={`feed-tag ${feed?.live ? "live" : "snap"}`}>
              {feed?.live ? "● LIVE" : "SNAPSHOT"}
            </span>
          )}
          <Canvas live={feed?.live ?? false} />
        </div>
      )}
      <div className="alm-panel" style={{ flex: Canvas ? "0 0 auto" : 1, maxHeight: Canvas ? "30%" : undefined }}>
        <div className="p-ttl">
          READOUT <span className="k">{feed ? `as of ${feed.asOf.slice(11, 19)} UTC` : "static"}</span>
        </div>
        <div className="p-body readout">
          {typeof Content === "function" ? <Content /> : (Content as ReactNode)}
        </div>
      </div>
    </div>
  );
}

export function Shell({ registry }: { registry: Registry }) {
  const route = useRoute();
  const pageId = route.startsWith("/page/") ? route.slice(6) : null;
  const page = pageId ? registry.byId.get(pageId) : null;
  // halo glow is earned: count of pages whose feeds went live this session
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fn = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setLiveIds((s) => new Set(s).add(id));
    };
    window.addEventListener("alm:feed-live", fn);
    return () => window.removeEventListener("alm:feed-live", fn);
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, display: "flex", flexDirection: "column",
        gap: 12, padding: 14, zIndex: 5,
      }}
    >
      <Starfield />
      <Telemetry registry={registry} liveCount={liveIds.size} />
      {page ? <PageView key={page.meta.id} page={page} /> : <IndexRack registry={registry} />}
    </div>
  );
}

export type { ComponentType };
