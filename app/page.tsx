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
    icon: "💬",
    title: "AI Chatbots & Support Agents",
    desc: "24/7 customer support that actually resolves issues. Trained on your docs, integrated with your CRM, handling tickets while your team sleeps.",
    result: "80% fewer support tickets",
    gradient: "linear-gradient(135deg, #F5B731, #F0D060)",
  },
  {
    icon: "⚙️",
    title: "Workflow Automation",
    desc: "Kill repetitive tasks. Email sorting, data entry, report generation, invoice processing — automated end-to-end with AI that learns your patterns.",
    result: "40hrs/week saved per team",
    gradient: "linear-gradient(135deg, #E87B35, #81ecec)",
  },
  {
    icon: "📞",
    title: "AI Voice Agents",
    desc: "Phone agents that book appointments, qualify leads, and handle inbound calls. Natural conversation, zero wait times, works 24/7.",
    result: "3x more leads captured",
    gradient: "linear-gradient(135deg, #fd79a8, #fab1a0)",
  },
  {
    icon: "✍️",
    title: "AI Content Engine",
    desc: "Blog posts, social media, ad copy, email campaigns — generated in your brand voice. Review, approve, publish. Scale content without scaling headcount.",
    result: "10x content output",
    gradient: "linear-gradient(135deg, #fdcb6e, #ffeaa7)",
  },
  {
    icon: "📊",
    title: "AI Analytics & Insights",
    desc: "Dashboards that think. Ask questions in plain English, get instant answers from your data. Predictive analytics that spot trends before they happen.",
    result: "Decisions in minutes, not weeks",
    gradient: "linear-gradient(135deg, #74b9ff, #F0D060)",
  },
  {
    icon: "🔌",
    title: "Custom AI Integrations",
    desc: "Plug AI into Salesforce, HubSpot, Slack, Shopify, or any tool you use. We build the connectors so AI works inside your existing workflow.",
    result: "Zero workflow disruption",
    gradient: "linear-gradient(135deg, #55efc4, #00b894)",
  },
];

const processContent = [
  {
    title: "1. Free Discovery Call",
    description: "We learn about your business in a 30-minute call. No sales pitch — we identify 2-3 high-impact automation opportunities you can act on immediately, whether you work with us or not.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">🎯</div>
          <div className="text-lg font-semibold text-white">Discovery</div>
          <div className="text-sm text-white/50 mt-1">30 min call</div>
        </div>
      </div>
    ),
  },
  {
    title: "2. Custom Proposal",
    description: "Within 48 hours you get a clear proposal — exactly what we'll build, how long it takes, and what it costs. Fixed price, no surprises. Most projects are $5K-$25K.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">📋</div>
          <div className="text-lg font-semibold text-white">Proposal</div>
          <div className="text-sm text-white/50 mt-1">48 hours</div>
        </div>
      </div>
    ),
  },
  {
    title: "3. Build & Demo Weekly",
    description: "We build in sprints. Every Friday you see a working demo. You give feedback, we iterate. No disappearing for months — you see progress from day one.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">🛠️</div>
          <div className="text-lg font-semibold text-white">Build</div>
          <div className="text-sm text-white/50 mt-1">Weekly demos</div>
        </div>
      </div>
    ),
  },
  {
    title: "4. Launch & Support",
    description: "We deploy to production, train your team, and provide 30 days of free support. Most clients see ROI within the first month. Then we're on retainer for ongoing improvements.",
    content: (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-3">🚀</div>
          <div className="text-lg font-semibold text-white">Launch</div>
          <div className="text-sm text-white/50 mt-1">30 day support</div>
        </div>
      </div>
    ),
  },
];

const testimonials = [
  {
    text: "bilabs built us an AI chatbot that handles 80% of our support tickets. We went from 12 support reps to 4 — and our customer satisfaction actually went up.",
    author: "Sarah Chen",
    role: "VP Operations, TechScale",
  },
  {
    text: "Our sales team was spending 3 hours a day on data entry. bilabs automated the entire pipeline — CRM updates, follow-up emails, lead scoring. All hands-free now.",
    author: "Marcus Reid",
    role: "CEO, DataFlow Analytics",
  },
  {
    text: "They shipped our AI voice agent in 10 days. It books appointments, qualifies leads, and handles objections better than most of our junior reps. Insane ROI.",
    author: "Anika Patel",
    role: "CTO, NovaBridge",
  },
];

const pricing = [
  {
    name: "Starter",
    price: "$5,000",
    desc: "One focused AI automation",
    features: ["Single workflow automation", "Integration with 1-2 tools", "2-week delivery", "30-day support", "Training session"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Growth",
    price: "$15,000",
    desc: "Full AI transformation",
    features: ["Up to 3 automations", "Custom AI chatbot or voice agent", "Full tool integrations", "4-week delivery", "60-day support", "Dedicated Slack channel"],
    cta: "Most Popular",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "AI at scale",
    features: ["Unlimited automations", "Custom model development", "Priority support & SLA", "Dedicated team", "Ongoing optimization", "Quarterly strategy reviews"],
    cta: "Talk to Us",
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
            We automate your business{" "}
            <Highlight className="!from-[#F5B731] !to-[#F0D060]">
              with AI that works
            </Highlight>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <TextGenerateEffect
              words="Chatbots, voice agents, workflow automation, content engines — we build the AI systems that save you thousands of hours and scale your business on autopilot."
              className="!text-lg !font-normal max-w-[580px] mb-10 [&_div]:!text-lg [&_span]:!text-[rgba(240,240,245,0.55)]"
              duration={0.3}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex gap-3 items-center"
          >
            <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15, background: "#F5B731", color: "#0a0a0f" }}>
              Book a Free Call
            </Link>
            <Link href="/services" className="btn-secondary" style={{ padding: "14px 32px", fontSize: 15 }}>
              See Our Work
            </Link>
          </motion.div>
        </div>
      </HeroHighlight>

      {/* ── TRUSTED BY ── */}
      <section style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", padding: "40px 0", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
          <div className="text-center mb-6" style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Trusted by growing teams
          </div>
          <div className="flex justify-center items-center gap-12 flex-wrap opacity-30">
            {["TechScale", "DataFlow", "NovaBridge", "Meridian AI", "CloudPeak", "SynapseHQ"].map((name) => (
              <span key={name} style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="section" style={{ paddingTop: 100, paddingBottom: 100 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {[
            { target: 50, suffix: "+", label: "AI systems deployed" },
            { target: 98, suffix: "%", label: "Client retention" },
            { target: 10, suffix: "x", label: "Avg. ROI for clients" },
            { target: 14, suffix: " days", label: "To first working demo" },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="stat-number">
                  <Counter target={s.target} suffix={s.suffix} duration={2} />
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
            <div className="section-tag">What We Build</div>
            <h2 className="section-title mx-auto" style={{ textAlign: "center", maxWidth: 600 }}>
              AI automation that pays for itself
            </h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center", maxWidth: 560 }}>
              Every service is designed to deliver measurable ROI. If it doesn&apos;t save you time or money, we don&apos;t build it.
            </p>
          </div>
        </FadeIn>

        <div className="grid-3" style={{ gap: 16 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div className="glass-card group" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div
                  className="service-icon"
                  style={{
                    background: s.gradient,
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  }}
                >
                  {s.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ letterSpacing: "-0.02em" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-2)", flex: 1 }}>
                  {s.desc}
                </p>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#F5B731",
                  background: "rgba(245,183,49,0.1)", padding: "6px 12px",
                  borderRadius: 6, display: "inline-block", width: "fit-content",
                }}>
                  {s.result}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── SCROLL DASHBOARD ── */}
      <section style={{ background: "var(--bg)" }}>
        <ContainerScroll
          titleComponent={
            <div>
              <p className="section-tag mb-4">See It In Action</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ letterSpacing: "-0.035em", color: "var(--text-1)" }}>
                Real-time AI dashboards
                <br />
                <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  that run your ops
                </span>
              </h2>
            </div>
          }
        >
          <div className="h-full w-full bg-gradient-to-br from-[#0a0a1a] to-[#1a1040] flex items-center justify-center rounded-2xl p-8">
            <div className="w-full max-w-2xl space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Tickets Resolved by AI</div>
                  <div className="text-3xl font-bold" style={{ background: "linear-gradient(135deg, #F5B731, #F0D060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>847</div>
                  <div className="text-xs text-emerald-400 mt-1">↑ 23% this week</div>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Avg Response Time</div>
                  <div className="text-3xl font-bold text-[#E87B35]">1.2s</div>
                  <div className="text-xs text-emerald-400 mt-1">↓ from 4.5min</div>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Hours Saved</div>
                  <div className="text-3xl font-bold text-[#fd79a8]">312</div>
                  <div className="text-xs text-white/30 mt-1">this month</div>
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 h-40 flex items-end gap-2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${20 + Math.sin(i * 0.4) * 20 + (i / 24) * 40 + Math.random() * 10}%`,
                      background: `linear-gradient(to top, rgba(108,92,231,0.7), rgba(0,206,201,0.3))`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ── PROCESS — Sticky Scroll ── */}
      <section className="section">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="section-tag">How It Works</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>From call to launch in weeks</h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center" }}>
              No 6-month timelines. No scope creep. A clear, fast process designed for results.
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
            <h2 className="section-title" style={{ textAlign: "center" }}>Don&apos;t take our word for it</h2>
          </div>
        </FadeIn>
        <div className="grid-3">
          {testimonials.map((t, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ fontSize: 24, marginBottom: 16, opacity: 0.3 }}>&ldquo;</div>
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
      <section className="section">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="section-tag">Pricing</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>Simple, transparent pricing</h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center" }}>
              Fixed price. No hourly billing. No surprises. You know exactly what you&apos;re paying before we start.
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
                  boxShadow: p.popular ? "0 0 40px rgba(245,183,49,0.08)" : undefined,
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
                    Popular
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>{p.name}</div>
                <div style={{
                  fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 4,
                  background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {p.price}
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

      {/* ── CTA ── */}
      <section className="section" style={{ textAlign: "center" }}>
        <FadeIn>
          <div style={{ position: "relative", padding: "80px 40px", borderRadius: 24, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #F5B731, #E87B35)", opacity: 0.06 }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 600, height: 600, borderRadius: "50%", background: "#F5B731", filter: "blur(180px)", opacity: 0.08,
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ letterSpacing: "-0.035em" }}>
                Stop doing manually what
                <br />AI can do in seconds
              </h2>
              <p className="text-base mb-9 max-w-[500px] mx-auto" style={{ color: "var(--text-2)" }}>
                Book a free 30-minute call. We&apos;ll identify your top 3 automation opportunities — no strings attached.
              </p>
              <Link href="/contact" className="btn-primary" style={{ padding: "16px 40px", fontSize: 16, background: "#F5B731", color: "#0a0a0f" }}>
                Book Your Free Call →
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
