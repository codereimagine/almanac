/**
 * DataFeed — the engine's data seam (the FleetAdapter pattern, again).
 *
 * Every instrument can declare a feed: a bundled SNAPSHOT (always present, the
 * almanac is beautiful offline) and an optional fetchLive (USGS, NOAA, ...).
 * useFeed tries live, falls back to snapshot, and tells the canvas which it got —
 * live data earns the halo glow; snapshot shows a SNAPSHOT tag. Pages never fetch
 * directly; the seam keeps every instrument testable with zero network.
 */

import { useEffect, useRef, useState } from "react";

/**
 * Live results are cached per feed.id (TTL = refreshMs) and in-flight pulls are
 * shared. Several components read the same feed (canvas + both readout columns,
 * and the index previews the focused instrument every few seconds) — the seam
 * guarantees that costs one upstream request per interval, not one per mount.
 */
const LIVE_CACHE = new Map<string, { at: number; data: unknown }>();
const IN_FLIGHT = new Map<string, Promise<unknown>>();

function pullLive<T>(feed: DataFeed<T>): Promise<T> {
  const ttl = feed.refreshMs ?? 60_000;
  const hit = LIVE_CACHE.get(feed.id);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);
  let p = IN_FLIGHT.get(feed.id) as Promise<T> | undefined;
  if (!p) {
    p = feed
      .fetchLive!()
      .then((data) => {
        LIVE_CACHE.set(feed.id, { at: Date.now(), data });
        return data;
      })
      .finally(() => IN_FLIGHT.delete(feed.id));
    IN_FLIGHT.set(feed.id, p);
  }
  return p;
}

export interface DataFeed<T> {
  /** stable id, e.g. "usgs-quakes-24h" */
  id: string;
  /** bundled fallback — the instrument must render beautifully from this alone */
  snapshot: T;
  /** optional live fetch; absent = snapshot-only instrument (still valid) */
  fetchLive?: () => Promise<T>;
  /** re-poll interval ms when live succeeds (default: no re-poll) */
  refreshMs?: number;
}

export interface FeedState<T> {
  data: T;
  /** true = fetchLive succeeded (halo glow earned) */
  live: boolean;
  /** ISO time of last successful update (live or load) */
  asOf: string;
}

export function useFeed<T>(feed: DataFeed<T> | undefined): FeedState<T> | null {
  const [state, setState] = useState<FeedState<T> | null>(
    feed ? { data: feed.snapshot, live: false, asOf: new Date().toISOString() } : null,
  );
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!feed?.fetchLive) return;
    let dead = false;
    const pull = async () => {
      try {
        const data = await pullLive(feed);
        if (!dead) setState({ data, live: true, asOf: new Date().toISOString() });
      } catch {
        /* stay on snapshot — the instrument never breaks on network */
      }
    };
    void pull();
    if (feed.refreshMs) timer.current = setInterval(pull, feed.refreshMs);
    return () => {
      dead = true;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed?.id]);

  return state;
}
