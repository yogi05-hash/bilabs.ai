"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/checkoutClient";
import FadeIn from "@/components/FadeIn";
import HeroCheck from "@/components/HeroCheck";
import Pulse from "@/components/Pulse";
import { GuideProvider, useGuide } from "@/components/AIGuide";
import { PACKAGES } from "@/lib/packages";
import { faqJsonLd, HONESTY_LINE } from "@/lib/site";

/* ------------------------------------------------------------------ *
 *  BiLabs homepage.
 *
 *  One job: a visitor who has never heard of us should know what to do
 *  within the first screen, and be able to do it without reading anything
 *  else. So the page is the product's own sequence, top to bottom —
 *  check → pay → published and measured — with the check itself in the
 *  hero, live activity under it, and nothing that needs a salesperson.
 *
 *  Nowhere on this page promises that an AI will recommend anyone. The
 *  honesty line is printed where the money is asked for.
 * ------------------------------------------------------------------ */

export default function Home() {
  return (
    <GuideProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }}
      />
      <Hero />
      <Pulse />
      <HowItWorks />
      <WhatYouGet />
      <Packages />
      <Faq />
      <Closing />
    </GuideProvider>
  );
}

/* ------------------------------- hero ------------------------------ */

const QUICK = [
  { n: "1", t: "Free check", d: "20 seconds. No card." },
  { n: "2", t: "Start for £49/month", d: "Five-minute setup, pre-filled from your check." },
  { n: "3", t: "We do the rest", d: "Published today, checked monthly, emailed to you." },
];

/* The example answer beside the form: the problem, drawn once, before the
 * visitor has typed anything. Plainly labelled as an example. */
const EXAMPLE_NAMES = ["Northside Plumbing & Heating", "Headingley Gas Services", "Aire Valley Plumbers"];

function AnswerCard() {
  return (
    <div aria-hidden style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 18, padding: 22, boxShadow: "0 24px 60px -30px rgba(17,17,18,.35)", maxWidth: 440, marginLeft: "auto" }}>
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-3)" }}>Example · what an assistant answers</p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <p style={{ margin: 0, background: "var(--warm-alt)", borderRadius: "14px 14px 4px 14px", padding: "10px 14px", fontSize: 14, color: "var(--ink)", maxWidth: 300 }}>
          Recommend a plumber near me in Leeds
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-start" }}>
        <span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>AI</span>
        <div style={{ background: "#FAF8F3", border: "1px solid var(--line)", borderRadius: "4px 14px 14px 14px", padding: "12px 14px", fontSize: 13.5, color: "var(--ink)", flex: 1 }}>
          <p style={{ margin: 0, color: "var(--ink-2)" }}>Here are three well-reviewed plumbers in Leeds:</p>
          <ol style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
            {EXAMPLE_NAMES.map((n) => (
              <li key={n}><strong>{n}</strong></li>
            ))}
          </ol>
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: "1px dashed var(--line)", paddingTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: "#c7791a", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink)" }}>
          <strong>Your business:</strong> not mentioned. <span style={{ color: "var(--ink-2)" }}>The free check shows you this for your trade and your area.</span>
        </p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-warm">
      <div className="wrap" style={{ paddingTop: 112, paddingBottom: 44 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "36px 48px", alignItems: "center" }}>
          <FadeIn>
            <div style={{ maxWidth: 620 }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink-2)" }}>
                Step 1 of 3 · free · 20 seconds
              </p>
              <h1
                style={{
                  fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.04em",
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--ink)",
                }}
              >
                Does <span style={{ color: "var(--brand)" }}>AI</span> recommend your business? Find out now.
              </h1>
              <p style={{ fontSize: 16.5, lineHeight: 1.55, color: "var(--ink)", margin: "16px 0 0", maxWidth: 540, fontWeight: 500 }}>
                Type your website. We ask an AI assistant the way your customers do and show you the answer — and who it
                named instead.
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "8px 0 22px", maxWidth: 520 }}>
                Not in the answer? One click fixes it: £49/month publishes you where AI search reads, live the same day.
                Cancel anytime.
              </p>
              <HeroCheck />

              <ol style={{ listStyle: "none", padding: 0, margin: "26px 0 0", display: "flex", flexWrap: "wrap", gap: "10px 22px" }}>
                {QUICK.map((s) => (
                  <li key={s.n} style={{ display: "flex", gap: 9, alignItems: "flex-start", minWidth: 150, flex: "1 1 150px" }}>
                    <span className="step-num" style={{ fontSize: 12 }}>{s.n}</span>
                    <span>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{s.t}</span>
                      <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{s.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </FadeIn>
          <div className="hero-answer">
            <FadeIn delay={0.1}>
              <AnswerCard />
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- how it works -------------------------- */

const STEPS = [
  {
    n: "01",
    t: "Run the free check",
    you: "You: 20 seconds",
    d: "We ask an AI assistant five different ways — “recommend a plumber in Leeds”, “best value”, “urgent, today” — with live web search, and show you whether you were named and who was. The full report is emailed to you.",
  },
  {
    n: "02",
    t: "Start for £49/month",
    you: "You: five minutes",
    d: "Pay, then confirm your business, tick the assistants you care about, and add your services, hours, prices and FAQ. The check already filled in most of it. Press Publish.",
  },
  {
    n: "03",
    t: "We take it from there",
    you: "You: nothing",
    d: "Your profile goes up at bilabs.ai/your-name with structured data, the search index is told, and you get snippets for your own site. ChatGPT, Claude, Gemini and Grok are asked within minutes — then every month, with the report in your inbox. If anything stalls, we email you; if you stop halfway, we remind you.",
  },
];

function HowItWorks() {
  const guide = useGuide();
  return (
    <section id="process" className="sec" style={{ background: "var(--warm-alt)", scrollMarginTop: 80 }}>
      <div className="wrap">
        <FadeIn>
          <h2 className="h2">Three steps. Two are yours, and they take six minutes.</h2>
          <p className="body" style={{ maxWidth: 620, marginTop: 12 }}>
            Customers now ask ChatGPT, Claude and Google&apos;s AI who to call, and act on the answer. Assistants answer from
            what they can read. This makes you readable — and tells you, every month, whether it worked.
          </p>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 30 }}>
          {STEPS.map((s, i) => (
            <FadeIn key={s.n} delay={i * 0.07}>
              <button type="button" onClick={() => guide.open("how-it-works")} className="card clickable" style={{ height: "100%", alignItems: "flex-start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <span className="step-num">{s.n}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: i === 2 ? "#1f6b36" : "var(--ink-3)" }}>{s.you}</span>
                </div>
                <h3 className="h3" style={{ marginTop: 12 }}>{s.t}</h3>
                <p className="body" style={{ fontSize: 14 }}>{s.d}</p>
                <span className="ask-hint">Ask about this →</span>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- what you get ---------------------------- */

const EXAMPLE_ROWS = [
  { a: "ChatGPT", f: 2 },
  { a: "Claude", f: 3 },
  { a: "Gemini", f: 3 },
  { a: "Grok", f: 1 },
];

function WhatYouGet() {
  return (
    <section style={{ background: "#0A0A0A" }}>
      <div className="wrap sec">
        <FadeIn>
          <h2 className="h2" style={{ color: "#fff" }}>
            What you get, from the day you <span style={{ color: "var(--brand)" }}>publish</span>.
          </h2>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 24, marginTop: 28, alignItems: "stretch" }}>
          <FadeIn>
            <div style={{ background: "#FAF8F3", borderRadius: 14, padding: "20px 22px", height: "100%", display: "flex", flexDirection: "column" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>Your public profile</p>
              <p style={{ margin: "8px 0 0", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>bilabs.ai/b/your-business</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {[
                  "Services, prices, hours, areas, FAQ — as plain text and as schema.org data assistants parse",
                  "A machine-readable llms.txt and a sitemap entry, pinged to the search index on publish",
                  "Copy-paste snippets so your own website says the same, where assistants look first",
                ].map((t) => (
                  <li key={t} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    <span className="tick" style={{ width: 17, height: 17, fontSize: 10, flexShrink: 0 }}>✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <a href="/b/harbour-lane-dental-demo" target="_blank" rel="noopener noreferrer" className="btn-line" style={{ marginTop: 18, alignSelf: "flex-start", padding: "10px 18px", fontSize: 14 }}>
                See a live example profile →
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div style={{ background: "#FAF8F3", borderRadius: 14, padding: "20px 22px", height: "100%", display: "flex", flexDirection: "column" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>Your monthly report · example</p>
              <p style={{ margin: "8px 0 0", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>Named in 9 of 20 answers this month</p>
              <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12, fontSize: 14 }}>
                <tbody>
                  {EXAMPLE_ROWS.map((r) => (
                    <tr key={r.a} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 0", fontWeight: 600, color: "var(--ink)" }}>{r.a}</td>
                      <td style={{ padding: "8px 0", color: "var(--ink-2)" }}>named you in {r.f} of 5</td>
                      <td style={{ padding: "8px 0", textAlign: "right", letterSpacing: 2 }} aria-hidden>
                        {"●".repeat(r.f)}<span style={{ color: "rgba(17,17,18,.2)" }}>{"●".repeat(5 - r.f)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)", flex: 1 }}>
                Every answer in full, who was named instead, and a short <strong>do this next</strong> list — for example that we
                could not yet find the snippets on your own site. Same thing in your dashboard, with the history.
              </p>
              <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--ink-3)" }}>Illustrative numbers. Yours start from your first check.</p>
            </div>
          </FadeIn>
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "rgba(255,255,255,.5)", maxWidth: 680, lineHeight: 1.6 }}>{HONESTY_LINE}</p>
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
    // lib/checkoutClient carries the campaign and the free check out to
    // Stripe, so the payment attributes and the profile is pre-filled
    const r = await startCheckout(plan);
    if (!r.ok) { setErr(r.error); setBusy(null); }
  };

  return (
    <section id="packages" className="sec" style={{ scrollMarginTop: 80 }}>
      <div className="wrap">
        <FadeIn>
          <h2 className="h2">One plan. You&apos;re set up in five minutes.</h2>
          <p className="body" style={{ maxWidth: 620, marginTop: 12 }}>
            Full price from the first payment, no setup fee, cancel anytime from your dashboard. Payment opens your setup
            straight away — no call, no waiting for a reply.
          </p>
        </FadeIn>
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

        <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--ink-3)", maxWidth: 680, lineHeight: 1.65 }}>
          Prices in GBP. {HONESTY_LINE} Questions? Tap any card to ask, or email hello@bilabs.ai.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- faq ------------------------------- */

const FAQS = [
  { q: "What exactly happens after I pay?", a: "Within seconds you're on the setup page (and the same link is emailed to you). You confirm your business details — pre-filled from your free check — tick which assistants to monitor, add your services, hours, prices and FAQ, and press Publish. Your profile goes live immediately with structured data, the search index is pinged, and the first check across your chosen assistants runs straight away. From then on it's monthly, with the report emailed to you. If you stop halfway through setup, we email you a reminder with a sign-in link on days 1, 3, 7 and 14." },
  { q: "Will this guarantee AI recommendations?", a: "No. We improve access and clarity; each platform decides what it indexes and recommends. What we control is whether your business is readable — accurate, structured, current, and published where these systems look. Anyone promising you a guaranteed AI ranking is guessing." },
  { q: "What do I get each month?", a: "Your profile stays published and editable, and every month we ask ChatGPT, Claude, Gemini and Grok five real questions with live web search and send you whether they named you, who they named instead, and what to do next — all in your dashboard too, with the history." },
  { q: "What happens after the free check if I don't pay?", a: "You get the full report by email with a one-click link to start whenever you like. If you tick the box, we also send a handful of short emails over the next month — the fixes that matter most for your site, who's being named instead of you, and a free re-check two weeks on. Unsubscribe is one click. If you don't tick it, the report is the only email." },
  { q: "Do I need a new website?", a: "No. Nothing here requires a rebuild. Your profile is hosted on bilabs.ai, and the snippets we give you paste into the site you already have. If your site is thin, the readiness checks in your free report say exactly which gaps matter." },
  { q: "How is this different from SEO?", a: "SEO is about ranking a page in a list of links. This is about whether an assistant answering a spoken question has accurate facts about you to draw on. They overlap — both reward clear, structured, honest information — but the output is an answer, not a results page." },
  { q: "What if a payment fails or I want to stop?", a: "If a card is declined we email you straight away and Stripe retries for a few days; if it keeps failing your profile pauses rather than disappears, and comes back the moment a payment succeeds. Cancelling is one click in Billing in your dashboard — no call, no email, no questions." },
  { q: "Is there a bigger plan?", a: "Not right now. One plan, £49 a month, everything included. We've put our AI receptionist product on hold to do this one thing properly; it will come back as an add-on for existing customers first." },
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
          <div>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.3rem)", lineHeight: 1.12, letterSpacing: "-0.03em", fontWeight: 700, margin: 0, color: "#1a1205", maxWidth: 480 }}>
              Find out what AI says about you. Free, 20 seconds.
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 14.5, color: "rgba(26,18,5,.75)", maxWidth: 480 }}>
              Then decide. Fixing it is £49/month, live today, cancel anytime.
            </p>
          </div>
          <a href="#check" className="btn-ink" style={{ background: "#fff", color: "var(--ink)", borderColor: "#fff", padding: "15px 28px" }}>
            Run the free check ↑
          </a>
        </div>
      </div>
    </section>
  );
}
