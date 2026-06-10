/** Token values the canvas layer needs as JS. Single source: instrument.css (the fused contract). */

import type { SystemKind } from "../schema/page";

export const HOLO = "#7fd9ff"; // contract cyan
export const HOLO_HI = "#eaf9ff";
export const VOID = "#01030a";
export const SAT = "#f0ce96"; // telemetry gold (starnav lineage)
export const SAT_HI = "#f4dcae";
export const SAT_AMBER = "#ffb45e";
export const MAG = "#ff2bd6"; // the signature magenta (accents only — never rings on the globe)

export const SYSTEM_ACCENT: Record<SystemKind, string> = {
  ocean: "#38b6ff",
  seismic: "#ffb45e",
  geothermal: "#ff7a4d",
  weather: "#8be9fd",
  celestial: "#c9a7ff",
  time: "#7dffc4",
  position: "#ffe27d",
  orbit: "#9fd0ff",
  calibration: "#7fd9ff",
};
