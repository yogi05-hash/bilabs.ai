"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { LampContainer } from "@/components/ui/lamp";

const services = [
  {
    icon: "⚙️",
    title: "AI Workflow Automation",
    price: "£149 setup + £49/mo",
    desc: "We connect your tools and automate the repetitive stuff — email triage, data entry, report generation, invoice processing, CRM updates.",
    features: ["Email classification & auto-routing", "Auto data extraction from documents", "Scheduled report generation", "Multi-tool workflow chains"],
    result: "Save 20+ hours/week",
  },
  {
    icon: "✍️",
    title: "AI Content Engine",
    price: "£99/mo",
    desc: "30 social media posts + 4 blog articles per month, written in your brand voice. We train the AI on your content, you review and publish.",
    features: ["Brand voice training", "30 social posts + 4 blogs monthly", "SEO-optimised blog content", "Content calendar included"],
    result: "10x your content output",
  },
  {
    icon: "📞",
    title: "AI Voice Agent",
    price: "£299 setup + £79/mo",
    desc: "An AI receptionist that handles inbound calls, books appointments, qualifies leads, and answers FAQs — 24/7.",
    features: ["Natural phone conversations", "Appointment booking & reminders", "Lead qualification scripts", "CRM auto-logging"],
    result: "Never miss a call again",
  },
  {
    icon: "🎯",
    title: "AI Lead Generation",
    price: "£149/mo",
    desc: "AI that finds your ideal customers online, scrapes their contact details, qualifies them, and sends personalised outreach — on autopilot.",
    features: ["Ideal customer profile targeting", "Contact scraping & enrichment", "Automated personalised outreach", "Lead scoring & qualification"],
    result: "Leads while you sleep",
  },
  {
    icon: "🔌",
    title: "Custom AI Solutions",
    price: "From £999",
    desc: "Bespoke AI automations tailored to your exact needs. CRM integrations, internal tools, data pipelines, custom dashboards.",
    features: ["Fully bespoke development", "Any tool/API integration", "Dedicated project manager", "Ongoing maintenance available"],
    result: "Built exactly for you",
  },
  {
    icon: "💬",
    title: "AI Chatbots",
    price: "From £29/mo",
    desc: "Need a chatbot? Visit yourbotchat.com — our dedicated platform. Simple setup, trained on your docs, handles queries 24/7.",
    features: ["5-minute setup", "Trained on your content", "Multi-language support", "Analytics dashboard"],
    result: "Via yourbotchat.com",
    link: "https://yourbotchat.com",
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
          <div className="section-tag mb-4">Services &amp; Pricing</div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-slate-200 to-slate-400 bg-clip-text text-transparent">
            AI automation that
            <br />
            pays for itself in month one
          </h1>
          <p className="text-base mt-6 max-w-lg mx-auto" style={{ color: "var(--text-2)" }}>
            No massive contracts. No risk. Start from £99/mo and cancel anytime.
          </p>
          <Link href="/contact" className="btn-primary inline-block mt-8" style={{ background: "#F5B731", color: "#0a0a0f", padding: "12px 28px" }}>
            Free AI Audit Call →
          </Link>
        </motion.div>
      </LampContainer>

      <section className="section" style={{ paddingTop: 80 }}>
        <div className="grid-2" style={{ gap: 24 }}>
          {services.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div className="glass-card" style={{ height: "100%" }}>
                <div className="flex items-start justify-between mb-2">
                  <div style={{ fontSize: 28 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#F5B731", background: "rgba(245,183,49,0.1)", padding: "4px 10px", borderRadius: 6 }}>
                    {s.result}
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
                <div style={{ fontSize: 15, color: "#F5B731", fontWeight: 700, marginBottom: 12 }}>{s.price}</div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-2)" }}>{s.desc}</p>
                <ul className="flex flex-col gap-2">
                  {s.features.map((f, j) => (
                    <li key={j} className="text-sm flex items-center gap-2" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "#F5B731", fontSize: 12 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block mt-5" style={{ background: "#F5B731", color: "#0a0a0f", padding: "8px 18px", fontSize: 13 }}>
                    Visit yourbotchat.com →
                  </a>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="section">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="section-tag">How It Works</div>
            <h2 className="section-title" style={{ textAlign: "center" }}>Free call → Live in days</h2>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "01", title: "Free Audit", desc: "15-min call. We find your biggest time-wasters.", time: "Book now" },
            { step: "02", title: "Pick & Pay", desc: "Choose a service. Fixed price, no surprises.", time: "Same day" },
            { step: "03", title: "We Build It", desc: "Live within 3-5 days. You test, we iterate.", time: "3-5 days" },
            { step: "04", title: "You Save Hours", desc: "See the ROI. Then add more automations.", time: "Ongoing" },
          ].map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card text-center">
                <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{p.time}</div>
                <div className="text-3xl font-bold mb-3" style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{p.step}</div>
                <h4 className="text-base font-semibold mb-2">{p.title}</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="section text-center">
        <FadeIn>
          <h2 className="text-4xl font-bold mb-4" style={{ letterSpacing: "-0.03em" }}>Ready to stop wasting time?</h2>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: "var(--text-2)" }}>
            Free 15-minute AI audit — no commitment.
          </p>
          <Link href="/contact" className="btn-primary" style={{ padding: "14px 32px", fontSize: 15, background: "#F5B731", color: "#0a0a0f" }}>
            Book Your Free Audit →
          </Link>
        </FadeIn>
      </section>
    </div>
  );
}
