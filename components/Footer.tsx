import Link from "next/link";

/* Dark footer, as the mockup has it. */
export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap" style={{ paddingTop: 34, paddingBottom: 34 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 21, letterSpacing: "-0.03em", color: "#fff" }}>
              Bi<span style={{ color: "var(--brand)" }}>Labs</span>
            </span>
            <span style={{ fontSize: 13.5 }}>bilabs.ai</span>
          </div>

          <nav style={{ display: "flex", flexWrap: "wrap", gap: "8px 26px", fontSize: 13.5 }}>
            <Link href="/#services">Services</Link>
            <Link href="/#packages">Packages</Link>
            <Link href="/work">Our work</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>

        <p style={{ margin: "22px 0 0", fontSize: 13, color: "rgba(255,255,255,.42)" }}>
          AI visibility and AI receptionists for local businesses.
        </p>
      </div>
    </footer>
  );
}
