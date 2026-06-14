/**
 * Units — a tiny, robust preference store (the trio's settings pattern,
 * distilled). Temperature in °C or °F, persisted to localStorage, reactive
 * across every component via a subscriber set. Display-only: the feeds always
 * carry SI (°C), conversion happens at the readout. Built to extend (wind,
 * distance) without reshaping callers.
 */

import { useEffect, useState } from "react";
import { clearProbeCache } from "./probes";

export type TempUnit = "C" | "F";
const KEY = "almanac.tempUnit";

function load(): TempUnit {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "C" || v === "F") return v;
  } catch {
    /* storage unavailable — default */
  }
  return "C";
}

let unit: TempUnit = load();
const listeners = new Set<() => void>();

export function getTempUnit(): TempUnit {
  return unit;
}

export function setTempUnit(u: TempUnit): void {
  if (u === unit) return;
  unit = u;
  try {
    localStorage.setItem(KEY, u);
  } catch {
    /* session-only is fine */
  }
  clearProbeCache(); // dossier probes return formatted strings — recompute in the new unit
  listeners.forEach((fn) => fn());
}

export function toggleTempUnit(): void {
  setTempUnit(unit === "C" ? "F" : "C");
}

/** °C in → formatted string in the active (or given) unit. */
export function fmtTemp(celsius: number, u: TempUnit = unit, digits = 1): string {
  return u === "F" ? `${(celsius * 1.8 + 32).toFixed(digits)}°F` : `${celsius.toFixed(digits)}°C`;
}

/** Subscribe a component to unit changes (returns the live unit). */
export function useTempUnit(): TempUnit {
  const [u, setU] = useState(unit);
  useEffect(() => {
    const fn = () => setU(unit);
    listeners.add(fn);
    fn(); // sync in case it changed between render and effect
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return u;
}
