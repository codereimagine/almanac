// The almanac site — first consumer of @almanac/engine.
// All it does: glob its pages (plugins), hand them to the engine. Nothing else.

import { buildRegistry, Shell } from "@almanac/engine";
import "@almanac/engine/tokens.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import { createRoot } from "react-dom/client";

const modules = import.meta.glob("./pages/*/page.tsx", { eager: true });
const registry = buildRegistry(modules as Record<string, unknown>);

// the searchable world: 177 country centroids + the weather grid's 132 cities
import countriesGaz from "./gazetteer-countries.json";
import citiesGaz from "./pages/weather/cities.json";
const seen = new Set<string>();
const gazetteer = [...(countriesGaz as [string, number, number][]), ...(citiesGaz as [string, number, number][])]
  .map(([name, lat, lon]) => ({ name, lat, lon }))
  .filter((g) => !seen.has(g.name) && seen.add(g.name));

// full catalog uplinked — no AWAITING rows left on the globe-index
createRoot(document.getElementById("root")!).render(<Shell registry={registry} gazetteer={gazetteer} />);
