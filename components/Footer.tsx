import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.03em" }}>
            bi<span style={{ background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>labs</span>.ai
          </div>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 280 }}>
            Building intelligent systems that transform how businesses operate. From strategy to deployment.
          </p>
        </div>
        <div>
          <div className="footer-heading">Company</div>
          <Link href="/about" className="footer-link">About</Link>
          <Link href="/services" className="footer-link">Services</Link>
          <Link href="/contact" className="footer-link">Contact</Link>
        </div>
        <div>
          <div className="footer-heading">Services</div>
          <Link href="/services" className="footer-link">AI Strategy</Link>
          <Link href="/services" className="footer-link">Custom Models</Link>
          <Link href="/services" className="footer-link">Data Engineering</Link>
          <Link href="/services" className="footer-link">AI Integration</Link>
        </div>
        <div>
          <div className="footer-heading">Connect</div>
          <span className="footer-link">hello@bilabs.ai</span>
          <span className="footer-link">Twitter / X</span>
          <span className="footer-link">LinkedIn</span>
        </div>
      </div>
      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} bilabs.ai. All rights reserved.
      </div>
    </footer>
  );
}
