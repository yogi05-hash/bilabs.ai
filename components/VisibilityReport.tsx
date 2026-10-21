"use client";

import { useState } from "react";
import { useGuide } from "./AIGuide";

/* The free AI Visibility Report.
 *
 * One real, web-searched question put to an AI assistant, with the answer
 * shown in full. The copy is careful not to overclaim: this is one answer from
 * one assistant at one moment, not a ranking and not a measurement of ChatGPT.
 * We show the names it actually returned so the visitor judges the evidence
 * rather than a number we invented. */

type Result = { question: string; found: boolean; searched: boolean; competitors: string[]; answer: string };

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL || "";

export default function VisibilityReport() {
  const guide = useGuide();
  const [businessName, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [businessType, setType] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !businessType.trim() || !area.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch("/api/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, website, businessType, area }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "The check could not run just now."); return; }
      setResult(data);
    } catch {
      setErr("The check could not run just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="check" className="glass-card" style={{ padding: 28, scrollMarginTop: 90 }}>
      <form onSubmit={run} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <input className="form-input" value={businessName} onChange={(e) => setName(e.target.value)} placeholder="Your business name" aria-label="Your business name" />
        <input className="form-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.co.uk (optional)" aria-label="Your website" />
        <input className="form-input" value={businessType} onChange={(e) => setType(e.target.value)} placeholder="What you do — e.g. estate agent" aria-label="Type of business" required />
        <input className="form-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Where — e.g. Croydon" aria-label="Your area" required />
        <button type="submit" disabled={busy} className="btn-primary" style={{ gridColumn: "1 / -1", padding: "14px 0", fontSize: 15, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Asking an AI assistant…" : "Get my free AI Visibility Report"}
        </button>
      </form>

      {busy && <p style={{ marginTop: 14, fontSize: 13, color: "var(--text-3)" }}>Running a real web search and reading the answer — about 15 seconds.</p>}
      {err && <p style={{ marginTop: 14, fontSize: 14, color: "#fca5a5" }}>{err}</p>}

      {result && (
        <div style={{ marginTop: 26, borderTop: "1px solid var(--border-strong)", paddingTop: 22 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>We asked an AI assistant:</p>
          <p style={{ margin: "6px 0 0", fontWeight: 600, color: "var(--text-1)" }}>&ldquo;{result.question}&rdquo;</p>

          <div style={{
            marginTop: 20, padding: 20, borderRadius: 14,
            background: result.found ? "rgba(34,197,94,.08)" : "rgba(245,183,49,.08)",
            border: `1px solid ${result.found ? "rgba(34,197,94,.3)" : "rgba(245,183,49,.3)"}`,
          }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "var(--text-1)" }}>
              {result.found ? "You came up in the answer." : "You did not come up in the answer."}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.65, color: "var(--text-2)" }}>
              {result.found
                ? "Worth keeping it that way — these answers shift as the sources behind them change."
                : "These assistants answer from what they can read about you. Making your details readable is the thing to fix."}
            </p>
          </div>

          {result.competitors.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent)" }}>Who it named instead</p>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                {result.competitors.map((c) => (
                  <li key={c} style={{ border: "1px solid var(--border-strong)", borderRadius: 999, padding: "6px 14px", fontSize: 13, color: "var(--text-2)" }}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>Read the full answer</summary>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "var(--text-2)", marginTop: 12 }}>{result.answer}</p>
          </details>

          <p style={{ marginTop: 20, fontSize: 12.5, lineHeight: 1.65, color: "var(--text-3)" }}>
            One answer from one AI assistant with web search, just now — not a ranking, and not a measurement of
            ChatGPT specifically. Ask again tomorrow and the list can differ.
            {result.searched ? "" : " (This run answered without searching the web.)"}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
            <a
              href={CALENDLY || "/contact?package=audit"}
              {...(CALENDLY ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="btn-primary"
              style={{ padding: "13px 26px", fontSize: 14 }}
            >
              Book a free 15-min call
            </a>
            <button type="button" onClick={() => guide.open("report")} className="btn-secondary" style={{ padding: "13px 26px", fontSize: 14 }}>
              Fix this for me →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
