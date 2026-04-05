"use client";

import FadeIn from "@/components/FadeIn";

const team = [
  { name: "Alex Kim", role: "CEO & Co-founder", bio: "Previously ML lead at Google Brain. 12+ years in AI research and applied ML." },
  { name: "Priya Sharma", role: "CTO & Co-founder", bio: "Former principal engineer at Meta AI. Deep expertise in NLP and large language models." },
  { name: "Jordan Ellis", role: "Head of Engineering", bio: "Built ML infrastructure at Stripe. Specializes in scalable AI deployment." },
  { name: "Maya Okonkwo", role: "Lead Data Scientist", bio: "PhD in ML from Stanford. Published researcher in computer vision and generative AI." },
  { name: "Sam Torres", role: "Head of Design", bio: "Previously at Figma and Vercel. Makes complex AI systems feel simple." },
  { name: "Lena Vogt", role: "Head of Strategy", bio: "Ex-McKinsey. Bridges the gap between AI capability and business value." },
];

const values = [
  { title: "Ship real value", desc: "We measure success by business impact, not model accuracy on a benchmark. Every project must deliver tangible results." },
  { title: "Radical transparency", desc: "No black boxes — in our models or our process. Clients get full visibility into what we're building and why." },
  { title: "Speed with intention", desc: "We move fast but never cut corners on reliability or safety. First prototype in weeks, not months." },
  { title: "Responsible AI", desc: "Bias detection, explainability, and governance aren't afterthoughts — they're built into our process from day one." },
];

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 64 }}>
      {/* hero */}
      <section className="section" style={{ paddingBottom: 60 }}>
        <FadeIn>
          <div className="section-tag">About bilabs.ai</div>
          <h1 className="section-title" style={{ fontSize: 56 }}>
            A team that lives and
            <br />
            <span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              breathes AI
            </span>
          </h1>
          <p className="section-subtitle">
            We&apos;re engineers, researchers, and strategists who left big tech to build an agency that does AI differently.
          </p>
        </FadeIn>
      </section>

      {/* mission */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="grid-2" style={{ gap: 60, alignItems: "center" }}>
          <FadeIn>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>Our mission</h2>
            <p style={{ fontSize: 16, color: "var(--text-2)", lineHeight: 1.7, marginBottom: 16 }}>
              Most businesses know they need AI. Few know where to start, and even fewer can execute.
              We exist to close that gap.
            </p>
            <p style={{ fontSize: 16, color: "var(--text-2)", lineHeight: 1.7 }}>
              We&apos;re not a body shop and we don&apos;t do cookie-cutter solutions.
              Every engagement starts with understanding your specific challenges, then we build exactly what you need — nothing more, nothing less.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="glass-card">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                {[
                  { num: "2022", label: "Founded" },
                  { num: "24", label: "Team members" },
                  { num: "50+", label: "Projects shipped" },
                  { num: "6", label: "Countries served" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="stat-number" style={{ fontSize: 32 }}>{s.num}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* values */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">Our Values</div>
          <h2 className="section-title">How we work</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            These aren&apos;t wall posters — they&apos;re the principles behind every decision we make.
          </p>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          {values.map((v, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="glass-card">
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.02em" }}>{v.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* team */}
      <section className="section">
        <FadeIn>
          <div className="section-tag">The Team</div>
          <h2 className="section-title">Built by operators</h2>
          <p className="section-subtitle" style={{ marginBottom: 60 }}>
            Our team brings deep experience from the companies that defined modern AI.
          </p>
        </FadeIn>

        <div className="grid-3">
          {team.map((t, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div className="glass-card">
                <div style={{
                  width: 56, height: 56, borderRadius: 14, marginBottom: 16,
                  background: "var(--accent-gradient)", opacity: 0.15,
                }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{t.name}</h3>
                <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 12 }}>{t.role}</div>
                <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>{t.bio}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>
    </div>
  );
}
