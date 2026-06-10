// The almanac site — first consumer of @almanac/engine.
// All it does: glob its pages (plugins), hand them to the engine. Nothing else.

import { buildRegistry, Shell } from "@almanac/engine";
import "@almanac/engine/tokens.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
import { createRoot } from "react-dom/client";

const modules = import.meta.glob("./pages/*/page.tsx", { eager: true });
const registry = buildRegistry(modules as Record<string, unknown>);

createRoot(document.getElementById("root")!).render(<Shell registry={registry} />);
