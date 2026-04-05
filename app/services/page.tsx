"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { LampContainer } from "@/components/ui/lamp";

const services = [
  {
    icon: "🧠",
    title: "AI Strategy & Consulting",
    desc: "We audit your operations and data landscape to identify the highest-impact AI opportunities. You get a prioritized roadmap with clear timelines, resource needs, and expected ROI.",
    features: ["AI readiness assessment", "Opportunity mapping", "Technology stack recommendations", "Implementation roadmap"],
    gradient: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(108,92,231,0.05))",
  },
  {
    icon: "⚡",
    title: "Custom Model Development",
    desc: "Purpose-built machine learning and deep learning models trained on your data. From NLP and computer vision to predictive analytics — we build models that perform in the real world.",
    features: ["Data pipeline design", "Model training & fine-tuning", "LLM customization", "Performance benchmarking"],
    gradient: "linear-gradient(135deg, rgba(0,206,201,0.15), rgba(0,206,201,0.05))",
  },
  {
    icon: "🔗",
    title: "AI Integration & Automation",
    desc: "We embed AI directly into your existing workflows and tech stack. APIs, real-time pipelines, and intelligent automation that works with what you already have.",
    features: ["API development", "Workflow automation", "Real-time inference pipelines", "Legacy system integration"],
    gradient: "linear-gradient(135deg, rgba(253,121,168,0.15), rgba(253,121,168,0.05))",
  },
  {
    icon: "📊",
    title: "Data Engineering",
    desc: "Clean data is the foundation of every AI system. We design and build the data infrastructure that makes your AI efforts possible and sustainable.",
    features: ["Data warehouse design", "ETL pipeline development", "Data quality frameworks", "Real-time streaming"],
    gradient: "linear-gradient(135deg, rgba(255,159,10,0.15), rgba(255,159,10,0.05))",
  },
  {
    icon: "🛡️",
    title: "AI Governance & Safety",
    desc: "Responsible AI isn't optional. We help you build systems with proper monitoring, bias detection, and compliance frameworks baked in from day one.",
    features: ["Bias detection & mitigation", "Model monitoring", "Compliance frameworks", "Explainability tooling"],
    gradient: "linear-gradient(135deg, rgba(48,209,88,0.15), rgba(48,209,88,0.05))",
  },
  {
    icon: "🚀",
    title: "MLOps & Deployment",
    desc: "Getting a model to production is where most teams struggle. We handle the infrastructure, CI/CD, monitoring, and scaling so your models actually ship.",
    features: ["Model serving infrastructure", "CI/CD for ML", "A/B testing frameworks", "Auto-scaling & optimization"],
    gradient: "linear-gradient(135deg, rgba(100,210,255,0.15), rgba(100,210,255,0.05))",
  },
];

export default function ServicesPage() {
  return (
    <div>
      {/* Lamp hero */}
      <LampContainer className="!min-h-[70vh] !bg-[#050507]">
        <motion.div
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="text-center"
        >
          <div className="section-tag mb-4">Our Services</div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-slate-200 to-slate-400 bg-clip-text text-transparent">
            Everything you need to
            <br />
            ship AI that works
          </h1>
          <p className="text-base mt-6 max-w-lg mx-auto" style={{ color: "var(--text-2)" }}>
            From the first whiteboard session to a model running in production — we cover the full stack.
          </p>
        </motion.div>
      </LampContainer>

      {/* services grid */}
      <section className="section" style={{ paddingTop: 80 }}>
        <div className="grid-2" style={{ gap: 24 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card" style={{ height: "100%" }}>
                <div className="service-icon" style={{ background: s.gradient }}>{s.icon}</div>
                <h3 className="text-xl font-semibold mb-2" style={{ letterSpacing: "-0.02em" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-2)" }}>
                  {s.desc}
                </p>
                <ul className="flex flex-col gap-2">
                  {s.features.map((f, j) => (
                    <li key={j} className="text-sm flex items-center gap-2" style={{ color: "var(--text-2)" }}>
                      <span className="w-[5px] h-[5px] rounded-full bg-[#6c5ce7] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* process steps */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">How We Work</div>
          <h2 className="section-title">Our process</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            A proven framework that minimizes risk and maximizes impact.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[
            { step: "01", title: "Discover", desc: "We learn your business, data, and goals through deep-dive workshops." },
            { step: "02", title: "Design", desc: "We architect the solution — models, pipelines, and integration points." },
            { step: "03", title: "Build", desc: "Rapid prototyping with weekly demos. You see progress from week one." },
            { step: "04", title: "Deploy", desc: "Production deployment with monitoring, scaling, and ongoing support." },
          ].map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card text-center">
                <div
                  className="text-4xl font-bold mb-3"
                  style={{
                    letterSpacing: "-0.04em",
                    background: "var(--accent-gradient)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {p.step}
                </div>
                <h4 className="text-base font-semibold mb-2">{p.title}</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section text-center">
        <FadeIn>
          <h2 className="text-4xl font-bold mb-4" style={{ letterSpacing: "-0.03em" }}>
            Have a project in mind?
          </h2>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--text-2)" }}>
            Let&apos;s talk about how we can help. Free consultation, no strings attached.
          </p>
          <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15 }}>
            Start a Conversation
          </Link>
        </FadeIn>
      </section>
    </div>
  );
}
