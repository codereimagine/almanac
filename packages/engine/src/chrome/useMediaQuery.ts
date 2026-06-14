import { useEffect, useState } from "react";

/** Reactive media-query match — re-renders on viewport changes (resize, rotate).
 *  Drives the desktop⇄mobile shell split. SSR-safe (defaults to false). */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const fn = () => setMatch(mql.matches);
    fn();
    mql.addEventListener("change", fn);
    return () => mql.removeEventListener("change", fn);
  }, [query]);
  return match;
}
