"use client";

import { useState } from "react";

/* The free AI check, run from the hero.
 *
 * Shows what was actually measured and nothing more: how many of five real
 * questions named the business, who was named instead, and a readiness score
 * built only from live checks of their own site. The weights are published in
 * a tooltip rather than hidden, because a score whose arithmetic you cannot
 * see is just an opinion with a number on it.
 *
 * Mentions and readiness are reported separately on purpose. A business does
 * not control what an assistant says, and folding that into a "readiness"
 * figure would make the number mean nothing — in testing a vet scored 75/100
 * with no mentions while a plumber scored 55 with four. */

type Check = { id: string; label: string; weight: number; pass: boolean; detail: string };
type Query = { id: string; label: string; question: string; available: boolean; found: boolean };
type Scan = { url: string | null; reachable: boolean; checks: Check[]; score: number | null; maxScore: number; loadMs: number | null };
type Result = {
  business: string;
  mentionCount: number;
  queriesRun: number;
  queries: Query[];
  competitors: string[];
  scan: Scan | null;
  emailed: boolean;
};

const FREE_CHECKS = 3;

export default function HeroCheck() {
  const [website, setWebsite] = useState("");
  const [businessName, setName] = useState("");
  const [businessType, setType] = useState("");
  const [area, setArea] = useState("");
  const [postcode, setPostcode] = useState("");
  const [needMore, setNeedMore] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const [email, setEmail] = useState("");
  // unticked by default, deliberately: consent has to be given, not withdrawn
  const [consent, setConsent] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [mailErr, setMailErr] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!businessType.trim() || !area.trim()) { setNeedMore(true); return; }

    setBusy(true); setErr(null); setResult(null); setUnlocked(false);
    try {
      const res = await fetch("/api/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: businessName || website, website, businessType, area, postcode }),
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

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !result) return;
    setSending(true); setMailErr(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, report: result, businessType, area, marketingConsent: consent }),
      });
      const data = await res.json();
      if (!res.ok) { setMailErr(data.error ?? "Could not send that just now."); return; }
      setUnlocked(true);
    } catch {
      setMailErr("Could not send that just now.");
    } finally {
      setSending(false);
    }
  };

  const field: React.CSSProperties = {
    border: "none", outline: "none", background: "transparent", fontSize: 15,
    color: "var(--ink)", minWidth: 0, flex: 1, padding: "14px 0 14px 18px",
  };
  const boxed: React.CSSProperties = {
    ...field, padding: "12px 14px", background: "#fff",
    border: "1px solid var(--line)", borderRadius: 10,
  };

  const checks = result?.scan?.reachable ? result.scan.checks : [];
  const visible = unlocked ? checks : checks.slice(0, FREE_CHECKS);
  const hidden = Math.max(0, checks.length - visible.length);

  return (
    <div id="check" style={{ scrollMarginTop: 90 }}>
      <form onSubmit={run}>
        <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", maxWidth: 470 }}>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Your website address" aria-label="Your website" style={field} />
          <button type="submit" className="btn-amber" disabled={busy} style={{ borderRadius: 0, padding: "14px 18px", whiteSpace: "nowrap" }}>
            {busy ? "Checking…" : "Check my website ↗"}
          </button>
        </div>

        {needMore && !result && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, maxWidth: 470 }}>
            <input value={businessName} onChange={(e) => setName(e.target.value)} placeholder="Business name" aria-label="Business name" style={{ ...boxed, flex: "1 1 190px" }} />
            <input value={businessType} onChange={(e) => setType(e.target.value)} placeholder="What you do — e.g. dentist" aria-label="Type of business" required style={{ ...boxed, flex: "1 1 190px" }} />
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Where — e.g. Croydon" aria-label="Your area" required style={{ ...boxed, flex: "1 1 140px" }} />
            <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode (optional)" aria-label="Postcode" style={{ ...boxed, flex: "1 1 120px" }} />
          </div>
        )}
      </form>

      <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "10px 0 0" }}>
        {needMore && !result ? "A few details and we'll ask an AI assistant five different ways." : "Start with a free AI visibility check."}
      </p>

      {busy && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 10 }}>
          Running five live searches and scanning your site — about 20 seconds.
        </p>
      )}
      {err && <p style={{ fontSize: 13.5, color: "#9a2a2a", marginTop: 10 }}>{err}</p>}

      {result && (
        <div style={{ marginTop: 18, background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 20, maxWidth: 580 }}>
          {/* mentions */}
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>We asked an AI assistant five different ways:</p>
          <p style={{ margin: "6px 0 0", fontSize: 21, fontWeight: 700, color: result.mentionCount > 0 ? "#1f6b36" : "#9a5a12" }}>
            Mentioned in {result.mentionCount} of {result.queriesRun}
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {result.queries.map((q) => (
              <li key={q.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--ink-2)" }}>
                <span aria-hidden style={{ width: 16 }}>{q.available ? (q.found ? "✅" : "❌") : "—"}</span>
                <span>{q.label}</span>
                {!q.available && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>(could not run)</span>}
              </li>
            ))}
          </ul>

          {result.competitors.length > 0 && (
            <>
              <p style={{ margin: "16px 0 6px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                Named instead
              </p>
              <ul style={{ display: "flex", flexWrap: "wrap", gap: 7, listStyle: "none", padding: 0, margin: 0 }}>
                {result.competitors.map((c) => (
                  <li key={c} style={{ border: "1px solid var(--line)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, color: "var(--ink-2)" }}>{c}</li>
                ))}
              </ul>
            </>
          )}

          {/* readiness */}
          {result.scan && !result.scan.reachable && (
            <p style={{ marginTop: 18, fontSize: 13.5, color: "var(--ink-2)" }}>
              We could not reach {result.scan.url ?? "your website"}, so the readiness checks were not run.
            </p>
          )}

          {result.scan?.reachable && (
            <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)" }}>
                  {result.scan.score}<span style={{ fontSize: 15, color: "var(--ink-3)" }}>/{result.scan.maxScore}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>AI readiness</span>
                <button
                  type="button"
                  onClick={() => setShowWeights((v) => !v)}
                  aria-expanded={showWeights}
                  style={{ background: "none", border: "1px solid var(--line)", borderRadius: 999, width: 19, height: 19, fontSize: 11, cursor: "pointer", color: "var(--ink-2)", lineHeight: 1 }}
                >
                  ?
                </button>
              </div>

              {showWeights && (
                <div style={{ marginTop: 10, background: "var(--warm-alt)", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>How the score is worked out</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
                    {checks.map((c) => (
                      <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "var(--ink-2)" }}>
                        <span>{c.label}</span><span style={{ whiteSpace: "nowrap" }}>{c.weight} pts</span>
                      </li>
                    ))}
                  </ul>
                  <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--ink-3)" }}>
                    Every point comes from a live check of your own site. Whether an assistant mentions you is
                    reported separately above — you do not control that, so it is not folded into this number.
                  </p>
                </div>
              )}

              <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {visible.map((c) => (
                  <li key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span aria-hidden style={{ width: 18, flexShrink: 0 }}>{c.pass ? "✅" : "❌"}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{c.label}</span>
                      <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)", marginTop: 2 }}>{c.detail}</span>
                      {!c.pass && (
                        <a href="#packages" style={{ display: "inline-block", marginTop: 5, fontSize: 12.5, fontWeight: 600, color: "#B8841A" }}>
                          We fix this →
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {hidden > 0 && !unlocked && (
                <form onSubmit={unlock} style={{ marginTop: 16, background: "var(--warm-alt)", borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {hidden} more {hidden === 1 ? "check" : "checks"} in the full report
                  </p>
                  <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--ink-2)" }}>
                    Enter your email and we&apos;ll unlock the rest here and send you the whole thing.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourbusiness.co.uk" aria-label="Your email"
                      style={{ ...boxed, flex: "1 1 200px" }}
                    />
                    <button type="submit" className="btn-amber" disabled={sending} style={{ padding: "12px 18px" }}>
                      {sending ? "Sending…" : "Unlock full report"}
                    </button>
                  </div>
                  <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      aria-label="Email me tips and offers from BiLabs"
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: "var(--brand)" }}
                    />
                    <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
                      Email me tips and offers from BiLabs. Unsubscribe any time — your report is sent either way.
                    </span>
                  </label>
                  {mailErr && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#9a2a2a" }}>{mailErr}</p>}
                </form>
              )}

              {unlocked && (
                <p style={{ marginTop: 14, fontSize: 13, color: "#1f6b36", fontWeight: 600 }}>
                  Sent — the full report is on its way to {email}.
                </p>
              )}
            </div>
          )}

          <p style={{ marginTop: 18, fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
            Five questions, one AI assistant, one moment in time — not a ranking, and not a measurement of ChatGPT
            specifically. Ask again tomorrow and the answers can differ. The readiness checks are live fetches of
            your own site and will stay the same until you change it.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <a href="#packages" className="btn-amber" style={{ padding: "11px 18px", fontSize: 14 }}>Fix this for me →</a>
            <a href="/contact" className="btn-line" style={{ padding: "11px 18px", fontSize: 14 }}>Talk to us</a>
          </div>
        </div>
      )}
    </div>
  );
}
