# almanac

A precision instrument for reading Earth's live systems — **seismic · ocean · geothermal · weather · sky · time · position · orbit** — rendered as a cinematic globe with per-place readouts. Every instrument has a live path and an honest offline fallback; the dossier answers for any point on Earth.

Vite + React + TypeScript. `@almanac/engine` is the instrument design system (tokens, schema, chrome, canvas + feed seams); each page under `site/src/pages` is a plugin — a new instrument is a folder, no engine edits.

## Run

```sh
npm install
npm run dev        # http://localhost:5180
npm run build      # type-check + production build -> site/dist
npm run preview    # serve the build
```

## Data sources

All keyless, no accounts: open-meteo + MET.no (weather), USGS (earthquakes / volcanic alerts), NOAA CO-OPS (tides), and on-device astronomy for sky / position / orbit.

## License

[Apache-2.0](LICENSE).
