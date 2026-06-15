import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/almanac/", // GitHub Pages serves from codereimagine.github.io/almanac/
  plugins: [react()],
  server: { port: 5180 },
  preview: { port: 4180, allowedHosts: [".trycloudflare.com"] },
});
