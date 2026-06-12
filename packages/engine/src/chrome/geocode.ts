/**
 * Live place search — the trio's geocoder (bewthr/starnav/uptyme all use this
 * exact open-meteo endpoint: no key, CORS-open, returns IANA timezone).
 * Failures resolve to [] — the search line falls back to the local gazetteer
 * silently; the network can never break typing.
 */

import type { GazetteerEntry } from "./Shell";

const API = "https://geocoding-api.open-meteo.com/v1/search";
const MAX_QUERY = 100;

interface GeoResult {
  name?: string;
  admin1?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export async function geocodeSearch(query: string): Promise<GazetteerEntry[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const r = await fetch(`${API}?name=${encodeURIComponent(query.trim().slice(0, MAX_QUERY))}&count=8`);
    if (!r.ok) return [];
    const d = (await r.json()) as { results?: GeoResult[] };
    const out: GazetteerEntry[] = [];
    for (const x of d.results ?? []) {
      if (!x.name || typeof x.latitude !== "number" || typeof x.longitude !== "number") continue;
      out.push({
        name: x.name.toUpperCase(),
        region: [x.admin1, x.country].filter(Boolean).join(" · ").toUpperCase() || undefined,
        lat: x.latitude,
        lon: x.longitude,
        tz: x.timezone,
      });
    }
    return out;
  } catch {
    return [];
  }
}
