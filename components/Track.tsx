"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/* Page-view beacon.
 *
 * Sends a path, the referrer and any UTM tags. It reads no device
 * characteristics and sets no identifier of its own — the visitor id is an
 * httpOnly cookie the server owns, which this file cannot see.
 *
 * UTM tags are stashed in sessionStorage on arrival so they survive the
 * journey to a later page, the evaluation and checkout. Without that, every
 * campaign would appear to convert on the landing page and nowhere else.
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const STORE = "bl_utm";

export function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const url = new URL(window.location.href);
    const fresh: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k);
      if (v) fresh[k] = v.slice(0, 120);
    }
    if (Object.keys(fresh).length) {
      sessionStorage.setItem(STORE, JSON.stringify(fresh));
      return fresh;
    }
    const saved = sessionStorage.getItem(STORE);
    return saved ? (JSON.parse(saved) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function track(name: string, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    name,
    id: crypto.randomUUID(),
    path: window.location.pathname,
    referrer: document.referrer || null,
    utm: readUtm(),
    props,
  });
  try {
    // keepalive so an event fired as the page unloads still arrives
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break a page */
  }
}

export default function Track() {
  const pathname = usePathname();
  const params = useSearchParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const key = `${pathname}?${params.toString()}`;
    // React runs effects twice in development; without this every page view
    // would be counted twice locally and the funnel would look wrong.
    if (last.current === key) return;
    last.current = key;
    track("page_view");
  }, [pathname, params]);

  return null;
}
