/**
 * MobileShell — the phone version of the almanac, a SEPARATE architecture from the
 * desktop Shell (which is left byte-identical). The desktop squeezes edge telemetry
 * rails around a full-bleed globe; that fights a narrow screen. Here the layout is a
 * clean vertical stack instead:
 *
 *    title · search  →  a CONTAINED globe (fully visible in its own box, never cut or
 *    overlapped — HoloFitContext sizes it to the box)  →  a content panel below
 *    (the instrument list / target dossier on the index, the readouts on a page).
 *
 * Reuses the engine primitives (HoloCanvas, feeds, probes, geocoder, place persistence);
 * it is a re-layout of the same data, not new logic.
 */

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { HoloFitContext, setHoloPickHandler, setHoloTarget } from "../canvas/HoloCanvas";
import { useFeed } from "../feeds/feed";
import { haversineKm } from "../geo";
import { runProbe } from "../probes";
import type { Registry } from "../registry/registry";
import type { AlmanacPage, ProbeCell } from "../schema/page";
import { SYSTEM_ACCENT } from "../tokens";
import { geocodeSearch } from "./geocode";
import type { GazetteerEntry } from "./Shell";

const PLACE_KEY = "almanac.place";

function loadPlace(): GazetteerEntry | null {
  try {
    const s = localStorage.getItem(PLACE_KEY);
    if (!s) return null;
    const p = JSON.parse(s) as Partial<GazetteerEntry>;
    if (typeof p?.name === "string" && Number.isFinite(p?.lat) && Number.isFinite(p?.lon)) return p as GazetteerEntry;
  } catch {
    /* corrupt/unavailable storage — fresh start */
  }
  return null;
}
function persistPlace(p: GazetteerEntry | null): void {
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLACE_KEY);
  } catch {
    /* storage denied — session still works */
  }
}

function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const fn = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}

function render(node: ReactNode | ComponentType | undefined): ReactNode {
  if (node == null) return null;
  if (typeof node === "function") {
    const C = node as ComponentType;
    return <C />;
  }
  return node as ReactNode;
}

const pad = (v: number) => String(v).padStart(2, "0");

/** The focused instrument's own canvas, with its feed — sized to the globe box. */
function FocusedCanvas({ page }: { page: AlmanacPage }) {
  const feed = useFeed(page.feed);
  const Canvas = page.Canvas;
  return Canvas ? <Canvas live={feed?.live ?? false} /> : null;
}

function Title() {
  return (
    <h1 id="alm-m-title" onClick={() => (window.location.hash = "#/")}>
      ALMA<b>NAC</b>
    </h1>
  );
}

/** One dossier line: what THIS instrument reads at the place (self-contained probe). */
function DossierRow({ page, place }: { page: AlmanacPage; place: GazetteerEntry }) {
  const feed = useFeed(page.feed);
  const [cells, setCells] = useState<ProbeCell[] | null | undefined>(undefined);
  const data = feed?.data ?? page.feed?.snapshot;
  useEffect(() => {
    let dead = false;
    const go = () => void runProbe(page, place, data).then((c) => !dead && setCells(c));
    go();
    const t = setInterval(go, 30_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.meta.id, place.lat, place.lon, place.tz, feed?.asOf]);
  return (
    <div className="m-drow" onClick={() => (window.location.hash = `#/page/${page.meta.id}`)}>
      <span className="m-dk" style={{ color: page.meta.accent ?? SYSTEM_ACCENT[page.meta.system] }}>
        {page.meta.index ?? page.meta.system.toUpperCase()}
      </span>
      <span className="m-dv">
        {cells === undefined && <i>probing…</i>}
        {cells === null && <i>unavailable</i>}
        {cells?.map((c, i) => (
          <span key={i} className="m-dcell">
            <em>{c.k}</em> <b className={c.cls || undefined}>{c.v}</b>
            {c.u && <i> {c.u}</i>}
          </span>
        ))}
      </span>
    </div>
  );
}

/** ── INDEX ─────────────────────────────────────────────────────────────── */
function MobileIndex({ registry, gazetteer = [] }: { registry: Registry; gazetteer?: GazetteerEntry[] }) {
  const [focus, setFocus] = useState(0);
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<GazetteerEntry | null>(loadPlace);
  const [remote, setRemote] = useState<GazetteerEntry[]>([]);
  const auto = useRef(true);
  const seq = useRef(0);
  const n = registry.pages.length;
  const QU = q.trim().toUpperCase();

  useEffect(() => {
    if (QU.length < 2) return setRemote([]);
    const my = ++seq.current;
    const t = setTimeout(() => void geocodeSearch(QU).then((f) => seq.current === my && setRemote(f)), 300);
    return () => clearTimeout(t);
  }, [QU]);

  const local = useMemo(
    () =>
      QU.length >= 2
        ? gazetteer
            .filter((g) => g.name.includes(QU))
            .sort((a, b) => Number(b.name.startsWith(QU)) - Number(a.name.startsWith(QU)) || a.name.length - b.name.length)
            .slice(0, 4)
        : [],
    [QU, gazetteer],
  );
  const hits: GazetteerEntry[] = [];
  for (const g of [...remote, ...local]) {
    if (!hits.some((h) => h.name === g.name)) hits.push(g);
    if (hits.length >= 8) break;
  }

  const pick = (g: GazetteerEntry) => {
    persistPlace(g);
    setPlace(g);
    setHoloTarget({ lat: g.lat, lon: g.lon });
    setQ("");
  };
  const clearPlace = () => {
    persistPlace(null);
    setPlace(null);
    setHoloTarget(null);
    setQ("");
  };

  // restore a persisted target on mount; click-the-planet picks the nearest known place
  useEffect(() => {
    if (place) setHoloTarget({ lat: place.lat, lon: place.lon });
    setHoloPickHandler((lat, lon) => {
      let best: GazetteerEntry | null = null;
      let bd = Infinity;
      for (const g of gazetteer) {
        const k = haversineKm(lat, lon, g.lat, g.lon);
        if (k < bd) (bd = k), (best = g);
      }
      const name = best && bd <= 25 ? best.name : best && bd <= 600 ? `NEAR ${best.name}` : "OPEN WATERS";
      pick({ name, lat: +lat.toFixed(2), lon: +lon.toFixed(2), tz: bd <= 25 ? best?.tz : undefined });
    });
    return () => setHoloPickHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gazetteer]);

  // idle auto-cycle — animates the globe through the instruments
  useEffect(() => {
    const t = setInterval(() => auto.current && setFocus((f) => (f + 1) % Math.max(n, 1)), 4500);
    return () => clearInterval(t);
  }, [n]);

  const page = registry.pages[focus];
  return (
    <>
      <div className="m-top">
        <Title />
        <div className="m-sub">EARTH SYSTEMS · SELECT INSTRUMENT</div>
        {gazetteer.length > 0 && (
          <div className="m-search">
            <span className="m-glyph">⌕</span>
            <input
              value={q}
              placeholder={place ? `◈ ${place.name}` : "SEARCH · COUNTRY OR CITY"}
              spellCheck={false}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits[0]) pick(hits[0]);
              }}
            />
            {place && (
              <span className="m-x" onClick={clearPlace}>
                ✕
              </span>
            )}
            {hits.length > 0 && (
              <div className="m-hits">
                {hits.map((g) => (
                  <div key={g.name} className="m-hit" onClick={() => pick(g)}>
                    {g.name}
                    {g.region && <span className="m-rg">{g.region}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="m-globe">{page && <FocusedCanvas key={page.meta.id} page={page} />}</div>

      <div className="m-panel">
        {place ? (
          <div className="m-dossier">
            <div className="m-dhead">
              <span className="m-dt">{place.name}</span>
              <span className="m-dx" onClick={clearPlace}>
                CLEAR ✕
              </span>
            </div>
            {registry.pages
              .filter((p) => p.probe)
              .map((p) => (
                <DossierRow key={p.meta.id} page={p} place={place} />
              ))}
          </div>
        ) : (
          <div className="m-list">
            {registry.pages.map((p, i) => (
              <div
                key={p.meta.id}
                className={`m-row${i === focus ? " on" : ""}`}
                onClick={() => (window.location.hash = `#/page/${p.meta.id}`)}
                onPointerEnter={() => {
                  auto.current = false;
                  setFocus(i);
                }}
              >
                <span className="m-ix">{pad(i + 1)}</span>
                <span className="m-nm">{p.meta.index ?? p.meta.system.toUpperCase()}</span>
                <span className="m-cl">{p.meta.classification}</span>
                <span className="m-go">▸</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** ── INSTRUMENT PAGE ───────────────────────────────────────────────────── */
function MobilePage({ page, registry }: { page: AlmanacPage; registry: Registry }) {
  const feed = useFeed(page.feed);
  const idx = registry.pages.findIndex((p) => p.meta.id === page.meta.id);
  const prev = registry.pages[(idx - 1 + registry.pages.length) % registry.pages.length];
  const next = registry.pages[(idx + 1) % registry.pages.length];
  return (
    <>
      <div className="m-top">
        <Title />
        <div className="m-sub">{page.meta.classification}</div>
      </div>
      <div className="m-globe">{page.Canvas && <FocusedCanvas page={page} />}</div>
      <div className="m-panel">
        <div className="m-read">
          {page.readouts?.left && <div className="m-col">{render(page.readouts.left)}</div>}
          {page.readouts?.right && <div className="m-col">{render(page.readouts.right)}</div>}
        </div>
        <div className="m-nav">
          <span onClick={() => (window.location.hash = prev ? `#/page/${prev.meta.id}` : "#/")}>◂ PREV</span>
          {page.feed && <span className={feed?.live ? "m-live" : "m-snap"}>{feed?.live ? "● LIVE" : "◈ SNAPSHOT"}</span>}
          <span onClick={() => (window.location.hash = next ? `#/page/${next.meta.id}` : "#/")}>NEXT ▸</span>
        </div>
        <div className="m-home" onClick={() => (window.location.hash = "#/")}>
          ◂ ALL INSTRUMENTS
        </div>
      </div>
    </>
  );
}

export function MobileShell({
  registry,
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
    <HoloFitContext.Provider value={true}>
      <div id="alm-m">
        {page ? (
          <MobilePage key={page.meta.id} page={page} registry={registry} />
        ) : (
          <MobileIndex registry={registry} gazetteer={gazetteer} />
        )}
      </div>
    </HoloFitContext.Provider>
  );
}
