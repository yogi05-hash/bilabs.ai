"use client";

import dynamic from "next/dynamic";
import FadeIn from "@/components/FadeIn";
import Counter from "@/components/Counter";
import {
  Bot,
  Zap,
  Mic,
  Target,
  Code2,
  Video,
  MessageSquare,
  ArrowRight,
  Check,
  ExternalLink,
  Sparkles,
  BarChart3,
  Globe,
  Shield,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";

const ShipLog = dynamic(() => import("@/components/ShipLog"), { ssr: false });
const VideoMaker = dynamic(() => import("@/components/VideoMaker"), { ssr: false });

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div className="hero-bg" />
      <div className="hero-glow" />

      <div className="section" style={{ position: "relative", zIndex: 2, paddingTop: 140, paddingBottom: 100 }}>
        <div className="hero-grid">
        <div>
        <FadeIn>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 100,
              border: "1px solid var(--border-strong)",
              background: "var(--bg-glass)",
              backdropFilter: "blur(10px)",
              fontSize: 13,
              color: "var(--text-2)",
              marginBottom: 32,
            }}
          >
            <Sparkles size={14} style={{ color: "#F5B731" }} />
            AI automation for UK businesses — fixed monthly price
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1
            style={{
              fontSize: "clamp(36px, 4.4vw, 58px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              maxWidth: 660,
              marginBottom: 24,
            }}
          >
            We build AI that{" "}
            <span
              style={{
                background: "var(--accent-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              does the work for&nbsp;you
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p
            style={{
              fontSize: 20,
              lineHeight: 1.7,
              color: "var(--text-2)",
              maxWidth: 540,
              marginBottom: 40,
            }}
          >
            An AI receptionist that answers every call. Follow-ups that send
            themselves. Busywork that just… happens. Packaged for estate agents,
            clinics, accountants, recruiters and more — live in weeks, from
            £299/month.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/contact" className="btn-primary" style={{ gap: 8, fontSize: 15, padding: "14px 28px" }}>
              Get Free AI Audit <ArrowRight size={16} />
            </Link>
            <Link href="#pricing" className="btn-secondary" style={{ gap: 8, fontSize: 15, padding: "14px 28px" }}>
              See Packages &amp; Pricing
            </Link>
          </div>
        </FadeIn>
        </div>

        <FadeIn delay={0.35}>
          <ShipLog />
        </FadeIn>
        </div>

        <FadeIn delay={0.5}>
          <div
            style={{
              marginTop: 64,
              display: "flex",
              gap: 40,
              flexWrap: "wrap",
              borderTop: "1px solid var(--border)",
              paddingTop: 32,
            }}
          >
            {[
              { icon: <Shield size={16} />, text: "Enterprise-grade AI" },
              { icon: <Clock size={16} />, text: "Ship in weeks, not months" },
              { icon: <Globe size={16} />, text: "UK & India teams" },
              { icon: <Users size={16} />, text: "50+ automations deployed" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-2)" }}>
                <span style={{ color: "#F5B731" }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  STATS                                                              */
/* ------------------------------------------------------------------ */
function Stats() {
  const stats = [
    { target: 50, suffix: "+", label: "AI Systems Deployed" },
    { target: 20, suffix: "hrs", label: "Saved per Week / Client" },
    { target: 3, suffix: "", label: "AI Products Live" },
    { target: 98, suffix: "%", label: "Client Retention" },
  ];

  return (
    <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
      <div className="section" style={{ padding: "60px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 32, textAlign: "center" }}>
          {stats.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div>
                <div className="stat-number">
                  <Counter target={s.target} suffix={s.suffix} />
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PACKAGES — productised systems; this IS the pricing                */
/* ------------------------------------------------------------------ */
function Packages() {
  const packs = [
    {
      name: "AI Receptionist",
      range: "\u00a3299\u2013\u00a3799",
      desc: "Never miss another call, WhatsApp or enquiry \u2014 even at 2am.",
      features: [
        "Answers calls & WhatsApp 24/7",
        "Books appointments straight into your diary",
        "Missed-call instant text-back",
        "Trained on your services, prices & FAQs",
        "Monthly answered-vs-missed report",
      ],
      cta: "Get my receptionist",
      highlight: false,
    },
    {
      name: "AI Sales & Follow-up",
      range: "\u00a3500\u2013\u00a31,500",
      desc: "Every lead answered in under a minute \u2014 and followed up until they decide.",
      features: [
        "Instant response to every new lead",
        "Follow-up sequences on email, WhatsApp & SMS",
        "Leads qualified and routed to your team",
        "Syncs with your CRM \u2014 or replaces the spreadsheet",
        "Weekly pipeline report",
        "AI Receptionist available as an add-on",
      ],
      cta: "Stop losing leads",
      highlight: true,
    },
    {
      name: "Full Business Automation",
      range: "\u00a32,000\u2013\u00a35,000",
      desc: "Reception, sales, paperwork and back-office \u2014 on autopilot.",
      features: [
        "Receptionist + Sales systems included",
        "Invoice chasing & document collection",
        "Quotes, intake forms & onboarding flows",
        "Custom integrations with your software",
        "Dedicated automation engineer",
        "Monthly optimisation & new automations",
      ],
      cta: "Automate my business",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" style={{ background: "var(--bg-card)" }}>
      <div className="section">
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag">Packages &amp; Pricing</div>
            <h2 className="section-title" style={{ maxWidth: 560, margin: "0 auto 16px" }}>
              Pick a system. It&apos;s working within weeks.
            </h2>
            <p className="section-subtitle" style={{ margin: "0 auto" }}>
              Fixed monthly price. Setup included. No long contracts — cancel monthly.
            </p>
          </div>
        </FadeIn>

        <div className="grid-3">
          {packs.map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div
                className="glass-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  border: p.highlight ? "1px solid #F5B731" : undefined,
                  boxShadow: p.highlight ? "0 0 40px rgba(245, 183, 49, 0.1)" : undefined,
                }}
              >
                {p.highlight && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#F5B731",
                      marginBottom: 12,
                    }}
                  >
                    Most Popular
                  </div>
                )}

                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>{p.name}</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em" }}>{p.range}</span>
                  <span style={{ fontSize: 14, color: "var(--text-3)" }}>/month</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 24, lineHeight: 1.6 }}>{p.desc}</p>

                <ul style={{ listStyle: "none", padding: 0, flex: 1, marginBottom: 24 }}>
                  {p.features.map((f, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontSize: 14,
                        color: "var(--text-2)",
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      <Check size={15} style={{ color: "#F5B731", flexShrink: 0, marginTop: 3 }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/contact"
                  className={p.highlight ? "btn-primary" : "btn-secondary"}
                  style={{
                    width: "100%",
                    textAlign: "center",
                    ...(p.highlight ? { background: "#F5B731", color: "#0a0a0f" } : {}),
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <p style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: "var(--text-3)" }}>
            Not sure which fits? The free audit tells you in 15 minutes — no obligation.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  INDUSTRIES                                                         */
/* ------------------------------------------------------------------ */
function Industries() {
  const industries = [
    { emoji: "\ud83c\udfe0", name: "Estate agents", line: "Every viewing enquiry answered in seconds \u2014 evenings and weekends included." },
    { emoji: "\ud83e\uddfe", name: "Accountants", line: "Documents chased, invoices followed up, deadlines never missed." },
    { emoji: "\ud83e\udd1d", name: "Recruitment agencies", line: "Candidates screened, qualified and booked while your consultants sleep." },
    { emoji: "\ud83c\udfe5", name: "Private clinics", line: "Cancelled slots refilled automatically; reminders patients actually read." },
    { emoji: "\ud83c\udf7d\ufe0f", name: "Restaurants & hotels", line: "Bookings, changes and questions handled on WhatsApp, 24/7." },
    { emoji: "\u2696\ufe0f", name: "Solicitors", line: "Client intake completed and filed before the first call." },
    { emoji: "\ud83c\udfd7\ufe0f", name: "Construction", line: "Quotes followed up; subcontractor paperwork chased for you." },
    { emoji: "\ud83c\udfed", name: "Small manufacturers", line: "Order-status questions answered instantly; reorders triggered on time." },
  ];

  return (
    <section id="industries">
      <div className="section">
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag">Industries</div>
            <h2 className="section-title" style={{ maxWidth: 560, margin: "0 auto 16px" }}>
              Built for your industry, not adapted to it
            </h2>
            <p className="section-subtitle" style={{ margin: "0 auto" }}>
              We don&apos;t sell generic AI consulting. We install systems already shaped
              around how your sector actually works.
            </p>
          </div>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))",
            gap: 16,
          }}
        >
          {industries.map((ind, i) => (
            <FadeIn key={i} delay={i * 0.05}>
              <div className="glass-card" style={{ height: "100%", padding: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{ind.emoji}</div>
                <h3 style={{ fontSize: 16.5, fontWeight: 600, marginBottom: 8 }}>{ind.name}</h3>
                <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.65 }}>{ind.line}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  OUR PRODUCTS                                                       */
/* ------------------------------------------------------------------ */
function Products() {
  const products = [
    {
      name: "YourBotChat",
      url: "https://yourbotchat.com",
      icon: <MessageSquare size={28} />,
      tagline: "AI chatbot for any website — setup in 60 seconds",
      description:
        "Paste your website URL and get an AI chatbot trained on your content instantly. Captures leads 24/7, answers customer questions, and integrates with your existing tools. Used by 1,200+ businesses.",
      features: ["60-second setup", "Trained on your content", "Lead capture & export", "Multi-language"],
      color: "#F5B731",
      gradient: "linear-gradient(135deg, #F5B731, #E87B35)",
    },
    {
      name: "ReelMakerBot",
      url: "https://reelmakerbot.com",
      icon: <Video size={28} />,
      tagline: "Turn any image into a stunning reel with AI",
      description:
        "Upload a photo, describe the vibe, and our AI generates a scroll-stopping Instagram Reel in 60 seconds. No editing skills needed. Built for creators and businesses across India.",
      features: ["Image to video AI", "60-second generation", "9:16 reel format", "Starting at ₹299/mo"],
      color: "#E8430A",
      gradient: "linear-gradient(135deg, #E8430A, #FF5A1F)",
    },
    {
      name: "Showbizy",
      url: "https://showbizy.ai",
      icon: <Sparkles size={28} />,
      tagline: "AI-powered entertainment & talent platform",
      description:
        "Smart talent discovery and entertainment management powered by AI. Connecting creators, artists, and talent with opportunities using intelligent matching and automation.",
      features: ["AI talent matching", "Smart discovery", "Automated booking", "Analytics dashboard"],
      color: "#8B5CF6",
      gradient: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
    },
  ];

  return (
    <section id="products">
      <div className="section">
        <FadeIn>
          <div className="section-tag">Our Products</div>
          <h2 className="section-title">AI products we built and launched</h2>
          <p className="section-subtitle">
            We don&apos;t just build for clients — we build our own AI products too.
            These are live, revenue-generating products used by thousands.
          </p>
        </FadeIn>

        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 24 }}>
          {products.map((p, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div
                  className="glass-card product-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 40,
                    alignItems: "center",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -100,
                      right: -100,
                      width: 300,
                      height: 300,
                      background: p.gradient,
                      opacity: 0.06,
                      borderRadius: "50%",
                      filter: "blur(60px)",
                      pointerEvents: "none",
                    }}
                  />

                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: `${p.color}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: p.color,
                        marginBottom: 20,
                      }}
                    >
                      {p.icon}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h3 style={{ fontSize: 24, fontWeight: 700 }}>{p.name}</h3>
                      <ExternalLink size={16} style={{ color: "var(--text-3)" }} />
                    </div>

                    <p style={{ fontSize: 16, color: p.color, fontWeight: 500, marginBottom: 12 }}>
                      {p.tagline}
                    </p>

                    <p style={{ fontSize: 15, color: "var(--text-2)", lineHeight: 1.7 }}>
                      {p.description}
                    </p>
                  </div>

                  <div style={{ position: "relative" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {p.features.map((f, j) => (
                        <div
                          key={j}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "var(--bg-glass-light)",
                            border: "1px solid var(--border)",
                            fontSize: 14,
                            color: "var(--text-2)",
                          }}
                        >
                          <Check size={14} style={{ color: p.color, flexShrink: 0 }} />
                          {f}
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        marginTop: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 20px",
                        borderRadius: 10,
                        background: p.gradient,
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      Visit {p.name} <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </a>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PROCESS                                                            */
/* ------------------------------------------------------------------ */
function Process() {
  const steps = [
    { num: "01", title: "Discovery & AI Audit", desc: "We analyse your business, identify automation opportunities, and map out where AI creates the most impact. Free, no obligation." },
    { num: "02", title: "Strategy & Design", desc: "We design the architecture — what to automate, which AI models to use, how it integrates with your existing stack." },
    { num: "03", title: "Build & Deploy", desc: "Our engineers build, test, and deploy your AI system. Most projects go live within 2-4 weeks, not months." },
    { num: "04", title: "Optimise & Scale", desc: "We monitor performance, fine-tune the AI, and scale what works. Continuous improvement, not set-and-forget." },
  ];

  return (
    <section id="process" style={{ background: "var(--bg-card)" }}>
      <div className="section">
        <FadeIn>
          <div className="section-tag">How We Work</div>
          <h2 className="section-title">From idea to deployed AI in weeks</h2>
        </FadeIn>

        <div style={{ marginTop: 48 }}>
          {steps.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div
                style={{
                  display: "flex",
                  gap: 32,
                  padding: "40px 0",
                  borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : "none",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontSize: 64,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    background: "var(--accent-gradient)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    opacity: 0.3,
                    lineHeight: 1,
                    flexShrink: 0,
                    minWidth: 80,
                  }}
                >
                  {s.num}
                </span>
                <div>
                  <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 16, color: "var(--text-2)", lineHeight: 1.7, maxWidth: 500 }}>{s.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SCENARIOS \u2014 what a day looks like with the systems installed       */
/* ------------------------------------------------------------------ */
function Scenarios() {
  const rows = [
    {
      pack: "AI RECEPTIONIST",
      who: "A three-branch estate agency",
      text: "Saturday, 6pm. A buyer enquires about a listing. The AI answers on WhatsApp, checks budget and timing, and books a Monday viewing straight into the negotiator\u2019s diary. Nobody at the agency touched a thing.",
    },
    {
      pack: "AI SALES & FOLLOW-UP",
      who: "An accountancy practice at year-end",
      text: "Forty clients owe documents. The system chases each one politely across email and WhatsApp, logs what arrives, and escalates only the three who went quiet. The partners stay billable.",
    },
    {
      pack: "FULL AUTOMATION",
      who: "A private dental clinic",
      text: "A patient cancels at 8am. The system offers the slot to the waitlist, confirms a replacement by 8:20, updates the diary and sends directions \u2014 before the front desk finishes their coffee.",
    },
  ];

  return (
    <section style={{ background: "var(--bg-card)" }}>
      <div className="section">
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag">What it looks like</div>
            <h2 className="section-title" style={{ maxWidth: 520, margin: "0 auto" }}>
              A working day with BiLabs installed
            </h2>
          </div>
        </FadeIn>

        <div className="grid-3">
          {rows.map((r, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card" style={{ height: "100%" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#F5B731",
                    marginBottom: 10,
                  }}
                >
                  {r.pack}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{r.who}</div>
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.75 }}>{r.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA                                                                */
/* ------------------------------------------------------------------ */
function CTA() {
  return (
    <section>
      <div className="section" style={{ textAlign: "center" }}>
        <FadeIn>
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              marginBottom: 20,
              maxWidth: 600,
              margin: "0 auto 20px",
            }}
          >
            Ready to put{" "}
            <span
              style={{
                background: "var(--accent-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI to work
            </span>
            ?
          </h2>
          <p style={{ fontSize: 18, color: "var(--text-2)", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            Book a free 15-minute AI audit. We&apos;ll map exactly what to automate first
            — and what it saves you every month.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/contact" className="btn-primary" style={{ gap: 8, fontSize: 16, padding: "16px 32px" }}>
              Get Free AI Audit <ArrowRight size={16} />
            </Link>
            <a href="mailto:hello@bilabs.ai" className="btn-secondary" style={{ fontSize: 16, padding: "16px 32px" }}>
              hello@bilabs.ai
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Packages />
      <Industries />
      <VideoMaker />
      <Process />
      <Scenarios />
      <Products />
      <CTA />
    </>
  );
}
