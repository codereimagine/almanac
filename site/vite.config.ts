import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Content-Security-Policy: only this origin, plus the live feeds the instruments
// read (USGS quakes + volcanoes, NOAA tides, Open-Meteo, MET.no) and city search.
// font-src allows data: (one inline face ships in the CSS). Build only — Vite dev
// injects CSS as inline <style> tags that this would block.
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "font-src 'self' data:", "img-src 'self'",
  "connect-src 'self' https://earthquake.usgs.gov https://volcanoes.usgs.gov https://api.tidesandcurrents.noaa.gov https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.met.no",
  "manifest-src 'self'", "worker-src 'self'", "base-uri 'self'", "form-action 'none'", "object-src 'none'",
].join("; ");
const csp = (): Plugin => ({
  name: "csp-meta",
  apply: "build",
  transformIndexHtml: (html) => html.replace(/<meta charset="UTF-8" \/>/, `$&\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  base: "/almanac/", // GitHub Pages serves from codereimagine.github.io/almanac/
  plugins: [csp(), react()],
  server: { port: 5180 },
  preview: { port: 4180 },
});
