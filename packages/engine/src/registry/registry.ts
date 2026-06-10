/**
 * Page registry — the platform property, made concrete.
 *
 * The SITE globs its pages (import.meta.glob is bundler-side, so it lives there)
 * and hands the raw modules here. The engine validates each against the page
 * contract and builds the ordered catalog. The engine never imports a page by
 * name — pages are plugins. Adding instrument N+1 = adding a folder in the site.
 */

import type { AlmanacPage } from "../schema/page";
import { validatePage } from "../schema/page";

export interface Registry {
  pages: AlmanacPage[];
  byId: Map<string, AlmanacPage>;
}

export function buildRegistry(modules: Record<string, unknown>): Registry {
  const pages: AlmanacPage[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const exported = (mod as { default?: unknown }).default ?? mod;
    pages.push(validatePage(exported, path));
  }
  pages.sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99) || a.meta.id.localeCompare(b.meta.id));
  const byId = new Map(pages.map((p) => [p.meta.id, p]));
  if (byId.size !== pages.length) throw new Error("duplicate almanac page ids");
  return { pages, byId };
}
