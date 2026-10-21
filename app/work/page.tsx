"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

/* /work — the things we have actually built and shipped, plus a live demo
 * anyone can run.
 *
 * Claims here are deliberately thin. The previous homepage version of this
 * section said YourBotChat was "used by 1,200+ businesses"; its database
 * holds twelve accounts. Anything we cannot count, we do not say. */

const VideoMaker = dynamic(() => import("@/components/VideoMaker"), { ssr: false });

const PRODUCTS = [
  {
    name: "YourBotChat",
    url: "https://yourbotchat.com",
    tagline: "An AI receptionist from your website address",
    description:
      "Paste a website and it reads the pages, then answers customers 24/7 on the site, a shareable link or a QR code — and emails the business every enquiry. Also publishes a structured public profile that AI assistants can read.",
    features: ["Reads your site in about 2 minutes", "Answers only from your facts", "Lead capture + email alerts", "Public AI profile"],
    gradient: "linear-gradient(135deg, #F5B731, #E87B35)",
  },
  {
    name: "ReelMakerBot",
    url: "https://reelmakerbot.com",
    tagline: "A selfie becomes a cinematic reel, over WhatsApp",
    description:
      "Send a photo on WhatsApp, pick a style, and get a vertical reel back. Built for Telugu, Hindi and English speakers, with the whole flow running inside the chat.",
    features: ["WhatsApp-first", "Kling video pipeline", "Telugu · Hindi · English", "First reel free"],
    gradient: "linear-gradient(135deg, #E8430A, #FF5A1F)",
  },
  {
    name: "Showbizy",
    url: "https://showbizy.ai",
    tagline: "AI creative projects and talent",
    description:
      "A platform for creative projects and the people who staff them, with matching and booking handled in the product.",
    features: ["Project workspace", "Talent matching", "Booking flow", "Stripe checkout"],
    gradient: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
  },
];

export default function WorkPage() {
  return (
    <div style={{ paddingTop: 70 }}>
      <section className="section" style={{ paddingTop: 70, paddingBottom: 70 }}>
        <FadeIn>
          <div className="section-tag">Our work</div>
          <h1 className="section-title" style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}>
            Products we built, shipped and run.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-2)", maxWidth: 640, marginTop: 14 }}>
            We are not describing capability in the abstract. These are live products with real customers, built by
            the same people who would build yours.
          </p>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 44 }}>
          {PRODUCTS.map((p, i) => (
            <FadeIn key={p.name} delay={i * 0.08}>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="glass-card ask-card" style={{ padding: 28, height: "100%", display: "block", position: "relative", overflow: "hidden" }}>
                <span aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: p.gradient }} />
                <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>{p.name}</h2>
                <p style={{ fontSize: 14.5, color: "var(--accent)", margin: "6px 0 0", fontWeight: 600 }}>{p.tagline}</p>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-2)", margin: "14px 0 0" }}>{p.description}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexDirection: "column", gap: 9 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--text-2)" }}>
                      <span style={{ color: "var(--accent)" }}>✓</span><span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="ask-hint">Visit {p.name} →</p>
              </a>
            </FadeIn>
          ))}
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--border-strong)" }}>
        <div className="section" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <FadeIn>
            <div className="section-tag">Live demo</div>
            <h2 className="section-title">Type two lines. Get a video.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-2)", maxWidth: 620, margin: "14px 0 36px" }}>
              This runs for real, right now, on this page — the same kind of pipeline we build into clients&apos;
              products.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}><VideoMaker /></FadeIn>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--border-strong)" }}>
        <div className="section" style={{ paddingTop: 70, paddingBottom: 90, textAlign: "center" }}>
          <FadeIn>
            <h2 className="section-title" style={{ margin: "0 auto" }}>Want this for your business?</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 28 }}>
              <Link href="/#check" className="btn-primary" style={{ padding: "15px 30px", fontSize: 15 }}>Run the free AI check</Link>
              <Link href="/#packages" className="btn-secondary" style={{ padding: "15px 30px", fontSize: 15 }}>See the packages</Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
