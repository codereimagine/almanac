/**
 * The page contract — the heart of the engine.
 *
 * An instrument page exports exactly:
 *   meta     identity + classification line + accent
 *   content  the readout prose (React node or component)
 *   Canvas   optional live visual (R3F or DOM) — the instrument's face
 *   feed     optional DataFeed powering the canvas/readouts
 *
 * The registry validates this at load. THE PLATFORM GATE: adding a page must
 * require zero engine edits — pages are plugins, the engine never knows their names.
 */

import type { ComponentType, ReactNode } from "react";
import type { DataFeed } from "../feeds/feed";

/** Earth-system grouping shown on the index + used for accent defaults. */
export type SystemKind =
  | "ocean"
  | "seismic"
  | "geothermal"
  | "weather"
  | "celestial"
  | "time"
  | "position"
  | "orbit"
  | "calibration";

export interface PageMeta {
  /** stable slug — also the route (#/page/<id>) */
  id: string;
  /** instrument name, e.g. "SEISMIC · TECTONIC ACTIVITY" */
  title: string;
  /** which Earth system this instrument reads */
  system: SystemKind;
  /** the satellite-chrome classification line under the title */
  classification: string;
  /** index ordering (lower first) */
  order?: number;
  /** index row display name — defaults to the system name (e.g. "STARS · PLANETS") */
  index?: string;
  /** accent override — defaults to the system's token */
  accent?: string;
}

export interface CanvasProps {
  /** true when the feed returned live data (canvas may earn the halo glow) */
  live: boolean;
}

export interface AlmanacPage<T = unknown> {
  meta: PageMeta;
  /** optional prose — NOT rendered on the instrument (contract: no mid-screen text); reserved for index/docs */
  content?: ReactNode | ComponentType | null;
  Canvas?: ComponentType<CanvasProps>;
  feed?: DataFeed<T>;
  /** edge-column telemetry (the fused contract's left/right readouts) */
  readouts?: { left?: ReactNode | ComponentType; right?: ReactNode | ComponentType };
  /** index preview — the 3 stat cells the globe-index shows while this instrument is focused */
  preview?: ReactNode | ComponentType;
}

/** Runtime validation — fail loud at registry-build time, not render time. */
export function validatePage(p: unknown, source: string): AlmanacPage {
  const page = p as Partial<AlmanacPage>;
  const m = page?.meta as Partial<PageMeta> | undefined;
  const fail = (why: string): never => {
    throw new Error(`invalid almanac page (${source}): ${why}`);
  };
  if (!m) fail("missing meta");
  if (!m!.id || !/^[a-z0-9-]+$/.test(m!.id)) fail("meta.id must be a kebab-case slug");
  if (!m!.title) fail("meta.title required");
  if (!m!.system) fail("meta.system required");
  if (!m!.classification) fail("meta.classification required");
  return page as AlmanacPage;
}
