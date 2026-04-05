"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import FadeIn from "@/components/FadeIn";

export default function ContactPage() {
  const [formType, setFormType] = useState<"contact" | "demo">("contact");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div style={{ paddingTop: 64 }}>
      <section className="section">
        <div className="grid-2" style={{ gap: 80, alignItems: "start" }}>
          {/* left side */}
          <FadeIn>
            <div className="section-tag">Get in Touch</div>
            <h1 className="section-title" style={{ fontSize: 48 }}>
              Let&apos;s build something
              <br />
              <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                extraordinary
              </span>
            </h1>
            <p style={{ fontSize: 16, color: "var(--text-2)", lineHeight: 1.7, marginBottom: 48 }}>
              Whether you have a specific project in mind or just want to explore
              what AI can do for your business — we&apos;d love to hear from you.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { label: "Email", value: "hello@bilabs.ai" },
                { label: "Response time", value: "Usually within 24 hours" },
                { label: "Location", value: "San Francisco, CA — working globally" },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 15, color: "var(--text-1)" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* right side — form */}
          <FadeIn delay={0.2}>
            <div className="glass-card" style={{ padding: 36 }}>
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: "center", padding: "40px 0" }}
                >
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Message sent</h3>
                  <p style={{ fontSize: 14, color: "var(--text-2)" }}>
                    We&apos;ll get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="btn-secondary"
                    style={{ marginTop: 24 }}
                  >
                    Send another
                  </button>
                </motion.div>
              ) : (
                <>
                  {/* tab toggle */}
                  <div style={{
                    display: "flex", gap: 1, background: "var(--border)", borderRadius: 10,
                    overflow: "hidden", marginBottom: 28,
                  }}>
                    {(["contact", "demo"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFormType(t)}
                        style={{
                          flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                          fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                          background: formType === t ? "var(--bg-card-hover)" : "var(--bg-card)",
                          color: formType === t ? "var(--text-1)" : "var(--text-3)",
                          transition: "background 0.15s ease, color 0.15s ease",
                        }}
                      >
                        {t === "contact" ? "General Inquiry" : "Book a Demo"}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label">First name</label>
                        <input type="text" className="form-input" placeholder="Jane" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last name</label>
                        <input type="text" className="form-input" placeholder="Doe" required />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Work email</label>
                      <input type="email" className="form-input" placeholder="jane@company.com" required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Company</label>
                      <input type="text" className="form-input" placeholder="Company name" />
                    </div>

                    {formType === "demo" && (
                      <>
                        <div className="form-group">
                          <label className="form-label">What are you interested in?</label>
                          <select className="form-select">
                            <option value="">Select a service</option>
                            <option>AI Strategy & Consulting</option>
                            <option>Custom Model Development</option>
                            <option>AI Integration & Automation</option>
                            <option>Data Engineering</option>
                            <option>MLOps & Deployment</option>
                            <option>Not sure yet</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Team size</label>
                          <select className="form-select">
                            <option value="">Select range</option>
                            <option>1-10</option>
                            <option>11-50</option>
                            <option>51-200</option>
                            <option>200+</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <label className="form-label">
                        {formType === "demo" ? "Tell us about your project" : "Message"}
                      </label>
                      <textarea
                        className="form-textarea"
                        placeholder={
                          formType === "demo"
                            ? "What challenge are you trying to solve? Any relevant context helps..."
                            : "How can we help?"
                        }
                        required
                      />
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px 0", fontSize: 14, marginTop: 4 }}>
                      {formType === "demo" ? "Request a Demo" : "Send Message"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
