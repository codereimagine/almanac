/** Great-circle helpers — pages use these for place-aware probes. */

const D = Math.PI / 180;

/** Central angle between two points, in degrees. */
export function angularDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(lat1 * D) * Math.sin(lat2 * D) +
    Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.cos((lon2 - lon1) * D);
  return Math.acos(Math.min(1, Math.max(-1, a))) / D;
}

/** Great-circle distance in kilometres (mean Earth radius). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return angularDeg(lat1, lon1, lat2, lon2) * D * 6371;
}
