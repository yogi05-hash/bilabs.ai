import Image from "next/image";
import Link from "next/link";

/* Dark footer, as the mockup has it. */
export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap" style={{ paddingTop: 34, paddingBottom: 34 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Image src="/logo.png" alt="BiLabs" width={674} height={180} style={{ height: 24, width: "auto" }} />
            <span style={{ fontSize: 13.5 }}>bilabs.ai</span>
          </div>

          <nav style={{ display: "flex", flexWrap: "wrap", gap: "8px 26px", fontSize: 13.5 }}>
            <Link href="/#services">Services</Link>
            <Link href="/#packages">Packages</Link>
            <Link href="/work">Our work</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/dashboard">Customer login</Link>
          </nav>
        </div>

        <p style={{ margin: "22px 0 0", fontSize: 13, color: "rgba(255,255,255,.42)" }}>
          AI visibility and AI receptionists for local businesses.
        </p>
        {/* Contact details as plain text, on every page. Our own readiness
            check scored bilabs.ai 90/100 and failed exactly this. */}
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,.52)" }}>
          BiLabs · Greenwich, London, United Kingdom ·{" "}
          <a href="mailto:hello@bilabs.ai">hello@bilabs.ai</a>
        </p>
      </div>
    </footer>
  );
}
