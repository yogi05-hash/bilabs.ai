"use client";

import { useState } from "react";
import FadeIn from "@/components/FadeIn";
import ScrubVideo from "@/components/ScrubVideo";
import HeroCheck from "@/components/HeroCheck";
import { GuideProvider, useGuide } from "@/components/AIGuide";
import { PACKAGES } from "@/lib/packages";

/* ------------------------------------------------------------------ *
 *  BiLabs homepage, built to the supplied mockup.
 *
 *  Two things are deliberately ours rather than the mockup's: the
 *  packages carry real prices and a working checkout instead of
 *  "Discuss your needs", and nowhere on this page promises that an AI
 *  will recommend anyone. The dark band and the FAQ both say the
 *  opposite, in as many words.
 * ------------------------------------------------------------------ */

const BOOK = "/contact";

export default function Home() {
  return (
    <GuideProvider>
      <Hero />
      <TrustStrip />
      <Problem />
      <Capabilities />
      <ClearerInfo />
      <Conversation />
      <Steps />
      <Packages />
      <Faq />
      <Closing />
    </GuideProvider>
  );
}

/* ------------------------------- hero ------------------------------ */

function Hero() {
  return (
    <section className="hero-warm hero-full">
      {/* Full-bleed clip, still scrubbed by the mouse rather than played.
          No controls attribute — if you see playback controls, the browser
          has been told to show them. */}
      <div className="hero-video">
        <ScrubVideo src="/hero.mp4" />
      </div>
      <div className="hero-scrim" aria-hidden />

      <div className="wrap hero-copy-full">
        <FadeIn>
          <div style={{ maxWidth: 560 }}>
            <h1
              style={{
                fontSize: "clamp(2.4rem, 6vw, 4rem)",
                lineHeight: 1.03,
                letterSpacing: "-0.04em",
                fontWeight: 700,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Get your business recommended by <span style={{ color: "var(--brand)" }}>AI</span>.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--ink)", margin: "18px 0 0", maxWidth: 470, fontWeight: 500 }}>
              Customers now ask ChatGPT, Claude and Google AI who to call.
            </p>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "10px 0 26px", maxWidth: 460 }}>
              We publish your business so they can read it — and answer every enquiry that follows, 24/7.
            </p>
            <HeroCheck />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* --------------------------- trust strip --------------------------- */

function TrustStrip() {
  const items = [
    { label: "Be understood", d: "M11 19a8 8 0 1 1 5.66-2.34L21 21" },
    { label: "Answer enquiries", d: "M21 11.5a8.4 8.4 0 0 1-9 8.3 9.9 9.9 0 0 1-2.6-.34L4 21l1.2-3.3A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" },
    { label: "Save time", d: "M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  ];
  return (
    <section className="strip">
      <div className="wrap">
        <div className="strip-row">
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>
            Built for the way customers discover, ask and buy.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px" }}>
            {items.map((i) => (
              <span key={i.label} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink-2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                  <path d={i.d} />
                </svg>
                {i.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- problem ----------------------------- */

function Problem() {
  const guide = useGuide();
  const cards = [
    { t: "The question changed", d: "“Who's a good plumber near me?” used to open a search page. Now it gets answered — once, by an assistant, with a handful of names." },
    { t: "You are not in the answer", d: "Assistants answer from what they can read. If your hours, services and prices only exist as pictures on a website, you are invisible to them." },
    { t: "The enquiry still has to be answered", d: "Being named is worth nothing if the call goes to voicemail at 7pm. Most enquiries now arrive outside the hours anyone is at a desk." },
  ];
  return (
    <section id="problem" className="sec" style={{ scrollMarginTop: 80 }}>
      <div className="wrap">
        <FadeIn>
          <h2 className="h2">Your customers stopped scrolling.</h2>
          <p className="body" style={{ maxWidth: 620, marginTop: 12 }}>
            They ask, and they act on the answer. Which makes one question worth knowing the answer to: what do these
            systems currently say about you?
          </p>
        </FadeIn>
        <div className="grid grid-3" style={{ marginTop: 32 }}>
          {cards.map((c, i) => (
            <FadeIn key={c.t} delay={i * 0.07}>
              <button type="button" onClick={() => guide.open("problem")} className="card clickable" style={{ height: "100%" }}>
                <h3 className="h3">{c.t}</h3>
                <p className="body">{c.d}</p>
                <span className="ask-hint">Ask about this →</span>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- capabilities -------------------------- */

function Skel({ kind }: { kind: string }) {
  if (kind === "chart")
    return (
      <div className="skel" style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, minHeight: 96 }}>
        {[34, 52, 70, 44].map((h, i) => (
          <span key={i} className={i > 1 ? "amber" : ""} style={{ width: 14, height: h, borderRadius: 4 }} />
        ))}
      </div>
    );
  if (kind === "doc")
    return (
      <div className="skel">
        <span style={{ width: "86%" }} /><span style={{ width: "62%" }} /><span style={{ width: "74%" }} />
        <span style={{ width: "48%", height: 26, borderRadius: 6, background: "rgba(17,17,18,.18)" }} />
      </div>
    );
  if (kind === "chat")
    return (
      <div className="skel" style={{ alignItems: "flex-end" }}>
        <span style={{ width: "70%", height: 22, borderRadius: 8, alignSelf: "flex-start" }} />
        <span className="amber" style={{ width: "56%", height: 22, borderRadius: 8 }} />
        <span style={{ width: "44%", height: 10, borderRadius: 6, alignSelf: "flex-start" }} />
      </div>
    );
  if (kind === "form")
    return (
      <div className="skel">
        <span style={{ width: "100%", height: 14, borderRadius: 5 }} />
        <span style={{ width: "100%", height: 14, borderRadius: 5 }} />
        <span className="amber" style={{ width: "46%", height: 16, borderRadius: 6, alignSelf: "center" }} />
      </div>
    );
  if (kind === "nodes")
    return (
      <div className="skel" style={{ alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 20, borderRadius: 5, background: "rgba(17,17,18,.18)" }} />
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => <span key={i} className={i === 1 ? "amber" : ""} style={{ width: 20, height: 20, borderRadius: 5 }} />)}
        </div>
      </div>
    );
  return (
    <div className="skel" style={{ justifyContent: "flex-end" }}>
      <svg viewBox="0 0 120 50" style={{ width: "100%", height: 48 }} aria-hidden>
        <polyline points="4,44 28,34 52,38 76,20 104,8" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ width: "70%" }} />
    </div>
  );
}

const CAPS = [
  { t: "AI visibility audit", d: "Find gaps in how your business is presented online.", k: "chart", ctx: "audit" },
  { t: "AI-ready business information", d: "Make your products, services and FAQs clear and accessible.", k: "doc", ctx: "get-found" },
  { t: "Website AI receptionist", d: "Answer common questions using your business information.", k: "chat", ctx: "front-desk" },
  { t: "Enquiry capture", d: "Collect customer details and route enquiries to your team.", k: "form", ctx: "front-desk" },
  { t: "Connected workflows", d: "Connect forms, email and business tools.", k: "nodes", ctx: "front-desk" },
  { t: "Ongoing improvements", d: "Keep information current and refine what works.", k: "line", ctx: "get-found" },
];

function Capabilities() {
  const guide = useGuide();
  return (
    <section id="services" className="sec" style={{ background: "var(--warm-alt)", scrollMarginTop: 80 }}>
      <div className="wrap">
        <FadeIn><h2 className="h2">Practical AI. Real business purpose.</h2></FadeIn>
        <div className="grid grid-3" style={{ marginTop: 32 }}>
          {CAPS.map((c, i) => (
            <FadeIn key={c.t} delay={i * 0.05}>
              <button type="button" onClick={() => guide.open(c.ctx)} className="card clickable" style={{ height: "100%" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "center", width: "100%" }}>
                  <div>
                    <h3 className="h3" style={{ fontSize: 15.5 }}>{c.t}</h3>
                    <p className="body" style={{ fontSize: 13.5, marginTop: 6 }}>{c.d}</p>
                  </div>
                  <Skel kind={c.k} />
                </div>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------- clearer information ----------------------- */

function ClearerInfo() {
  const guide = useGuide();
  const rows = [
    { label: "Services", w: ["78%", "54%"] },
    { label: "Location", w: ["62%", "40%"] },
    { label: "Opening hours", w: ["70%", "48%"] },
    { label: "FAQs", w: ["84%", "58%"] },
  ];
  return (
    <section style={{ background: "#0A0A0A" }}>
      <div className="wrap sec">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 44, alignItems: "center" }}>
          <FadeIn>
            <h2 className="h2" style={{ color: "#fff" }}>
              Give AI clearer <span style={{ color: "var(--brand)" }}>information.</span>
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "rgba(255,255,255,.64)", marginTop: 14, maxWidth: 400 }}>
              We help organise and publish your business information so supported AI systems can access it.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 0", display: "flex", flexDirection: "column", gap: 13 }}>
              {["Clear service and product pages", "Structured business information", "Crawler access checks"].map((t) => (
                <li key={t} style={{ display: "flex", gap: 11, alignItems: "center", fontSize: 14.5, color: "rgba(255,255,255,.9)" }}>
                  <span className="tick">✓</span>{t}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => guide.open("get-found")} className="btn-line" style={{ marginTop: 24 }}>
              How this works →
            </button>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div>
              <div style={{ background: "#FAF8F3", borderRadius: 14, padding: "18px 20px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Your business profile</p>
                {rows.map((r) => (
                  <div key={r.label} className="profile-row">
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", width: 100, flexShrink: 0 }}>{r.label}</span>
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                      {r.w.map((w, i) => <span key={i} className="profile-bar" style={{ width: w }} />)}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 12, textAlign: "center", color: "rgba(255,255,255,.42)" }}>
                Access does not guarantee indexing or recommendations.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- conversation -------------------------- */

function Conversation() {
  const guide = useGuide();
  const points = [
    { t: "Answers from your business information", d: "Accurate, helpful answers using your products, services and FAQs." },
    { t: "Captures enquiries", d: "Collects customer details when needed and qualifies conversations." },
    { t: "Hands details to your team", d: "Sends enquiries to your team and your existing tools." },
  ];
  return (
    <section className="sec">
      <div className="wrap">
        <FadeIn>
          <h2 className="h2" style={{ maxWidth: 520 }}>
            An assistant that keeps the <span style={{ color: "var(--brand)" }}>conversation going</span>.
          </h2>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 36, marginTop: 32, alignItems: "center" }}>
          <FadeIn>
            <div className="card" style={{ background: "var(--warm-alt)", padding: 20 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>Example conversation</p>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 14 }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(17,17,18,.12)", flexShrink: 0 }} />
                <p style={{ margin: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "9px 13px", fontSize: 13.5, color: "var(--ink)" }}>
                  Do you offer consultations?
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, background: "var(--ink)", flexShrink: 0 }} />
                <p style={{ margin: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "9px 13px", fontSize: 13.5, color: "var(--ink)" }}>
                  Yes. What would you like help with?
                </p>
              </div>

              <div style={{ display: "flex", gap: 4, marginTop: 10, marginLeft: 35 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(17,17,18,.25)" }} />)}
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginTop: 18, background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 13 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--brand)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a1205" strokeWidth="1.8" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>New enquiry received</p>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>2 min ago</span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
                    Name: Alex Morgan<br />Enquiry: I&apos;d like to book a consultation…
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {points.map((p) => (
                <button key={p.t} type="button" onClick={() => guide.open("front-desk")} style={{ display: "flex", gap: 14, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 999, background: "var(--warm-alt)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.7" aria-hidden>
                      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 9.9 9.9 0 0 1-2.6-.34L4 21l1.2-3.3A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
                    </svg>
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{p.t}</span>
                    <span style={{ display: "block", fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 4 }}>{p.d}</span>
                  </span>
                </button>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ steps ------------------------------ */

const STEPS = [
  { n: "01", t: "Audit", d: "We ask the assistants your customers ask, and write down what they say about you." },
  { n: "02", t: "Fix", d: "We publish your services, hours and prices where AI systems can fetch them." },
  { n: "03", t: "Answer", d: "An assistant picks up every enquiry that arrives, and emails you the lead." },
];

function Steps() {
  const guide = useGuide();
  return (
    <section id="process" className="sec" style={{ background: "var(--warm-alt)", scrollMarginTop: 80 }}>
      <div className="wrap">
        <FadeIn><h2 className="h2">From your website to a working system.</h2></FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 0, marginTop: 30 }}>
          {STEPS.map((s, i) => (
            <FadeIn key={s.n} delay={i * 0.07}>
              <button
                type="button"
                onClick={() => guide.open("how-it-works")}
                style={{
                  display: "flex", gap: 16, alignItems: "flex-start", background: "none", border: "none",
                  borderLeft: i === 0 ? "none" : "1px solid var(--line)",
                  padding: i === 0 ? "10px 24px 10px 0" : "10px 24px", textAlign: "left", cursor: "pointer", width: "100%",
                }}
              >
                <span className="step-num">{s.n}</span>
                <span>
                  <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{s.t}</span>
                  <span style={{ display: "block", fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 4 }}>{s.d}</span>
                </span>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- packages ----------------------------- */

function Packages() {
  const guide = useGuide();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const start = async (plan: string) => {
    if (busy) return;
    setBusy(plan); setErr(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setErr(data.error ?? "Could not start checkout."); return; }
      window.location.href = data.url;
    } catch {
      setErr("Could not start checkout. Please email hello@bilabs.ai.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="packages" className="sec" style={{ scrollMarginTop: 80 }}>
      <div className="wrap">
        <FadeIn><h2 className="h2">Start where you need us.</h2></FadeIn>
        {err && <p style={{ marginTop: 14, color: "#9a2a2a", fontSize: 14 }}>{err}</p>}

        <div className="grid grid-3" style={{ marginTop: 28, alignItems: "stretch" }}>
          {PACKAGES.map((p, i) => (
            <FadeIn key={p.id} delay={i * 0.07}>
              <div
                className="card"
                style={{
                  height: "100%",
                  position: "relative",
                  background: p.featured ? "rgba(245,183,49,.1)" : "#fff",
                  borderColor: p.featured ? "rgba(245,183,49,.55)" : "var(--line)",
                }}
              >
                {p.featured && (
                  <span style={{
                    position: "absolute", top: -11, left: 22, fontSize: 10.5, fontWeight: 700,
                    letterSpacing: ".12em", textTransform: "uppercase", color: "#1a1205",
                    background: "var(--brand)", borderRadius: 999, padding: "4px 11px",
                  }}>
                    Most popular
                  </span>
                )}

                <button type="button" onClick={() => guide.open(p.id === "free" ? "report" : p.id)} className="ask-card" style={{ background: "none", border: "none", padding: 0, flex: 1, display: "flex", flexDirection: "column", cursor: "pointer" }}>
                  <h3 className="h3">{p.name}</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{p.blurb}</p>
                  <p style={{ margin: "14px 0 0" }}>
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)" }}>{p.price}</span>
                    {p.sub && <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>{p.sub}</span>}
                  </p>

                  {p.offer && (
                    <span style={{
                      display: "inline-block", marginTop: 10, alignSelf: "flex-start",
                      fontSize: 11.5, fontWeight: 600, color: "#7a5a0d",
                      background: "rgba(245,183,49,.24)", border: "1px solid rgba(245,183,49,.5)",
                      borderRadius: 999, padding: "4px 10px",
                    }}>
                      First month £1 — first 10 businesses
                    </span>
                  )}

                  <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                    {p.points.map((pt) => (
                      <li key={pt} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                        <span className="tick" style={{ width: 17, height: 17, fontSize: 10 }}>✓</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="ask-hint" style={{ fontSize: 12.5 }}>Is this the right one? →</span>
                </button>

                {p.cta === "checkout" ? (
                  <button type="button" onClick={() => start(p.id)} disabled={busy !== null} className={p.featured ? "btn-amber" : "btn-line"} style={{ marginTop: 16, width: "100%", opacity: busy ? 0.6 : 1 }}>
                    {busy === p.id ? "Opening checkout…" : p.ctaLabel}
                  </button>
                ) : (
                  <a href={p.href} className="btn-line" style={{ marginTop: 16, width: "100%" }}>{p.ctaLabel}</a>
                )}
              </div>
            </FadeIn>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 22 }}>
          <a href={BOOK} className="btn-line" style={{ padding: "11px 20px", fontSize: 14 }}>Questions? Talk to us</a>
          <a
            href="https://yourbotchat.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13.5, color: "var(--ink-2)", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Prefer to do it yourself? Try YourBotChat from £29/month →
          </a>
        </div>

        <p style={{ marginTop: 16, fontSize: 12.5, color: "var(--ink-3)", maxWidth: 680, lineHeight: 1.65 }}>
          Prices in GBP. Cancel anytime. We make your business readable to AI — no one can guarantee recommendations.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- faq ------------------------------- */

const FAQS = [
  { q: "Will this guarantee AI recommendations?", a: "No. We improve access and clarity; each platform decides what it indexes and recommends. What we control is whether your business is readable — accurate, structured, current, and published where these systems look. Anyone promising you a guaranteed AI ranking is guessing." },
  { q: "What do I actually get each month?", a: "On Get Found by AI (£49/month): your profile and schema built from your real services, hours and prices, published where AI systems can read it, kept current as things change, and a monthly report on what the assistants are saying. AI Front Desk (£99/month) adds the receptionist that answers enquiries on your site, a link and a QR code, and emails each one to you." },
  { q: "What is the £1 first month?", a: "The first ten businesses to sign up pay £1 for their first month instead of £49 or £99, then the normal price from month two. It is applied automatically at checkout while places remain — you do not need a code. Cancel before the second month and £1 is all you ever pay." },
  { q: "Can you work with my existing website?", a: "Yes. Nothing here requires a rebuild. We work with the site you have — reading it, structuring what it already says, and adding the assistant to it. If your site is thin, we will tell you which gaps matter." },
  { q: "How is this different from SEO?", a: "SEO is about ranking a page in a list of links. This is about whether an assistant answering a spoken question has accurate facts about you to draw on. They overlap — both reward clear, structured, honest information — but the output is an answer, not a results page." },
  { q: "What happens after my free check?", a: "Nothing automatic. The result is yours to read, and you decide whether to act on it. If you want to, the audit goes deeper, and the other two packages fix and then answer. No one will chase you." },
  { q: "How long does it take?", a: "The audit is back within a few working days. Get Found by AI is usually live within two weeks, depending on how quickly we can agree your services and prices. The AI Front Desk adds a few days for the assistant to be set up and tested." },
  { q: "Does the assistant make things up?", a: "It answers only from facts you have given it. If it has not been told a price, it says it will check rather than inventing one, and it never confirms a booking itself — it shares your booking link or takes details for you to confirm." },
];

function Faq() {
  const guide = useGuide();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sec" style={{ background: "var(--warm-alt)" }}>
      <div className="wrap" style={{ maxWidth: 840 }}>
        <FadeIn><h2 className="h2">A few good questions.</h2></FadeIn>
        <div style={{ marginTop: 26 }}>
          {FAQS.map((f, i) => (
            <div key={f.q} className="faq-item">
              <button className="faq-q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span>{f.q}</span>
                <span style={{ color: "var(--ink-3)", fontSize: 18, transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>⌄</span>
              </button>
              {open === i && <p className="faq-a">{f.a}</p>}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => guide.open("faq")} className="btn-line" style={{ marginTop: 20 }}>
          Ask your own question
        </button>
      </div>
    </section>
  );
}

/* ----------------------------- closing ----------------------------- */

function Closing() {
  return (
    <section style={{ background: "var(--brand)" }}>
      <div className="wrap" style={{ paddingTop: 54, paddingBottom: 54 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.3rem)", lineHeight: 1.12, letterSpacing: "-0.03em", fontWeight: 700, margin: 0, color: "#1a1205", maxWidth: 420 }}>
            Let&apos;s make AI useful for your business.
          </h2>
          <a href="#check" className="btn-ink" style={{ background: "#fff", color: "var(--ink)", borderColor: "#fff", padding: "15px 28px" }}>
            Start with a free check ↗
          </a>
        </div>
      </div>
    </section>
  );
}
