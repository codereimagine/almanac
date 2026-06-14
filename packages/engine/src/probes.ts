/**
 * Probe runner — the engine's safety jacket around page probes.
 *
 * Sync probes (math over feed data) run fresh every call — cheap, always
 * current. Async probes (point fetches) are time-boxed (8s) and cached per
 * page+place (60s TTL) so the dossier never hammers an upstream. A probe that
 * throws, rejects, times out, or returns garbage resolves to null — the
 * dossier shows UNAVAILABLE for that system and everything else keeps living.
 */

import type { AlmanacPage, ProbeCell, ProbePlace } from "./schema/page";

const CACHE = new Map<string, { at: number; cells: ProbeCell[] }>();
const TTL = 60_000;
const TIMEOUT = 8_000;

/** Drop all cached async probe results — called when a display preference
 *  (e.g. temperature unit) changes so the dossier reformats immediately. */
export function clearProbeCache(): void {
  CACHE.clear();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("probe timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        res(v);
      },
      (e) => {
        clearTimeout(t);
        rej(e);
      },
    );
  });
}

export async function runProbe(page: AlmanacPage, place: ProbePlace, data: unknown): Promise<ProbeCell[] | null> {
  if (!page.probe || data === undefined) return null;
  const key = `${page.meta.id}:${place.lat.toFixed(2)}:${place.lon.toFixed(2)}:${place.tz ?? ""}`;
  // only async results are ever cached, so this returns only fetched cells
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.cells;
  try {
    const out = page.probe(place, data);
    if (!(out instanceof Promise)) return Array.isArray(out) ? out : null;
    const cells = await withTimeout(out, TIMEOUT);
    if (!Array.isArray(cells)) return null;
    CACHE.set(key, { at: Date.now(), cells });
    return cells;
  } catch {
    return null;
  }
}
