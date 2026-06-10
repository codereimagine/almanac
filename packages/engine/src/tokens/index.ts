/** Token values the canvas layer needs as JS (Three.js colors etc.). Single source: instrument.css. */

import type { SystemKind } from "../schema/page";

export const HOLO = "#6fd3ff";
export const HOLO_HI = "#d6f3ff";
export const VOID = "#030911";
export const SAT = "#9fb4a6";
export const SAT_AMBER = "#ffb45e";

export const SYSTEM_ACCENT: Record<SystemKind, string> = {
  ocean: "#38b6ff",
  seismic: "#ffb45e",
  geothermal: "#ff7a4d",
  weather: "#8be9fd",
  celestial: "#c9a7ff",
  time: "#7dffc4",
  position: "#ffe27d",
  orbit: "#9fd0ff",
  calibration: "#6fd3ff",
};
