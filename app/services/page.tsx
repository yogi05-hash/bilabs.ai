"use client";

import Link from "next/link";
import FadeIn from "@/components/FadeIn";

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
    <div style={{ paddingTop: 64 }}>
      {/* hero */}
      <section className="section" style={{ paddingBottom: 60 }}>
        <FadeIn>
          <div className="section-tag">Our Services</div>
          <h1 className="section-title" style={{ fontSize: 56 }}>
            Everything you need to
            <br />
            <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ship AI that works
            </span>
          </h1>
          <p className="section-subtitle">
            From the first whiteboard session to a model running in production — we cover the full stack.
          </p>
        </FadeIn>
      </section>

      {/* services grid */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="grid-2" style={{ gap: 24 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card" style={{ height: "100%" }}>
                <div className="service-icon" style={{ background: s.gradient }}>{s.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, marginBottom: 20 }}>
                  {s.desc}
                </p>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.features.map((f, j) => (
                    <li key={j} style={{ fontSize: 13, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* process */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">How We Work</div>
          <h2 className="section-title">Our process</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            A proven framework that minimizes risk and maximizes impact.
          </p>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {[
            { step: "01", title: "Discover", desc: "We learn your business, data, and goals through deep-dive workshops." },
            { step: "02", title: "Design", desc: "We architect the solution — models, pipelines, and integration points." },
            { step: "03", title: "Build", desc: "Rapid prototyping with weekly demos. You see progress from week one." },
            { step: "04", title: "Deploy", desc: "Production deployment with monitoring, scaling, and ongoing support." },
          ].map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card" style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em",
                  background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  marginBottom: 12,
                }}>
                  {p.step}
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{p.title}</h4>
                <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: "center" }}>
        <FadeIn>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
            Have a project in mind?
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-2)", marginBottom: 32, maxWidth: 440, margin: "0 auto 32px" }}>
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
