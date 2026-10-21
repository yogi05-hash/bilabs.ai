"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FadeIn from "@/components/FadeIn";
import ScrubVideo from "@/components/ScrubVideo";
import { useTypewriter } from "@/components/useTypewriter";
import { GuideProvider, useGuide } from "@/components/AIGuide";
import VisibilityReport from "@/components/VisibilityReport";
import { PACKAGES } from "@/lib/packages";

/* ------------------------------------------------------------------ *
 *  BiLabs — done-for-you AI visibility.
 *
 *  The spine of the page is Audit → Fix → Answer, and every section can
 *  open the guide with its own context. One promise is deliberately absent
 *  throughout: that we can make an assistant recommend anyone. We make a
 *  business readable; the FAQ says so in as many words.
 * ------------------------------------------------------------------ */

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
const bookHref = CALENDLY || "/contact?package=call";
const bookProps = CALENDLY ? { target: "_blank", rel: "noopener noreferrer" } : {};

const STEPS = [
  { n: "01", t: "Audit", d: "We ask the assistants your customers ask, and write down exactly what they say about you — and who they name instead." },
  { n: "02", t: "Fix", d: "We publish your real services, hours, prices and location in a structured form AI systems can fetch, and keep it current." },
  { n: "03", t: "Answer", d: "An AI receptionist picks up every enquiry that arrives, 24/7, answers from your facts and emails you the lead." },
];

const FAQS = [
  {
    q: "Can you guarantee ChatGPT will recommend me?",
    a: "No. We improve access and clarity; each platform decides what it indexes and recommends. What we control is whether your business is readable — accurate, structured, current, and published where these systems look. That is what we sell, and what the audit measures. Anyone promising you a guaranteed AI ranking is guessing.",
  },
  {
    q: "What exactly do I get for £149?",
    a: "A written report: the questions we asked, what the assistants answered, which businesses they named instead of you, and a prioritised list of what to fix. It is yours to keep and act on, whether or not you ever work with us again.",
  },
  {
    q: "How is this different from SEO?",
    a: "SEO is about ranking a page in a list of links. This is about whether an assistant answering a spoken question has accurate facts about you to draw on. They overlap — both reward clear, structured, honest information — but the output is an answer, not a results page.",
  },
  {
    q: "How long does it take?",
    a: "The audit is back within a few working days. Get Found by AI is usually live within two weeks, depending on how quickly we can agree your services and prices. The AI Front Desk adds a few days on top for the assistant to be set up and tested.",
  },
  {
    q: "Does the assistant make things up?",
    a: "It answers only from facts you have given it. If it has not been told a price, it says it will check rather than inventing one, and it never confirms a booking itself — it shares your booking link or takes details for you to confirm.",
  },
];

export default function Home() {
  return (
    <GuideProvider>
      <Hero />
      <TrustStrip />
      <Problem />
      <ClearerInfo />
      <Check />
      <HowItWorks />
      <Packages />
      <CaseStudy />
      <Faq />
      <Closing />
    </GuideProvider>
  );
}

/* ------------------------------- hero ------------------------------ */

const TYPED = "Customers now ask ChatGPT, Claude and Google AI who to call.";

const HERO_PILLS = [
  { label: "Run the free check", href: "#check" },
  { label: "See the packages", href: "#packages" },
  { label: "Our work", href: "/work" },
];

function Hero() {
  const guide = useGuide();
  const [site, setSite] = useState("");
  const { displayed, done } = useTypewriter(TYPED);
  const [pillsIn, setPillsIn] = useState(false);

  // Pills arrive on their own clock, not the typewriter's.
  useEffect(() => {
    const t = setTimeout(() => setPillsIn(true), 400);
    return () => clearTimeout(t);
  }, []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const field = document.querySelector<HTMLInputElement>('input[aria-label="Your website"]');
    if (field && site.trim()) {
      field.value = site.trim();
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setTimeout(() => document.querySelector<HTMLInputElement>('input[aria-label="Type of business"]')?.focus(), 500);
  };

  return (
    <section className="hero">
      {/* The live-systems terminal that used to sit here is gone: its figures
          — 50+ automations, 1,204 videos, 31 hours saved — were invented. */}
      <ScrubVideo src="/hero.mp4" />

      <div className="hero-copy">
        <p
          aria-hidden
          className="select-none"
          style={{ pointerEvents: "none", fontSize: "clamp(18px, 4vw, 26px)", lineHeight: 1.3, color: "#000", filter: "blur(4px)", marginBottom: 20 }}
        >
          Hey there, this is BiLabs,
          <br />
          we make businesses legible to AI.
        </p>

        <h1
          style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)", lineHeight: 1.03, letterSpacing: "-0.035em", fontWeight: 400, color: "#000", margin: 0 }}
        >
          Get your business recommended by <span className="accent">AI</span>.
        </h1>

        <p style={{ fontSize: "clamp(18px, 4vw, 26px)", lineHeight: 1.35, color: "#000", marginTop: 20, minHeight: 54 }}>
          {displayed}
          {!done && (
            <span className="hero-cursor" />
          )}
        </p>

        <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(0,0,0,.62)", marginTop: 14, maxWidth: 540 }}>
          We publish your business so they can read it — and answer every enquiry that follows, 24/7.
        </p>

        <form onSubmit={go} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28, maxWidth: 540 }}>
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="yourbusiness.co.uk"
            aria-label="Your website address"
            className="form-input"
            style={{ flex: "1 1 220px", minWidth: 0, padding: "14px 18px" }}
          />
          <button type="submit" className="btn-primary" style={{ padding: "14px 26px", fontSize: 15 }}>
            Free AI Visibility Report
          </button>
        </form>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: 24,
            opacity: pillsIn ? 1 : 0,
            transform: pillsIn ? "translateY(0)" : "translateY(8px)",
            transition: "opacity .4s ease, transform .4s ease",
          }}
        >
          {HERO_PILLS.map((p) => (
            <a key={p.href} href={p.href} className="pill">{p.label}</a>
          ))}
          <button type="button" onClick={() => guide.open("hero")} className="pill pill-outline">
            What is this?
          </button>
        </div>

        <p style={{ fontSize: 13, color: "rgba(0,0,0,.45)", marginTop: 14 }}>
          Free · no card · about 15 seconds
        </p>
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
    <section id="problem" style={{ borderTop: "1px solid var(--border-strong)", scrollMarginTop: 80 }}>
      <div className="section" style={{ paddingTop: 90, paddingBottom: 90 }}>
        <FadeIn>
          <div className="section-tag">The shift</div>
          <h2 className="section-title">Your customers stopped scrolling.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-2)", maxWidth: 640, marginTop: 14 }}>
            They ask, and they act on the answer. Which makes one question worth knowing the answer to: what do these
            systems currently say about you?
          </p>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 44 }}>
          {cards.map((c, i) => (
            <FadeIn key={c.t} delay={i * 0.08}>
              <button type="button" onClick={() => guide.open("problem")} className="glass-card ask-card" style={{ padding: 26, height: "100%" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>{c.t}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-2)", margin: "10px 0 0" }}>{c.d}</p>
                <p className="ask-hint">Ask about this →</p>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ check ------------------------------ */

function Check() {
  return (
    <section style={{ borderTop: "1px solid var(--border-strong)" }}>
      <div className="section" style={{ paddingTop: 90, paddingBottom: 90 }}>
        <FadeIn>
          <div className="section-tag">Free check</div>
          <h2 className="section-title">Ask an AI for your trade. See if you come up.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-2)", maxWidth: 640, margin: "14px 0 36px" }}>
            We put a real question to an AI assistant with web search — “recommend a {"{trade}"} in {"{your area}"}” —
            and show you the answer it gives, names and all.
          </p>
        </FadeIn>
        <FadeIn delay={0.1}><VisibilityReport /></FadeIn>
      </div>
    </section>
  );
}

/* --------------------------- how it works -------------------------- */

function HowItWorks() {
  const guide = useGuide();
  return (
    <section id="process" style={{ borderTop: "1px solid var(--border-strong)", scrollMarginTop: 80 }}>
      <div className="section" style={{ paddingTop: 90, paddingBottom: 90 }}>
        <FadeIn>
          <div className="section-tag">How it works</div>
          <h2 className="section-title">Audit → Fix → Answer.</h2>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 44 }}>
          {STEPS.map((s, i) => (
            <FadeIn key={s.n} delay={i * 0.08}>
              <button type="button" onClick={() => guide.open("how-it-works")} className="glass-card ask-card" style={{ padding: 26, height: "100%" }}>
                <span className="step-num">{s.n}</span>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 0", color: "var(--text-1)" }}>{s.t}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-2)", margin: "10px 0 0" }}>{s.d}</p>
                <p className="ask-hint">Ask about this →</p>
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buy = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.url) { setErr(data.error ?? "Could not start checkout."); return; }
      window.location.href = data.url;
    } catch {
      setErr("Could not start checkout. Please email hello@bilabs.ai.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="packages" style={{ borderTop: "1px solid var(--border-strong)", scrollMarginTop: 80 }}>
      <div className="section" style={{ paddingTop: 90, paddingBottom: 90 }}>
        {/* Founding offer. Worded as a refund promise rather than an outcome
            promise — we carry the risk, we do not claim to control what an
            assistant says — and judged by the same free check on this page so
            "mentions you" cannot become an argument later. */}
        <FadeIn>
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18,
            padding: "20px 24px", borderRadius: 16, marginBottom: 40,
            background: "linear-gradient(135deg, rgba(245,183,49,.14), rgba(232,123,53,.07))",
            border: "1px solid rgba(245,183,49,.4)",
          }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase",
              color: "#0a0a0f", background: "var(--accent)", borderRadius: 999, padding: "6px 12px", flexShrink: 0,
            }}>
              Founding client offer
            </span>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 16.5, fontWeight: 600, color: "var(--text-1)" }}>
                First 5 businesses: £99 setup, then £49/month.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.65, color: "var(--text-2)" }}>
                If no AI assistant mentions you within 60 days, we refund you — judged by the same free check
                above, run on the day you start and again at day 60.
              </p>
            </div>
            <a href={bookHref} {...bookProps} className="btn-primary" style={{ padding: "12px 22px", fontSize: 14, flexShrink: 0 }}>
              Claim a founding place
            </a>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="section-tag">Packages</div>
          <h2 className="section-title">Start where it hurts.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-2)", maxWidth: 620, margin: "14px 0 0" }}>
            Three ways in. Most people start with the audit, because it tells you whether the rest is worth doing.
          </p>
        </FadeIn>

        {err && <p style={{ marginTop: 20, color: "#fca5a5", fontSize: 14 }}>{err}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 18, marginTop: 44, alignItems: "stretch" }}>
          {PACKAGES.map((p, i) => (
            <FadeIn key={p.id} delay={i * 0.08}>
              <div className="glass-card" style={{ padding: 28, height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", borderColor: p.id === "get-found" ? "rgba(245,183,49,.45)" : undefined }}>
                {p.id === "get-found" && <span aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: "var(--accent-gradient)" }} />}

                <button type="button" onClick={() => guide.open(p.id)} className="ask-card" style={{ background: "none", border: "none", padding: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>{p.name}</h3>
                  <p style={{ margin: "14px 0 0" }}>
                    <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>{p.price}</span>
                    {p.sub && <span style={{ fontSize: 14, color: "var(--text-3)" }}> {p.sub}</span>}
                  </p>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-2)", margin: "14px 0 0" }}>{p.blurb}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {p.points.map((pt) => (
                      <li key={pt} style={{ display: "flex", gap: 10, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)" }}>
                        <span style={{ color: "var(--accent)" }}>✓</span><span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="ask-hint">Is this the right one? →</p>
                </button>

                {p.cta === "checkout" ? (
                  <button type="button" onClick={buy} disabled={busy} className="btn-primary" style={{ marginTop: 22, padding: "13px 0", fontSize: 14.5, width: "100%", opacity: busy ? 0.6 : 1 }}>
                    {busy ? "Opening checkout…" : p.ctaLabel}
                  </button>
                ) : (
                  <a href={bookHref} {...bookProps} className="btn-secondary" style={{ marginTop: 22, padding: "13px 0", fontSize: 14.5, width: "100%", textAlign: "center" }}>
                    {p.ctaLabel}
                  </a>
                )}
              </div>
            </FadeIn>
          ))}
        </div>

        <p style={{ marginTop: 22, fontSize: 13, color: "var(--text-3)", maxWidth: 680, lineHeight: 1.7 }}>
          Prices in GBP, excluding VAT. We make your business readable to AI systems — no one can guarantee that an
          assistant will recommend you, and we do not.
        </p>
      </div>
    </section>
  );
}

/* --------------------------- case study ---------------------------- */

function CaseStudy() {
  return (
    <section style={{ borderTop: "1px solid var(--border-strong)" }}>
      <div className="section" style={{ paddingTop: 90, paddingBottom: 90 }}>
        <FadeIn>
          <div className="section-tag">Results</div>
          <h2 className="section-title">Case studies, once we have them.</h2>
          <div className="glass-card" style={{ padding: 32, marginTop: 28, maxWidth: 700 }}>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: "var(--text-2)", margin: 0 }}>
              We would rather leave this space empty than fill it with invented numbers. Client results go here as
              soon as we have run long enough to report them honestly — the question we asked, what the assistants
              said before, and what they said after.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-3)", margin: "16px 0 0" }}>
              In the meantime, the free check above shows you the “before” for your own business, in about fifteen
              seconds.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ------------------------------- faq ------------------------------- */

function Faq() {
  const guide = useGuide();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section style={{ borderTop: "1px solid var(--border-strong)" }}>
      <div className="section" style={{ paddingTop: 90, paddingBottom: 90, maxWidth: 820 }}>
        <FadeIn>
          <div className="section-tag">Questions</div>
          <h2 className="section-title">The ones worth asking.</h2>
        </FadeIn>

        <div style={{ marginTop: 34, borderTop: "1px solid var(--border-strong)" }}>
          {FAQS.map((f, i) => (
            <div key={f.q} style={{ borderBottom: "1px solid var(--border-strong)" }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, padding: "20px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 16.5, fontWeight: 600, color: "var(--text-1)" }}>{f.q}</span>
                <span style={{ color: "var(--accent)", fontSize: 20, transform: open === i ? "rotate(45deg)" : "none", transition: "transform .2s ease" }}>+</span>
              </button>
              {open === i && <p style={{ margin: "-4px 0 22px", fontSize: 15.5, lineHeight: 1.8, color: "var(--text-2)", maxWidth: 680 }}>{f.a}</p>}
            </div>
          ))}
        </div>

        <button type="button" onClick={() => guide.open("faq")} className="btn-secondary" style={{ marginTop: 30, padding: "13px 26px", fontSize: 14.5 }}>
          Ask your own question
        </button>
      </div>
    </section>
  );
}

/* ----------------------------- closing ----------------------------- */

function Closing() {
  return (
    <section className="band-amber">
      <div className="section" style={{ paddingTop: 70, paddingBottom: 70 }}>
        <FadeIn>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 700, margin: 0, color: "#1a1205", maxWidth: 520 }}>
              Let&apos;s make AI useful for your business.
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href="#check" style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 30px",
                borderRadius: 999, background: "#0a0a0c", color: "#fff", fontWeight: 600, fontSize: 15,
              }}>
                Start with a free check ↗
              </a>
              <a href={bookHref} {...bookProps} style={{
                display: "inline-flex", alignItems: "center", padding: "15px 30px",
                borderRadius: 999, background: "transparent", color: "#1a1205",
                border: "1px solid rgba(26,18,5,.35)", fontWeight: 600, fontSize: 15,
              }}>
                Book a 15-min call
              </a>
            </div>
          </div>
          <p style={{ marginTop: 20, fontSize: 13.5, color: "rgba(26,18,5,.7)" }}>
            Or email hello@bilabs.ai
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* --------------------------- trust strip --------------------------- */

function TrustStrip() {
  const items = ["Be understood", "Answer enquiries", "Save time"];
  return (
    <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,.015)" }}>
      <div className="section" style={{ paddingTop: 22, paddingBottom: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 36px" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15.5, color: "var(--text-1)" }}>
            Built for the way customers discover, ask and buy.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px" }}>
            {items.map((i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, color: "var(--text-2)" }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand)" }} />
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------- clearer information ----------------------- */

/* Shows what "readable to AI" actually means, as a thing you can look at
 * rather than a claim. The caption is the honest limit, kept in the same
 * eyeline as the promise. */
function ClearerInfo() {
  const guide = useGuide();
  const rows = [
    { label: "Services", w: ["78%", "54%"] },
    { label: "Location", w: ["62%", "40%"] },
    { label: "Opening hours", w: ["70%", "48%"] },
    { label: "FAQs", w: ["84%", "58%"] },
  ];

  return (
    <section className="band-dark">
      <div className="section" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, alignItems: "center" }}>
          <FadeIn>
            <h2 style={{ fontSize: "clamp(1.9rem, 4.4vw, 2.8rem)", lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 700, margin: 0, color: "#fff" }}>
              Give AI clearer <span className="accent" style={{ color: "var(--brand)" }}>information.</span>
            </h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.75, color: "rgba(255,255,255,.66)", marginTop: 16, maxWidth: 440 }}>
              We organise and publish your business information so AI systems that support it can access it.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "26px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {["Clear service and product pages", "Structured business information", "Crawler access checks"].map((t) => (
                <li key={t} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 15.5, color: "rgba(255,255,255,.88)" }}>
                  <span className="tick">✓</span>{t}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => guide.open("get-found")} className="btn-secondary" style={{ marginTop: 28, padding: "12px 24px", fontSize: 14.5 }}>
              How this works →
            </button>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div>
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
                <p style={{ margin: "0 0 10px", fontSize: 14.5, fontWeight: 700, color: "#0a0a0c" }}>Your business profile</p>
                {rows.map((r) => (
                  <div key={r.label} className="profile-row">
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0a0a0c", width: 104, flexShrink: 0 }}>{r.label}</span>
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      {r.w.map((w, i) => <span key={i} className="profile-bar" style={{ width: w }} />)}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 12.5, textAlign: "center", color: "rgba(255,255,255,.45)" }}>
                Access does not guarantee indexing or recommendations.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
