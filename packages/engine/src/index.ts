/** @almanac/engine — public API. Sites consume this; pages are plugins. */

export { HoloCanvas, setHoloPickHandler, setHoloTarget } from "./canvas/HoloCanvas";
export type { HoloCanvasProps, HoloMark, HoloPip, HoloProject } from "./canvas/HoloCanvas";
export { HoloGlobe, latLonToVec3 } from "./canvas/HoloGlobe";
export type { HoloGlobeProps } from "./canvas/HoloGlobe";
export { Bezel } from "./chrome/Bezel";
export type { BezelMark } from "./chrome/Bezel";
export { Shell } from "./chrome/Shell";
export type { GazetteerEntry } from "./chrome/Shell";
export { Tape } from "./chrome/Tape";
export { useFeed } from "./feeds/feed";
export type { DataFeed, FeedState } from "./feeds/feed";
export { angularDeg, haversineKm, kmMi } from "./geo";
export { buildRegistry } from "./registry/registry";
export type { Registry } from "./registry/registry";
export { runProbe } from "./probes";
export { validatePage } from "./schema/page";
export type { AlmanacPage, CanvasProps, PageMeta, ProbeCell, ProbePlace, SystemKind } from "./schema/page";
export { HOLO, HOLO_HI, SAT, SAT_AMBER, SAT_HI, SYSTEM_ACCENT, VOID } from "./tokens";
