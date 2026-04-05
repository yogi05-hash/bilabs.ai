"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { StickyScroll } from "@/components/ui/sticky-scroll-reveal";

const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const services = [
  {
    icon: "🧠",
    title: "AI Strategy & Consulting",
    desc: "We assess your operations and design an AI roadmap that delivers real ROI — not just buzzwords.",
    gradient: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(108,92,231,0.05))",
  },
  {
    icon: "⚡",
    title: "Custom Model Development",
    desc: "Purpose-built machine learning models trained on your data, optimized for your specific use cases.",
    gradient: "linear-gradient(135deg, rgba(0,206,201,0.15), rgba(0,206,201,0.05))",
  },
  {
    icon: "🔗",
    title: "AI Integration & Automation",
    desc: "Seamlessly embed AI into your existing tech stack. APIs, pipelines, and intelligent workflows.",
    gradient: "linear-gradient(135deg, rgba(253,121,168,0.15), rgba(253,121,168,0.05))",
  },
];

const stats = [
  { num: "50+", label: "Projects delivered" },
  { num: "3x", label: "Avg. efficiency gain" },
  { num: "98%", label: "Client retention" },
  { num: "<2wk", label: "Time to first prototype" },
];

const processContent = [
  {
    title: "Discovery & Strategy",
    description:
      "We start by deeply understanding your business, data landscape, and goals. Through collaborative workshops, we identify the highest-impact AI opportunities and build a prioritized roadmap.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-lg font-semibold">Discovery</div>
        </div>
      </div>
    ),
  },
  {
    title: "Design & Architecture",
    description:
      "Our engineers architect the solution — selecting the right models, designing data pipelines, and mapping integration points. Every decision is documented and validated with your team.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4">📐</div>
          <div className="text-lg font-semibold">Architecture</div>
        </div>
      </div>
    ),
  },
  {
    title: "Build & Iterate",
    description:
      "Rapid prototyping with weekly demos. You see working software from week one. We iterate based on real feedback, not assumptions, until the solution meets your exact needs.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4">🛠️</div>
          <div className="text-lg font-semibold">Development</div>
        </div>
      </div>
    ),
  },
  {
    title: "Deploy & Scale",
    description:
      "Production deployment with monitoring, auto-scaling, and ongoing support. We don't just hand off code — we ensure your AI systems perform reliably at scale.",
    content: (
      <div className="h-full w-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-5xl mb-4">🚀</div>
          <div className="text-lg font-semibold">Production</div>
        </div>
      </div>
    ),
  },
];

const testimonials = [
  {
    text: "bilabs.ai transformed our customer support with an AI system that reduced response times by 80%. The team understood our needs from day one.",
    author: "Sarah Chen",
    role: "VP of Operations, TechScale",
  },
  {
    text: "They didn't just build us a model — they built us a competitive advantage. Our forecasting accuracy improved by 40% within the first quarter.",
    author: "Marcus Reid",
    role: "CEO, DataFlow Analytics",
  },
  {
    text: "The team at bilabs.ai shipped our first AI prototype in 10 days. We've never worked with an agency this fast and this good.",
    author: "Anika Patel",
    role: "CTO, NovaBridge",
  },
];

export default function Home() {
  return (
    <>
      {/* ── HERO — Interactive dot grid + 3D scene ── */}
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
            <div className="section-tag">AI-Powered Innovation</div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-[700px] mb-6"
            style={{ letterSpacing: "-0.04em" }}
          >
            We build the AI{" "}
            <Highlight className="!from-[#6c5ce7] !to-[#00cec9]">
              that builds your future
            </Highlight>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <TextGenerateEffect
              words="From strategy to deployment, we design and build custom AI systems that give your business a genuine competitive edge."
              className="!text-lg !font-normal max-w-[520px] mb-10 [&_div]:!text-lg [&_span]:!text-[rgba(240,240,245,0.6)]"
              duration={0.3}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex gap-3"
          >
            <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15 }}>
              Book a Demo
            </Link>
            <Link href="/services" className="btn-secondary" style={{ padding: "14px 32px", fontSize: 15 }}>
              View Services
            </Link>
          </motion.div>
        </div>
      </HeroHighlight>

      {/* ── STATS ── */}
      <section className="section" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {stats.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">What We Do</div>
          <h2 className="section-title">End-to-end AI solutions</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            We handle the full lifecycle — from identifying opportunities to deploying production-grade AI systems.
          </p>
        </FadeIn>

        <div className="grid-3">
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.15}>
              <div className="glass-card" style={{ height: "100%" }}>
                <div className="service-icon" style={{ background: s.gradient }}>
                  {s.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ letterSpacing: "-0.02em" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {s.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── SCROLL DASHBOARD — Container Scroll Animation ── */}
      <section style={{ background: "var(--bg)" }}>
        <ContainerScroll
          titleComponent={
            <div>
              <p className="section-tag mb-4">See It In Action</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ letterSpacing: "-0.035em", color: "var(--text-1)" }}>
                AI dashboards that
                <br />
                <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  actually make sense
                </span>
              </h2>
            </div>
          }
        >
          <div className="h-full w-full bg-gradient-to-br from-[#0a0a1a] to-[#1a1040] flex items-center justify-center rounded-2xl p-8">
            <div className="w-full max-w-2xl space-y-6">
              {/* fake dashboard UI */}
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Model Accuracy</div>
                  <div className="text-3xl font-bold" style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>97.3%</div>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Avg Latency</div>
                  <div className="text-3xl font-bold text-[#00cec9]">23ms</div>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-5">
                  <div className="text-xs text-white/40 mb-2">Requests/min</div>
                  <div className="text-3xl font-bold text-[#fd79a8]">12.4k</div>
                </div>
              </div>
              {/* chart placeholder */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 h-40 flex items-end gap-2">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${30 + Math.sin(i * 0.5) * 25 + Math.random() * 20}%`,
                      background: `linear-gradient(to top, rgba(108,92,231,0.6), rgba(0,206,201,0.3))`,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4 h-20" />
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4 h-20" />
              </div>
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ── PROCESS — Sticky Scroll ── */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">Our Process</div>
          <h2 className="section-title">How we work</h2>
          <p className="section-subtitle" style={{ marginBottom: 40 }}>
            A proven four-step framework that minimizes risk and maximizes impact.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <StickyScroll content={processContent} />
        </FadeIn>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">Client Stories</div>
          <h2 className="section-title">Trusted by ambitious teams</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            Real impact, real results. Here&apos;s what our partners have to say.
          </p>
        </FadeIn>

        <div className="grid-3">
          {testimonials.map((t, i) => (
            <FadeIn key={i} delay={i * 0.12}>
              <div className="glass-card">
                <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
                <div className="testimonial-author">{t.author}</div>
                <div className="testimonial-role">{t.role}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section" style={{ textAlign: "center" }}>
        <FadeIn>
          <div style={{ position: "relative", padding: "80px 40px", borderRadius: 24, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "var(--accent-gradient)", opacity: 0.06 }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 500, height: 500, borderRadius: "50%", background: "#6c5ce7", filter: "blur(150px)", opacity: 0.08,
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2 className="text-4xl font-bold mb-4" style={{ letterSpacing: "-0.035em" }}>
                Ready to build with AI?
              </h2>
              <p className="text-base mb-9 max-w-[480px] mx-auto" style={{ color: "var(--text-2)" }}>
                Let&apos;s discuss how AI can transform your business. No pitch decks — just a real conversation.
              </p>
              <Link href="/contact" className="btn-primary" style={{ padding: "14px 36px", fontSize: 15 }}>
                Get in Touch
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
