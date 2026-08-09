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
            AI Products &amp; Automation Agency
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
            Chatbots that answer your customers, videos that make themselves, and
            automations that clear the busywork — built for your business and live
            in weeks.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/contact" className="btn-primary" style={{ gap: 8, fontSize: 15, padding: "14px 28px" }}>
              Get Free AI Audit <ArrowRight size={16} />
            </Link>
            <Link href="#products" className="btn-secondary" style={{ gap: 8, fontSize: 15, padding: "14px 28px" }}>
              See Our Products
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40, textAlign: "center" }}>
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
/*  SERVICES                                                           */
/* ------------------------------------------------------------------ */
function Services() {
  const services = [
    {
      icon: <Zap size={24} />,
      title: "AI Workflow Automation",
      desc: "Automate repetitive tasks across your business. CRM updates, email sequences, data processing — all running on autopilot.",
      price: "From £149/mo",
    },
    {
      icon: <Bot size={24} />,
      title: "AI Chatbots & Assistants",
      desc: "Customer support bots trained on your data. Handle 80% of queries automatically. Live on your website in minutes.",
      price: "From £29/mo",
    },
    {
      icon: <Mic size={24} />,
      title: "AI Voice Agents",
      desc: "Phone-based AI agents that handle inbound calls, book appointments, and qualify leads — 24/7, no human needed.",
      price: "From £79/mo",
    },
    {
      icon: <Target size={24} />,
      title: "AI Lead Generation",
      desc: "Intelligent prospecting that finds, qualifies, and nurtures leads. Personalised outreach at scale powered by AI.",
      price: "From £149/mo",
    },
    {
      icon: <BarChart3 size={24} />,
      title: "AI Content Engine",
      desc: "Automated content creation for social media, blogs, and email. On-brand, on-schedule, on autopilot.",
      price: "From £99/mo",
    },
    {
      icon: <Code2 size={24} />,
      title: "Custom AI Solutions",
      desc: "Bespoke AI products built from scratch. Computer vision, NLP, recommendation engines — whatever your business needs.",
      price: "From £999",
    },
  ];

  return (
    <section id="services" style={{ background: "var(--bg-card)" }}>
      <div className="section">
        <FadeIn>
          <div className="section-tag">Services</div>
          <h2 className="section-title">AI automation for every part of your business</h2>
          <p className="section-subtitle">
            We handle everything — strategy, build, deployment, and ongoing optimisation.
          </p>
        </FadeIn>

        <div className="grid-3" style={{ marginTop: 48 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div
                  className="service-icon"
                  style={{ background: "rgba(245, 183, 49, 0.1)", color: "#F5B731" }}
                >
                  {s.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, flex: 1 }}>{s.desc}</p>
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#F5B731",
                  }}
                >
                  {s.price}
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
/*  PRICING                                                            */
/* ------------------------------------------------------------------ */
function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "£499",
      period: "one-time",
      desc: "Perfect for small businesses starting with AI",
      features: [
        "1 AI automation workflow",
        "Basic chatbot setup",
        "Email support",
        "1 month maintenance",
        "Performance dashboard",
      ],
      cta: "Get Started",
      highlight: false,
    },
    {
      name: "Growth",
      price: "£199",
      period: "/month",
      desc: "For businesses scaling with AI",
      features: [
        "Up to 5 automation workflows",
        "Advanced chatbot with lead capture",
        "AI content generation",
        "Priority support",
        "Monthly strategy call",
        "Analytics & reporting",
      ],
      cta: "Start Growing",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      desc: "Full AI transformation for your business",
      features: [
        "Unlimited automations",
        "Custom AI product development",
        "Voice agents & phone bots",
        "Dedicated account manager",
        "24/7 priority support",
        "Custom integrations",
        "SLA guarantee",
      ],
      cta: "Talk to Us",
      highlight: false,
    },
  ];

  return (
    <section id="pricing">
      <div className="section">
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag">Pricing</div>
            <h2 className="section-title" style={{ maxWidth: 500, margin: "0 auto 16px" }}>
              Simple, transparent pricing
            </h2>
            <p className="section-subtitle" style={{ margin: "0 auto" }}>
              No hidden fees. No long contracts. Scale up or down anytime.
            </p>
          </div>
        </FadeIn>

        <div className="grid-3">
          {plans.map((p, i) => (
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

                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{p.name}</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em" }}>{p.price}</span>
                  {p.period && <span style={{ fontSize: 14, color: "var(--text-3)" }}>{p.period}</span>}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 24 }}>{p.desc}</p>

                <ul style={{ listStyle: "none", padding: 0, flex: 1, marginBottom: 24 }}>
                  {p.features.map((f, j) => (
                    <li
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 14,
                        color: "var(--text-2)",
                        marginBottom: 12,
                      }}
                    >
                      <Check size={15} style={{ color: "#F5B731", flexShrink: 0 }} />
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
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  TESTIMONIALS                                                       */
/* ------------------------------------------------------------------ */
function Testimonials() {
  const reviews = [
    {
      text: "BiLabs built our AI chatbot in under a week. It now handles 70% of our customer queries automatically. The ROI was immediate.",
      name: "Sarah M.",
      role: "Operations Director, E-commerce",
    },
    {
      text: "Their workflow automation saved our team 25 hours per week. What used to take 3 people now runs on autopilot.",
      name: "James P.",
      role: "CEO, Marketing Agency",
    },
    {
      text: "We tried building AI in-house for 6 months and got nowhere. BiLabs shipped a working solution in 3 weeks.",
      name: "Priya K.",
      role: "CTO, SaaS Startup",
    },
  ];

  return (
    <section style={{ background: "var(--bg-card)" }}>
      <div className="section">
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag">Testimonials</div>
            <h2 className="section-title" style={{ maxWidth: 500, margin: "0 auto" }}>
              What our clients say
            </h2>
          </div>
        </FadeIn>

        <div className="grid-3">
          {reviews.map((r, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card">
                <p className="testimonial-text">&ldquo;{r.text}&rdquo;</p>
                <div>
                  <div className="testimonial-author">{r.name}</div>
                  <div className="testimonial-role">{r.role}</div>
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
            Book a free AI audit. We&apos;ll show you exactly where AI can save you
            time, money, and headaches.
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
      <Services />
      <Products />
      <VideoMaker />
      <Process />
      <Testimonials />
      <Pricing />
      <CTA />
    </>
  );
}
