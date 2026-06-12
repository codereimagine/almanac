/**
 * The instrument shell — LOCKED to the fused contract (almanac-fused.html):
 * airy ALMA·NAC title, B's heading tape, full-bleed stage, edge telemetry
 * columns, bottom prev/live/next strip. Hash routing, zero router deps.
 *
 * The index is LOCKED to the entry contract (almanac-entry-B-globe-index.html):
 * THE GLOBE IS THE INDEX. The focused instrument's own canvas fills the stage
 * (real pips, real bezel marks), instrument rows on the left answer to hover,
 * its preview stats sit on the right, idle auto-cycles every 4.5s.
 */

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useFeed } from "../feeds/feed";
import type { Registry } from "../registry/registry";
import type { AlmanacPage } from "../schema/page";
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
      {/* the wordmark is the quiet way home — no extra chrome on screen */}
      <h1 onClick={() => (window.location.hash = "#/")} style={{ pointerEvents: "auto", cursor: "pointer" }}>
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

/** The focused instrument's own face, with its feed — the index previews real data. */
function FocusedCanvas({ page }: { page: AlmanacPage }) {
  const feed = useFeed(page.feed);
  const Canvas = page.Canvas;
  return Canvas ? <Canvas live={feed?.live ?? false} /> : null;
}

function IndexView({ registry, upcoming = [] }: { registry: Registry; upcoming?: string[] }) {
  const [focus, setFocus] = useState(0);
  const auto = useRef(true);
  const n = registry.pages.length;

  useEffect(() => {
    // idle auto-cycle (contract: 4.5s), hover pauses, leaving the page resumes
    const t = setInterval(() => {
      if (auto.current) setFocus((f) => (f + 1) % Math.max(n, 1));
    }, 4500);
    const resume = () => {
      auto.current = true;
    };
    document.body.addEventListener("mouseleave", resume);
    return () => {
      clearInterval(t);
      document.body.removeEventListener("mouseleave", resume);
    };
  }, [n]);

  const page = registry.pages[focus];
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <>
      <Title sub="EARTH SYSTEMS · SELECT INSTRUMENT" />
      {/* the globe IS the index — remount per focus so the pips bloom in */}
      <div id="alm-stage">{page && <FocusedCanvas key={page.meta.id} page={page} />}</div>
      <div className="alm-col left index">
        {registry.pages.map((p, i) => (
          <div
            key={p.meta.id}
            className={i === focus ? "row on" : "row"}
            onMouseEnter={() => {
              auto.current = false;
              setFocus(i);
            }}
            onClick={() => (window.location.hash = `#/page/${p.meta.id}`)}
          >
            <span className="ix">{pad(i + 1)}</span>
            <span className="nm">{p.meta.system.toUpperCase()}</span>
            <span className="dot">●</span>
            <span className="ln">{p.meta.classification}</span>
          </div>
        ))}
        {upcoming.map((name, i) => (
          <div key={name} className="row wait">
            <span className="ix">{pad(n + i + 1)}</span>
            <span className="nm">{name}</span>
          </div>
        ))}
      </div>
      {page?.preview && <div className="alm-col right index">{render(page.preview)}</div>}
      <div id="alm-strip">
        {upcoming.length > 0 && (
          <span>
            <b>◂</b> {pad(n + 1)}–{pad(n + upcoming.length)} AWAITING UPLINK
          </span>
        )}
        <span className="live">● {n} INSTRUMENTS LIVE</span>
        <span>
          HOVER TO PREVIEW <b>▸</b>
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
      {/* contract strip: ◂ PREV · ● LIVE/◈ SNAPSHOT · NEXT ▸ — nothing else on screen */}
      <div id="alm-strip">
        <span className="navlink" onClick={() => (window.location.hash = prev ? `#/page/${prev.meta.id}` : "#/")}>
          <b>◂ PREV</b> {prev ? prev.meta.id.toUpperCase() : "INDEX"}
        </span>
        {page.feed && (
          <span className={feed?.live ? "live" : "snap"}>
            {feed?.live ? `● ${page.meta.system.toUpperCase()} LIVE` : "◈ SNAPSHOT"}
          </span>
        )}
        <span className="navlink" onClick={() => (window.location.hash = next ? `#/page/${next.meta.id}` : "#/")}>
          {next ? next.meta.id.toUpperCase() : "INDEX"} <b>NEXT ▸</b>
        </span>
      </div>
    </>
  );
}

export function Shell({ registry, upcoming }: { registry: Registry; upcoming?: string[] }) {
  const route = useRoute();
  const pageId = route.startsWith("/page/") ? route.slice(6) : null;
  const page = pageId ? registry.byId.get(pageId) : null;
  return (
    <>
      <Starfield />
      {page ? (
        <PageView key={page.meta.id} page={page} registry={registry} />
      ) : (
        <IndexView registry={registry} upcoming={upcoming} />
      )}
    </>
  );
}
