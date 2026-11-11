"use client";

import { useEffect, useState } from "react";
import { rememberEvaluation, track } from "@/components/Track";
import { startCheckout } from "@/lib/checkoutClient";
import { HONESTY_LINE } from "@/lib/site";

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
  /** set by the server so later events attach to this specific run */
  evaluationId?: string | null;
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
  // ?site=&src= links (nurture emails, ads) prefill the form and attribute
  // the run. window.location on mount, so no Suspense boundary is needed.
  const [entrySource, setEntrySource] = useState<string | null>(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const site = q.get("site");
      const src = q.get("src");
      if (site) setWebsite(site.slice(0, 160));
      if (src) setEntrySource(src.slice(0, 60));
    } catch { /* malformed query string — ignore */ }
  }, []);
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
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  const fix = async () => {
    if (paying) return;
    setPaying(true); setPayErr(null);
    const r = await startCheckout("get-found");
    if (!r.ok) { setPayErr(r.error); setPaying(false); }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!businessType.trim() || !area.trim()) { setNeedMore(true); return; }

    setBusy(true); setErr(null); setResult(null); setUnlocked(false);
    try {
      const res = await fetch("/api/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: businessName || website, website, businessType, area, postcode, entrySource }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "The check could not run just now."); return; }
      setResult(data);
      // remembered so a checkout started anywhere on the page ties back to
      // this run, and the paid profile is pre-filled from it
      rememberEvaluation(data.evaluationId ?? null);
      // the full result is now on screen — count the report view against
      // this specific run rather than as a bare page event
      track("report_viewed", { evaluationId: data.evaluationId ?? null });
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
        body: JSON.stringify({
          email, phone: null, report: result, businessType, area, marketingConsent: consent,
          evaluationId: result.evaluationId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMailErr(data.error ?? "Could not send that just now."); return; }
      setUnlocked(true);
      rememberEvaluation(result.evaluationId ?? null, email);
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

          {/* Who the assistant named instead is the most motivating thing a
              check finds, so it is the thing the email unlocks. Before the
              unlock, only the COUNT is shown — a fact, not the detail. */}
          {result.competitors.length > 0 && unlocked && (
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
          {result.competitors.length > 0 && !unlocked && (
            <p style={{ margin: "16px 0 0", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
              {result.competitors.length} business{result.competitors.length === 1 ? " was" : "es were"} named instead
              of you. Unlock the full report below to see who.
            </p>
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

            </div>
          )}

          {/* The unlock lives outside the readiness block on purpose: a site
              we could not reach still has competitors worth seeing, and the
              email is the only way the report — and the pay link — reach them. */}
          {!unlocked && (
            <form onSubmit={unlock} style={{ marginTop: 16, background: "var(--warm-alt)", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                {result.competitors.length > 0
                  ? `See who AI recommends instead of you${hidden > 0 ? `, plus ${hidden} more ${hidden === 1 ? "check" : "checks"}` : ""}`
                  : hidden > 0
                    ? `${hidden} more ${hidden === 1 ? "check" : "checks"} in the full report`
                    : "Get this result by email, with every answer in full"}
              </p>
              <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--ink-2)" }}>
                Enter your email and we&apos;ll unlock the rest here and send you the whole report.
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

          <p style={{ marginTop: 18, fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
            Five questions, one AI assistant, one moment in time — not a ranking, and not a measurement of ChatGPT
            specifically. Ask again tomorrow and the answers can differ. The readiness checks are live fetches of
            your own site and will stay the same until you change it.
          </p>

          {/* The paid step, right where the result is. Mentioned in two or
              fewer is a problem to fix; more is a position to keep. */}
          <div style={{ marginTop: 16, background: "var(--warm-alt)", borderRadius: 12, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {result.mentionCount <= 2 ? "Get found by AI — £49/month, cancel anytime" : "Keep it that way — £49/month, cancel anytime"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
              We publish your profile where AI web search can read it, then ask ChatGPT, Claude, Gemini and Grok every
              month and send you what they say. Set-up takes five minutes.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={fix} disabled={paying} className="btn-amber" style={{ padding: "11px 18px", fontSize: 14, opacity: paying ? 0.6 : 1 }}>
                {paying ? "Opening checkout…" : result.mentionCount <= 2 ? "Fix this for £49/mo →" : "Keep it that way — £49/mo →"}
              </button>
            </div>
            {payErr && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#9a2a2a" }}>{payErr}</p>}
            <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{HONESTY_LINE}</p>
          </div>
        </div>
      )}
    </div>
  );
}
