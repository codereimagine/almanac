/// <reference types="vite/client" />
/**
 * almanac — offline test suite. No network: live feeds replay real recorded
 * responses (see fixtures.ts). Nothing here is imported by the app.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { angularDeg, buildRegistry, haversineKm, kmMi, runProbe, validatePage } from "@almanac/engine";
import type { AlmanacPage, ProbePlace } from "@almanac/engine";
import { installFetch } from "./fixtures";

const modules = import.meta.glob("../src/pages/*/page.tsx", { eager: true });
const LONDON: ProbePlace = { lat: 51.5074, lon: -0.1278, name: "London", tz: "Europe/London" };
const NETWORK_FEEDS = ["weather", "ocean", "geothermal", "seismic"];

/** Same shape as the snapshot: every key present; a list the snapshot fills is filled
 *  by the recorded response too, and its rows carry the same fields with the same
 *  types (numbers finite). An empty or malformed parse fails here. */
function sameShape(live: Record<string, unknown>, snap: Record<string, unknown>) {
  for (const k of Object.keys(snap)) {
    expect(live, `missing key "${k}"`).toHaveProperty(k);
    const s = snap[k], l = live[k];
    if (!Array.isArray(s)) continue;
    expect(Array.isArray(l), `"${k}" should be an array`).toBe(true);
    if (s.length === 0) continue;
    expect((l as unknown[]).length, `"${k}" parsed empty from a real response`).toBeGreaterThan(0);
    const [srow, lrow] = [s[0], (l as unknown[])[0]];
    if (srow && typeof srow === "object") {
      for (const [f, v] of Object.entries(srow)) {
        const lv = (lrow as Record<string, unknown>)[f];
        if (v === null || v === undefined) continue;
        expect(typeof lv, `"${k}[0].${f}" type`).toBe(typeof v);
        if (typeof lv === "number") expect(Number.isFinite(lv), `"${k}[0].${f}" finite`).toBe(true);
      }
    }
  }
}

let net: ReturnType<typeof installFetch>;
beforeAll(() => {
  net = installFetch();
  // position's fetchLive reads the hash; in tests it is not the open page, so it skips GNSS
  (globalThis as { window?: unknown }).window ??= { location: { hash: "" } };
});
afterAll(() => net.restore());

describe("engine · great-circle math", () => {
  it("New York → London is ~5,570 km", () => {
    expect(haversineKm(40.7128, -74.006, 51.5074, -0.1278)).toBeCloseTo(5570, -1);
  });
  it("same point is 0°, antipodes are 180°", () => {
    expect(angularDeg(10, 20, 10, 20)).toBeCloseTo(0, 5); // acos rounding: ~1e-6° (≈ 10 cm)
    expect(angularDeg(0, 0, 0, 180)).toBeCloseTo(180, 6);
    expect(angularDeg(90, 0, -90, 0)).toBeCloseTo(180, 6);
  });
  it("is symmetric", () => {
    expect(haversineKm(35.68, 139.69, -33.87, 151.21)).toBeCloseTo(haversineKm(-33.87, 151.21, 35.68, 139.69), 9);
  });
  it("every distance shows both units", () => {
    expect(kmMi(100)).toBe("100 KM · 62 MI");
    expect(kmMi(0)).toBe("0 KM · 0 MI");
  });
});

describe("engine · page contract", () => {
  const ok = { meta: { id: "a-b", title: "T", system: "time", classification: "C" } };
  it("accepts a valid page", () => {
    expect(validatePage(ok, "t")).toBe(ok);
  });
  it.each([
    ["missing meta", {}],
    ["non-slug id", { meta: { ...ok.meta, id: "Bad Id" } }],
    ["missing title", { meta: { ...ok.meta, title: "" } }],
    ["missing system", { meta: { ...ok.meta, system: undefined } }],
    ["missing classification", { meta: { ...ok.meta, classification: "" } }],
  ])("rejects %s", (_why, page) => {
    expect(() => validatePage(page, "t")).toThrow(/invalid almanac page/);
  });
  it("rejects duplicate page ids", () => {
    expect(() => buildRegistry({ a: ok, b: ok })).toThrow(/duplicate/);
  });
});

describe("engine · probe safety jacket", () => {
  const page = (probe: AlmanacPage["probe"]) => ({ meta: { id: "p", title: "P", system: "time", classification: "C" }, probe }) as AlmanacPage;
  it("a throwing probe resolves to null instead of breaking the dossier", async () => {
    expect(await runProbe(page(() => { throw new Error("boom"); }), LONDON, {})).toBeNull();
  });
  it("a rejecting probe resolves to null", async () => {
    expect(await runProbe(page(async () => { throw new Error("down"); }), { ...LONDON, lat: 1 }, {})).toBeNull();
  });
  it("garbage output resolves to null", async () => {
    expect(await runProbe(page(() => "nope" as never), LONDON, {})).toBeNull();
  });
  it("no data means no probe", async () => {
    expect(await runProbe(page(() => [{ k: "x", v: "1" }]), LONDON, undefined)).toBeNull();
  });
});

describe("site · all instruments", () => {
  const registry = buildRegistry(modules);
  it("loads all 9 instruments in order", () => {
    expect(registry.pages.map((p) => p.meta.id)).toHaveLength(9);
    const orders = registry.pages.map((p) => p.meta.order ?? 99);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  for (const page of registry.pages) {
    const id = page.meta.id;
    describe(id, () => {
      it.skipIf(!page.feed)("has a bundled offline snapshot", () => {
        expect(page.feed!.snapshot).toBeTruthy();
      });

      // skipped, not passed, where an instrument has no live feed (calibration is constants only)
      it.skipIf(!page.feed?.fetchLive)("live feed matches the snapshot's shape (offline replay)", async () => {
        const live = (await page.feed!.fetchLive!()) as Record<string, unknown>;
        sameShape(live, page.feed!.snapshot as Record<string, unknown>);
      });

      it.skipIf(!page.probe || !page.feed)("place readout works on the snapshot (London)", async () => {
        const cells = await page.probe!(LONDON, page.feed!.snapshot);
        expect(Array.isArray(cells)).toBe(true);
        expect(cells.length).toBeGreaterThan(0);
        for (const c of cells) {
          expect(typeof c.k).toBe("string");
          expect(typeof c.v).toBe("string");
          expect(c.v).not.toMatch(/NaN|undefined/);
        }
      });
    });
  }

  describe("weather · works with or without internet", () => {
    const weather = () => registry.byId.get("weather")!;
    const probe = (place: ProbePlace) => weather().probe!(place, weather().feed!.snapshot) as Promise<{ k: string; v: string; u?: string }[]>;
    const cut = async (hosts: string[], fn: () => Promise<void>) => {
      hosts.forEach((h) => net.down.add(h));
      try { await fn(); } finally { hosts.forEach((h) => net.down.delete(h)); }
    };

    it("global grid: Open-Meteo down → fetchLive rejects, so the engine shows the bundled snapshot", async () => {
      await cut(["api.open-meteo.com"], async () => {
        await expect(weather().feed!.fetchLive!()).rejects.toThrow(/open-meteo 503/);
      });
    });
    it("place readout tier 1: live Open-Meteo point forecast", async () => {
      const cells = await probe(LONDON);
      expect(cells.map((c) => c.k)).toEqual(["now", "feels", "wind"]);
    });
    it("place readout tier 2: Open-Meteo down → live MET.no, labelled", async () => {
      await cut(["api.open-meteo.com"], async () => {
        const cells = await probe(LONDON);
        expect(cells[0].u).toMatch(/MET\.NO/);
      });
    });
    it("place readout tier 3: both down → nearest bundled reading, still a readout", async () => {
      await cut(["api.open-meteo.com", "api.met.no"], async () => {
        const cells = await probe(LONDON);
        expect(cells.length).toBeGreaterThan(0);
        for (const c of cells) expect(c.v).not.toMatch(/NaN|undefined/);
      });
    });
  });

  it("network instruments were exercised against recorded data", () => {
    const hosts = new Set(net.calls.map((u) => new URL(u).host));
    for (const h of ["earthquake.usgs.gov", "volcanoes.usgs.gov", "api.tidesandcurrents.noaa.gov"]) expect(hosts).toContain(h);
    expect([...hosts].some((h) => h === "api.open-meteo.com" || h === "api.met.no")).toBe(true);
    expect(NETWORK_FEEDS.every((id) => registry.byId.has(id))).toBe(true);
  });
});
