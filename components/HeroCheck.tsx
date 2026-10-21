"use client";

import { useState } from "react";
import { useGuide } from "./AIGuide";

/* The free AI Visibility check, run from the hero input.
 *
 * The mockup has no separate "check" section, so the result expands in place
 * beneath the hero rather than sending anyone to another part of the page.
 *
 * The honesty wording is unchanged from the version this replaces: one
 * answer, one assistant, one moment — not a ranking, and not a measurement of
 * ChatGPT. The names it returned are shown so a visitor weighs evidence
 * rather than a number we invented. */

type Result = {
  question: string;
  found: boolean;
  searched: boolean;
  competitors: string[];
  answer: string;
};

export default function HeroCheck() {
  const guide = useGuide();
  const [website, setWebsite] = useState("");
  const [businessType, setType] = useState("");
  const [area, setArea] = useState("");
  const [needMore, setNeedMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    // The check needs a trade and an area; the hero only asks for a website,
    // so the rest is revealed rather than demanded up front.
    if (!businessType.trim() || !area.trim()) {
      setNeedMore(true);
      return;
    }

    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: website, website, businessType, area }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "The check could not run just now.");
        return;
      }
      setResult(data);
    } catch {
      setErr("The check could not run just now.");
    } finally {
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 15,
    color: "var(--ink)",
    minWidth: 0,
    flex: 1,
    padding: "14px 0 14px 18px",
  };

  return (
    <div id="check" style={{ scrollMarginTop: 90 }}>
      <form onSubmit={run}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 10,
            overflow: "hidden",
            maxWidth: 470,
          }}
        >
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Your website address"
            aria-label="Your website"
            style={field}
          />
          <button type="submit" className="btn-amber" disabled={busy} style={{ borderRadius: 0, padding: "14px 18px", whiteSpace: "nowrap" }}>
            {busy ? "Checking…" : "Check my website ↗"}
          </button>
        </div>

        {needMore && !result && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, maxWidth: 470 }}>
            <input
              value={businessType}
              onChange={(e) => setType(e.target.value)}
              placeholder="What you do — e.g. estate agent"
              aria-label="Type of business"
              required
              style={{ ...field, flex: "1 1 200px", padding: "12px 14px", background: "#fff", border: "1px solid var(--line)", borderRadius: 10 }}
            />
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Where — e.g. Croydon"
              aria-label="Your area"
              required
              style={{ ...field, flex: "1 1 140px", padding: "12px 14px", background: "#fff", border: "1px solid var(--line)", borderRadius: 10 }}
            />
          </div>
        )}
      </form>

      <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "10px 0 0" }}>
        {needMore && !result
          ? "Two more details and we'll ask an AI assistant for your trade."
          : "Start with a free AI visibility check."}
      </p>

      {busy && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 10 }}>
          Running a real web search and reading the answer — about 15 seconds.
        </p>
      )}
      {err && <p style={{ fontSize: 13.5, color: "#9a2a2a", marginTop: 10 }}>{err}</p>}

      {result && (
        <div
          style={{
            marginTop: 18,
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 20,
            maxWidth: 560,
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>We asked an AI assistant:</p>
          <p style={{ margin: "5px 0 0", fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>
            &ldquo;{result.question}&rdquo;
          </p>

          <p
            style={{
              margin: "14px 0 0",
              fontSize: 16.5,
              fontWeight: 700,
              color: result.found ? "#1f6b36" : "#9a5a12",
            }}
          >
            {result.found ? "You came up in the answer." : "You did not come up in the answer."}
          </p>

          {result.competitors.length > 0 && (
            <>
              <p style={{ margin: "14px 0 6px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                Who it named instead
              </p>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: 7, listStyle: "none", padding: 0, margin: 0 }}>
                {result.competitors.map((c) => (
                  <li key={c} style={{ border: "1px solid var(--line)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, color: "var(--ink-2)" }}>
                    {c}
                  </li>
                ))}
              </ul>
            </>
          )}

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Read the full answer</summary>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.7, color: "var(--ink-2)", marginTop: 10 }}>{result.answer}</p>
          </details>

          <p style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
            One answer from one AI assistant with web search, just now — not a ranking, and not a measurement of
            ChatGPT specifically. Ask again tomorrow and the list can differ.
            {result.searched ? "" : " (This run answered without searching the web.)"}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <a href="/contact" className="btn-amber" style={{ padding: "11px 18px", fontSize: 14 }}>
              Book a free 15-min call
            </a>
            <button type="button" onClick={() => guide.open("report")} className="btn-line" style={{ padding: "11px 18px", fontSize: 14 }}>
              Fix this for me →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
