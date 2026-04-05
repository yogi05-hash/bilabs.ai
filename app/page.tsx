"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import Counter from "@/components/Counter";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { StickyScroll } from "@/components/ui/sticky-scroll-reveal";

const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const services = [
  {
    icon: "⚙️",
    title: "AI Workflow Automation",
    desc: "Stop doing repetitive work. We automate your emails, data entry, invoices, and reports — so your team can focus on what actually grows the business.",
    price: "£149 setup + £49/mo",
    result: "Save 20+ hours/week",
    gradient: "linear-gradient(135deg, #F5B731, #F0D060)",
  },
  {
    icon: "✍️",
    title: "AI Content Engine",
    desc: "30 social media posts + 4 blog articles per month, written in your brand voice. You review and publish. Content marketing on autopilot.",
    price: "£99/mo",
    result: "10x content output",
    gradient: "linear-gradient(135deg, #E87B35, #F5B731)",
  },
  {
    icon: "📞",
    title: "AI Voice Agent",
    desc: "An AI that answers your phone, books appointments, qualifies leads, and handles FAQs. Natural conversation, 24/7, never calls in sick.",
    price: "£299 setup + £79/mo",
    result: "Never miss a lead",
    gradient: "linear-gradient(135deg, #F0D060, #E87B35)",
  },
  {
    icon: "🎯",
    title: "AI Lead Generation",
    desc: "We build an AI system that finds your ideal customers, scrapes their details, qualifies them, and sends personalised outreach — all on autopilot.",
    price: "£149/mo",
    result: "Leads while you sleep",
    gradient: "linear-gradient(135deg, #F5B731, #E87B35)",
  },
  {
    icon: "🔌",
    title: "Custom AI Solutions",
    desc: "Need something specific? We build bespoke AI automations tailored to your business. CRM integrations, internal tools, data pipelines — whatever you need.",
    price: "From £999",
    result: "Built for your business",
    gradient: "linear-gradient(135deg, #E87B35, #F0D060)",
  },
  {
    icon: "💬",
    title: "AI Chatbots",
    desc: "Need a chatbot for your website? We've got you covered with yourbotchat.com — our dedicated chatbot platform. Simple setup, powerful AI, from just £29/mo.",
    price: "From £29/mo",
    result: "Via yourbotchat.com",
    gradient: "linear-gradient(135deg, #F0D060, #F5B731)",
    link: "https://yourbotchat.com",
  },
];

const processContent = [
  {
    title: "1. Free AI Audit (15 min)",
    description: "Quick call — no sales pitch. We look at your business and show you exactly where AI can save you time and money. You'll walk away with actionable ideas whether you hire us or not.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">📞</div>
          <div className="text-lg font-semibold text-white">Free Audit</div>
          <div className="text-sm text-white/50 mt-1">15 min call</div>
        </div>
      </div>
    ),
  },
  {
    title: "2. We Pick the Quick Win",
    description: "We identify the ONE automation that will have the biggest impact for the least cost. Usually something under £200 that saves hours every week. No massive contracts.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">🎯</div>
          <div className="text-lg font-semibold text-white">Quick Win</div>
          <div className="text-sm text-white/50 mt-1">Biggest impact first</div>
        </div>
      </div>
    ),
  },
  {
    title: "3. Built & Live in Days",
    description: "Most of our automations go live within 3-5 days. Not months. You see it working, you test it, and you only pay once you're happy. Zero risk.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">⚡</div>
          <div className="text-lg font-semibold text-white">Live in Days</div>
          <div className="text-sm text-white/50 mt-1">Not months</div>
        </div>
      </div>
    ),
  },
  {
    title: "4. Scale What Works",
    description: "Once you see the ROI from one automation, we add more. Most clients start with one £99-£149/mo service and expand to 3-4 within a few months.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">📈</div>
          <div className="text-lg font-semibold text-white">Scale Up</div>
          <div className="text-sm text-white/50 mt-1">Add more over time</div>
        </div>
      </div>
    ),
  },
];

const testimonials = [
  {
    text: "Started with just the content engine at £99/mo. Within 2 weeks we had more social media content than we'd produced in 6 months. Absolute no-brainer.",
    author: "James K.",
    role: "Founder, Digital Agency",
  },
  {
    text: "The AI voice agent changed everything. We were missing 40% of inbound calls. Now every call is answered, every lead is captured. Paying for itself 10x over.",
    author: "Priya S.",
    role: "Owner, Dental Practice",
  },
  {
    text: "They automated our entire invoicing workflow for £149. What used to take my assistant 8 hours a week now happens automatically. Best money I've ever spent.",
    author: "Tom R.",
    role: "Director, Construction Co.",
  },
];

const pricing = [
  {
    name: "Starter",
    price: "£99",
    period: "/mo",
    desc: "One AI automation to start",
    features: ["Choose any one service", "Setup included", "Live within 5 days", "Email support", "Cancel anytime"],
    cta: "Start for £99",
    popular: false,
  },
  {
    name: "Growth",
    price: "£249",
    period: "/mo",
    desc: "Multiple automations, priority support",
    features: ["Up to 3 services bundled", "Priority setup (48hrs)", "Dedicated Slack channel", "Monthly strategy call", "Cancel anytime"],
    cta: "Most Popular",
    popular: true,
  },
  {
    name: "Custom",
    price: "Let's talk",
    period: "",
    desc: "Bespoke AI for your business",
    features: ["Fully custom solution", "Unlimited automations", "Dedicated account manager", "Weekly check-ins", "SLA guarantee"],
    cta: "Book a Call",
    popular: false,
  },
];

export default function Home() {
  return (
    <>
      {/* ── HERO ── */}
      <HeroHighlight containerClassName="!h-screen !bg-[#050507]">
        <div className="canvas-wrap" style={{ zIndex: 1 }}>
          <HeroScene />
        </div>

        <div className="relative z-10 max-w-[1200px] mx-auto px-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="section-tag">AI Automation Agency</div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-[750px] mb-6"
            style={{ letterSpacing: "-0.04em" }}
          >
            We put your business on{" "}
            <Highlight className="!from-[#F5B731] !to-[#F0D060]">
              AI autopilot
            </Highlight>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <TextGenerateEffect
              words="Workflow automation, AI content, voice agents, lead generation — starting from just £99/mo. No big contracts. Cancel anytime. See results in days, not months."
              className="!text-lg !font-normal max-w-[580px] mb-10 [&_div]:!text-lg [&_span]:!text-[rgba(240,240,245,0.55)]"
              duration={0.3}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex gap-3 items-center flex-wrap"
          >
            <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15, background: "#F5B731", color: "#0a0a0f" }}>
              Free AI Audit →
            </Link>
            <Link href="/services" className="btn-secondary" style={{ padding: "14px 32px", fontSize: 15 }}>
              See Pricing
            </Link>
            <span style={{ fontSize: 13, color: "var(--text-3)", marginLeft: 8 }}>
              15 min call &middot; No commitment
            </span>
          </motion.div>
        </div>
      </HeroHighlight>

      {/* ── SOCIAL PROOF BAR ── */}
      <section style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", padding: "32px 0", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="flex justify-center items-center gap-8 flex-wrap text-center" style={{ color: "var(--text-3)", fontSize: 13 }}>
            <span>✓ No long contracts</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>✓ Cancel anytime</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>✓ Live in under a week</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>✓ From just £99/mo</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>✓ Free AI audit call</span>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="section" style={{ paddingTop: 100, paddingBottom: 100 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {[
            { target: 50, suffix: "+", label: "Automations deployed" },
            { target: 20, suffix: "hrs", label: "Saved per client/week" },
            { target: 5, suffix: " days", label: "Avg. time to go live" },
            { target: 99, suffix: "/mo", prefix: "£", label: "Starting price" },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="stat-number">
                  <Counter target={s.target} suffix={s.suffix} prefix={s.prefix} duration={2} />
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="section">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="section-tag">What We Automate</div>
            <h2 className="section-title mx-auto" style={{ textAlign: "center", maxWidth: 650 }}>
              Pick an automation. We build it. You save hours.
            </h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center", maxWidth: 560 }}>
              Each service is affordable, fast to set up, and designed to pay for itself within the first month.
            </p>
          </div>
        </FadeIn>

        <div className="grid-3" style={{ gap: 16 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              {s.link ? (
                <a href={s.link} target="_blank" rel="noopener noreferrer" className="glass-card block" style={{ height: "100%", display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit" }}>
                  <ServiceCardInner s={s} />
                </a>
              ) : (
                <div className="glass-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <ServiceCardInner s={s} />
                </div>
              )}
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── SCROLL DASHBOARD ── */}
      <section style={{ background: "var(--bg)" }}>
        <ContainerScroll
          titleComponent={
            <div>
              <p className="section-tag mb-4">See The Results</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ letterSpacing: "-0.035em", color: "var(--text-1)" }}>
                Your business on
                <br />
                <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  AI autopilot
                </span>
              </h2>
            </div>
          }
        >
          <div className="h-full w-full bg-gradient-to-br from-[#0a0a1a] to-[#1a1008] flex items-center justify-center rounded-2xl p-8">
            <div className="w-full max-w-2xl space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Hours Saved This Month</div>
                  <div className="text-3xl font-bold text-[#F5B731]">127</div>
                  <div className="text-xs text-emerald-400 mt-1">↑ 34% vs last month</div>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Leads Captured</div>
                  <div className="text-3xl font-bold text-[#E87B35]">89</div>
                  <div className="text-xs text-emerald-400 mt-1">↑ from 12 (manual)</div>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Content Published</div>
                  <div className="text-3xl font-bold text-[#F0D060]">34</div>
                  <div className="text-xs text-white/30 mt-1">posts this month</div>
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 h-40 flex items-end gap-2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${20 + Math.sin(i * 0.4) * 20 + (i / 24) * 40 + Math.random() * 10}%`,
                      background: `linear-gradient(to top, rgba(245,183,49,0.7), rgba(232,123,53,0.3))`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ── PROCESS ── */}
      <section className="section">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="section-tag">How It Works</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>Live in days. Not months.</h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center" }}>
              No 6-month timelines. No massive invoices. Start small, see results, then scale.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <StickyScroll content={processContent} />
        </FadeIn>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="section">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="section-tag">Results</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>What our clients say</h2>
          </div>
        </FadeIn>
        <div className="grid-3">
          {testimonials.map((t, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ fontSize: 24, marginBottom: 16, color: "#F5B731", opacity: 0.5 }}>&ldquo;</div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-2)", flex: 1 }}>
                  {t.text}
                </p>
                <div>
                  <div className="testimonial-author">{t.author}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="section" id="pricing">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="section-tag">Simple Pricing</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>Start small. Scale when ready.</h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center" }}>
              No annual contracts. No hidden fees. Cancel anytime. Start with what you need.
            </p>
          </div>
        </FadeIn>

        <div className="grid-3" style={{ gap: 16, alignItems: "stretch" }}>
          {pricing.map((p, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div
                className="glass-card"
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  border: p.popular ? "1px solid rgba(245,183,49,0.35)" : undefined,
                  boxShadow: p.popular ? "0 0 40px rgba(245,183,49,0.06)" : undefined,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {p.popular && (
                  <div style={{
                    position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 700,
                    background: "#F5B731", color: "#0a0a0f", padding: "3px 10px", borderRadius: 100,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    Best Value
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em",
                    background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
                    {p.price}
                  </span>
                  {p.period && <span style={{ fontSize: 14, color: "var(--text-3)" }}>{p.period}</span>}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24 }}>{p.desc}</div>
                <ul style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {p.features.map((f, j) => (
                    <li key={j} style={{ fontSize: 13, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#F5B731", fontSize: 14 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={p.popular ? "btn-primary" : "btn-secondary"}
                  style={{
                    width: "100%", textAlign: "center", fontSize: 13,
                    ...(p.popular ? { background: "#F5B731", color: "#0a0a0f" } : {}),
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── CHATBOT CROSS-SELL ── */}
      <section className="section" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <FadeIn>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 13, color: "#F5B731", fontWeight: 600, marginBottom: 8 }}>JUST NEED A CHATBOT?</div>
              <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
                Check out yourbotchat.com
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6 }}>
                Our dedicated AI chatbot platform. Set up in minutes, trained on your business, from just £29/mo. No code needed.
              </p>
            </div>
            <a href="https://yourbotchat.com" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ background: "#F5B731", color: "#0a0a0f", padding: "12px 28px", fontSize: 14, whiteSpace: "nowrap" }}>
              Visit yourbotchat.com →
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <section className="section" style={{ textAlign: "center" }}>
        <FadeIn>
          <div style={{ position: "relative", padding: "80px 40px", borderRadius: 24, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "var(--accent-gradient)", opacity: 0.06 }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 600, height: 600, borderRadius: "50%", background: "#F5B731", filter: "blur(180px)", opacity: 0.06,
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ letterSpacing: "-0.035em" }}>
                Free 15-minute AI audit
              </h2>
              <p className="text-base mb-3 max-w-[500px] mx-auto" style={{ color: "var(--text-2)" }}>
                We&apos;ll show you exactly where AI can save you time and money — no pitch, no commitment. Walk away with actionable ideas.
              </p>
              <p className="text-sm mb-9" style={{ color: "var(--text-3)" }}>
                Most businesses find at least 20 hours/week they can automate.
              </p>
              <Link href="/contact" className="btn-primary" style={{ padding: "16px 40px", fontSize: 16, background: "#F5B731", color: "#0a0a0f" }}>
                Book Your Free Audit →
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}

function ServiceCardInner({ s }: { s: typeof services[number] }) {
  return (
    <>
      <div className="service-icon" style={{ background: s.gradient }}>{s.icon}</div>
      <h3 className="text-base font-semibold mb-1" style={{ letterSpacing: "-0.02em" }}>{s.title}</h3>
      <div style={{ fontSize: 13, color: "#F5B731", fontWeight: 600, marginBottom: 8 }}>{s.price}</div>
      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-2)", flex: 1 }}>{s.desc}</p>
      <div style={{
        fontSize: 12, fontWeight: 600, color: "#F5B731",
        background: "rgba(245,183,49,0.1)", padding: "6px 12px",
        borderRadius: 6, display: "inline-block", width: "fit-content",
      }}>
        {s.result}
      </div>
    </>
  );
}

// Need to reference the type for ServiceCardInner
type ServiceType = typeof services[number];
