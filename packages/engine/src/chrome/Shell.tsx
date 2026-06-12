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

import { Fragment, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { setHoloTarget } from "../canvas/HoloCanvas";
import { useFeed } from "../feeds/feed";
import type { Registry } from "../registry/registry";
import type { AlmanacPage } from "../schema/page";
import { Tape } from "./Tape";

/** A searchable place — the site supplies the gazetteer; the engine stays name-blind. */
export interface GazetteerEntry {
  name: string;
  lat: number;
  lon: number;
}

// the picked place survives entering/leaving instruments (like the globe target)
let PLACE: GazetteerEntry | null = null;

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

/** What the focused instrument reads AT the searched place — live, via its probe. */
function PlaceReadout({ page, place }: { page: AlmanacPage; place: GazetteerEntry }) {
  const feed = useFeed(page.feed);
  const data = feed?.data ?? page.feed?.snapshot;
  const cells = page.probe && data !== undefined ? page.probe(place.lat, place.lon, data) : null;
  const co = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`;
  return (
    <>
      <div className="cell">
        <span className="k">target</span>
        <span className="v m">{place.name}</span>
        <span className="u">{co(place.lat, "N", "S")} {co(place.lon, "E", "W")}</span>
      </div>
      {cells?.map((c, i) => (
        <Fragment key={i}>
          <div className="rule" />
          <div className="cell">
            <span className="k">{c.k}</span>
            <span className={c.cls ? `v ${c.cls}` : "v"}>
              {c.v}
              {c.u && <span className="u"> {c.u}</span>}
            </span>
          </div>
        </Fragment>
      ))}
      {!cells && (
        <>
          <div className="rule" />
          {render(page.preview)}
        </>
      )}
    </>
  );
}

function IndexView({
  registry,
  upcoming = [],
  gazetteer = [],
}: {
  registry: Registry;
  upcoming?: string[];
  gazetteer?: GazetteerEntry[];
}) {
  const [focus, setFocus] = useState(0);
  const [booted, setBooted] = useState(0);
  const [going, setGoing] = useState(-1);
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<GazetteerEntry | null>(PLACE);
  const auto = useRef(true);
  const n = registry.pages.length;

  const QU = q.trim().toUpperCase();
  const hits =
    QU.length >= 2
      ? gazetteer
          .filter((g) => g.name.includes(QU))
          .sort((a, b) => Number(b.name.startsWith(QU)) - Number(a.name.startsWith(QU)) || a.name.length - b.name.length)
          .slice(0, 5)
      : [];
  const pick = (g: GazetteerEntry) => {
    PLACE = g;
    setPlace(g);
    setHoloTarget({ lat: g.lat, lon: g.lon });
    setQ("");
  };
  const clearPlace = () => {
    PLACE = null;
    setPlace(null);
    setHoloTarget(null);
    setQ("");
  };

  useEffect(() => {
    // uplink boot — the instruments come online one by one, then the pips bloom
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setBooted(i);
      if (i > n + upcoming.length) clearInterval(t);
    }, 150);
    return () => clearInterval(t);
  }, [n, upcoming.length]);

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
      {gazetteer.length > 0 && (
        <div id="alm-search">
          <span className="glyph">⌕</span>
          <input
            value={q}
            placeholder={place ? `◈ ${place.name}` : "SEARCH · COUNTRY OR CITY"}
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) pick(hits[0]);
              if (e.key === "Escape") clearPlace();
            }}
          />
          {place && (
            <span className="x" onClick={clearPlace}>
              ✕
            </span>
          )}
          {hits.length > 0 && (
            <div className="hits">
              {hits.map((g) => (
                <div key={g.name} className="hit" onClick={() => pick(g)}>
                  {g.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* the globe IS the index — remount per focus so the pips bloom in */}
      <div id="alm-stage">{page && <FocusedCanvas key={page.meta.id} page={page} />}</div>
      <div className="alm-col left index">
        {registry.pages.map((p, i) => (
          <div
            key={p.meta.id}
            className={`row${i === focus ? " on" : ""}${i >= booted ? " boot" : ""}${i === going ? " go" : ""}`}
            onMouseEnter={() => {
              auto.current = false;
              setFocus(i);
            }}
            onClick={() => {
              // light send-off flash, then enter the instrument
              setGoing(i);
              setTimeout(() => (window.location.hash = `#/page/${p.meta.id}`), 160);
            }}
          >
            <span className="ix">{pad(i + 1)}</span>
            <span className="nm">{p.meta.index ?? p.meta.system.toUpperCase()}</span>
            <span className="dot">●</span>
            <span className="ln">{p.meta.classification}</span>
          </div>
        ))}
        {upcoming.map((name, i) => (
          <div key={name} className={`row wait${n + i >= booted ? " boot" : ""}`}>
            <span className="ix">{pad(n + i + 1)}</span>
            <span className="nm">{name}</span>
          </div>
        ))}
      </div>
      {page && place ? (
        <div className="alm-col right index">
          <PlaceReadout key={page.meta.id} page={page} place={place} />
        </div>
      ) : (
        page?.preview && <div className="alm-col right index">{render(page.preview)}</div>
      )}
      <div id="alm-strip">
        {upcoming.length > 0 ? (
          <span>
            <b>◂</b> {pad(n + 1)}–{pad(n + upcoming.length)} AWAITING UPLINK
          </span>
        ) : (
          <span>
            <b>◂</b> CATALOG 01–{pad(n)}
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

export function Shell({
  registry,
  upcoming,
  gazetteer,
}: {
  registry: Registry;
  upcoming?: string[];
  gazetteer?: GazetteerEntry[];
}) {
  const route = useRoute();
  const pageId = route.startsWith("/page/") ? route.slice(6) : null;
  const page = pageId ? registry.byId.get(pageId) : null;
  return (
    <>
      <Starfield />
      {page ? (
        <PageView key={page.meta.id} page={page} registry={registry} />
      ) : (
        <IndexView registry={registry} upcoming={upcoming} gazetteer={gazetteer} />
      )}
    </>
  );
}
