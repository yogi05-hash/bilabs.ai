"use client";

import { useEffect, useState } from "react";

/* A strip of real, anonymised activity under the hero — the site visibly
 * doing its job rather than describing it. Renders nothing until the data
 * arrives, and nothing at all if there is too little to show honestly. */

type Pulse = {
  checksThisWeek: number;
  liveProfiles: number;
  recent: { type: string; area: string; mentions: number; total: number; at: string }[];
};

function ago(iso: string): string {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");

export default function Pulse() {
  const [p, setP] = useState<Pulse | null>(null);
  useEffect(() => {
    fetch("/api/pulse", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Pulse | null) => setP(d))
      .catch(() => setP(null));
  }, []);

  if (!p || p.recent.length < 3) return null;

  return (
    <section className="strip" aria-label="Recent activity">
      <div className="wrap">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", alignItems: "center" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "#1f6b36", boxShadow: "0 0 0 4px rgba(31,107,54,.15)" }} />
            Live
          </p>
          <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
            <strong style={{ color: "var(--ink)" }}>{p.checksThisWeek}</strong> free check{p.checksThisWeek === 1 ? "" : "s"} this week
          </span>
          {p.liveProfiles > 0 && (
            <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
              <strong style={{ color: "var(--ink)" }}>{p.liveProfiles}</strong> business{p.liveProfiles === 1 ? "" : "es"} published to AI search
            </span>
          )}
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {p.recent.map((r, i) => (
            <li
              key={`${r.at}-${i}`}
              style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "nowrap" }}
            >
              {article(r.type)} {r.type} in {r.area} ·{" "}
              <span style={{ fontWeight: 700, color: r.mentions > 0 ? "#1f6b36" : "#9a5a12" }}>named in {r.mentions} of {r.total}</span>
              <span style={{ color: "var(--ink-3)" }}> · {ago(r.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
