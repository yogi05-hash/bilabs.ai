"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { LampContainer } from "@/components/ui/lamp";

const services = [
  {
    icon: "💬",
    title: "AI Chatbots & Support Agents",
    desc: "Custom-trained chatbots that handle customer inquiries, resolve tickets, and escalate intelligently. Integrates with your helpdesk, CRM, and knowledge base.",
    features: ["Trained on your docs & FAQs", "Multi-channel (web, WhatsApp, Slack)", "Smart escalation to humans", "Analytics & conversation insights"],
    result: "80% ticket deflection",
    gradient: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(108,92,231,0.05))",
  },
  {
    icon: "⚙️",
    title: "Workflow Automation",
    desc: "End-to-end automation of repetitive tasks. Email triage, data entry, report generation, invoice processing — AI handles it while you focus on what matters.",
    features: ["Email classification & routing", "Auto data extraction from documents", "Scheduled report generation", "Multi-step approval workflows"],
    result: "40+ hours saved per week",
    gradient: "linear-gradient(135deg, rgba(0,206,201,0.15), rgba(0,206,201,0.05))",
  },
  {
    icon: "📞",
    title: "AI Voice Agents",
    desc: "AI that picks up the phone. Appointment booking, lead qualification, outbound campaigns, and inbound support — natural conversation that converts.",
    features: ["Natural language phone calls", "Appointment booking & reminders", "Lead qualification scripts", "CRM auto-logging"],
    result: "3x lead conversion",
    gradient: "linear-gradient(135deg, rgba(253,121,168,0.15), rgba(253,121,168,0.05))",
  },
  {
    icon: "✍️",
    title: "AI Content Engine",
    desc: "Generate blog posts, social media content, ad copy, and email campaigns — all in your brand voice. Human reviews, AI produces.",
    features: ["Brand voice training", "Multi-format output (blog, social, email)", "SEO optimization built-in", "Content calendar automation"],
    result: "10x content output",
    gradient: "linear-gradient(135deg, rgba(253,203,110,0.15), rgba(253,203,110,0.05))",
  },
  {
    icon: "📊",
    title: "AI Analytics & Insights",
    desc: "Ask your data questions in plain English. Real-time dashboards with predictive analytics that surface insights before you think to look for them.",
    features: ["Natural language querying", "Predictive trend detection", "Automated anomaly alerts", "Custom dashboard builder"],
    result: "Decisions in seconds",
    gradient: "linear-gradient(135deg, rgba(116,185,255,0.15), rgba(116,185,255,0.05))",
  },
  {
    icon: "🔌",
    title: "Custom AI Integrations",
    desc: "We connect AI to the tools you already use. Salesforce, HubSpot, Slack, Shopify, Zapier, custom APIs — seamless, zero disruption.",
    features: ["Any CRM / ERP integration", "API development & webhooks", "Data sync & migration", "Custom middleware"],
    result: "Works with your stack",
    gradient: "linear-gradient(135deg, rgba(85,239,196,0.15), rgba(85,239,196,0.05))",
  },
];

export default function ServicesPage() {
  return (
    <div>
      <LampContainer className="!min-h-[70vh] !bg-[#050507]">
        <motion.div
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="text-center"
        >
          <div className="section-tag mb-4">Our Services</div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-slate-200 to-slate-400 bg-clip-text text-transparent">
            AI automation that
            <br />
            pays for itself
          </h1>
          <p className="text-base mt-6 max-w-lg mx-auto" style={{ color: "var(--text-2)" }}>
            Every service is designed to deliver measurable ROI. Fixed pricing. No fluff.
          </p>
          <Link href="/contact" className="btn-primary inline-block mt-8" style={{ background: "#F5B731", color: "#0a0a0f", padding: "12px 28px" }}>
            Book a Free Call
          </Link>
        </motion.div>
      </LampContainer>

      <section className="section" style={{ paddingTop: 80 }}>
        <div className="grid-2" style={{ gap: 24 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div className="glass-card" style={{ height: "100%" }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="service-icon" style={{ background: s.gradient, marginBottom: 0 }}>{s.icon}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "#F5B731",
                    background: "rgba(245,183,49,0.1)", padding: "4px 10px",
                    borderRadius: 6,
                  }}>
                    {s.result}
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ letterSpacing: "-0.02em" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-2)" }}>
                  {s.desc}
                </p>
                <ul className="flex flex-col gap-2">
                  {s.features.map((f, j) => (
                    <li key={j} className="text-sm flex items-center gap-2" style={{ color: "var(--text-2)" }}>
                      <span className="w-[5px] h-[5px] rounded-full bg-[#F5B731] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="section">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="section-tag">Simple Process</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>Call → Proposal → Build → Launch</h2>
            <p className="section-subtitle mx-auto" style={{ textAlign: "center" }}>
              Most projects go from first call to production in 2-4 weeks.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "01", title: "Free Call", desc: "30 minutes. We identify your top automation opportunities.", time: "Day 0" },
            { step: "02", title: "Proposal", desc: "Fixed-price proposal with clear scope and timeline.", time: "48 hours" },
            { step: "03", title: "Build", desc: "Weekly demos. You see working software from week one.", time: "1-3 weeks" },
            { step: "04", title: "Launch", desc: "Production deployment + 30 days of free support.", time: "Go live" },
          ].map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card text-center">
                <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{p.time}</div>
                <div className="text-3xl font-bold mb-3" style={{
                  background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>{p.step}</div>
                <h4 className="text-base font-semibold mb-2">{p.title}</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="section text-center">
        <FadeIn>
          <h2 className="text-4xl font-bold mb-4" style={{ letterSpacing: "-0.03em" }}>
            Ready to automate?
          </h2>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--text-2)" }}>
            Free 30-minute call. We&apos;ll map out your automation roadmap — whether you work with us or not.
          </p>
          <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15, background: "#F5B731", color: "#0a0a0f" }}>
            Book Your Free Call →
          </Link>
        </FadeIn>
      </section>
    </div>
  );
}
