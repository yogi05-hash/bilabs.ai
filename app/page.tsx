"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";

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
];

export default function Home() {
  return (
    <>
      {/* ── hero ── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
        {/* background glows */}
        <div style={{
          position: "absolute", top: "-20%", left: "30%", width: 600, height: 600,
          borderRadius: "50%", background: "var(--accent)", filter: "blur(200px)", opacity: 0.08,
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "20%", width: 500, height: 500,
          borderRadius: "50%", background: "var(--accent-2)", filter: "blur(200px)", opacity: 0.06,
        }} />

        <HeroScene />

        <div style={{ position: "relative", zIndex: 1, padding: "0 40px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
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
            style={{
              fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05,
              maxWidth: 700, marginBottom: 24,
            }}
          >
            We build the AI
            <br />
            <span style={{
              background: "var(--accent-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              that builds your future
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ fontSize: 18, color: "var(--text-2)", maxWidth: 520, lineHeight: 1.6, marginBottom: 40 }}
          >
            From strategy to deployment, we design and build custom AI systems
            that give your business a genuine competitive edge.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ display: "flex", gap: 12 }}
          >
            <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15 }}>
              Book a Demo
            </Link>
            <Link href="/services" className="btn-secondary" style={{ padding: "14px 32px", fontSize: 15 }}>
              View Services
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── stats ── */}
      <section className="section" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40 }}>
          {stats.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div style={{ textAlign: "center" }}>
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── services ── */}
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
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>
                  {s.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── testimonials ── */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">Client Stories</div>
          <h2 className="section-title">Trusted by ambitious teams</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            Real impact, real results. Here&apos;s what our partners have to say.
          </p>
        </FadeIn>

        <div className="grid-2">
          {testimonials.map((t, i) => (
            <FadeIn key={i} delay={i * 0.15}>
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
            <div style={{
              position: "absolute", inset: 0, background: "var(--accent-gradient)", opacity: 0.08,
            }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 500, height: 500, borderRadius: "50%", background: "var(--accent)", filter: "blur(150px)", opacity: 0.1,
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.035em", marginBottom: 16 }}>
                Ready to build with AI?
              </h2>
              <p style={{ fontSize: 17, color: "var(--text-2)", marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
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
