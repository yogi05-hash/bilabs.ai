import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div style={{ marginBottom: 16 }}>
            <Image
              src="/logo.png"
              alt="BiLabs"
              width={140}
              height={46}
              style={{ height: 36, width: "auto", objectFit: "contain" }}
            />
          </div>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 280 }}>
            AI automation agency. We build chatbots, voice agents, and workflow automations that save you thousands of hours.
          </p>
        </div>
        <div>
          <div className="footer-heading">Company</div>
          <Link href="/about" className="footer-link">About</Link>
          <Link href="/services" className="footer-link">Services</Link>
          <Link href="/contact" className="footer-link">Contact</Link>
          <Link href="/contact" className="footer-link">Book a Call</Link>
        </div>
        <div>
          <div className="footer-heading">Services</div>
          <Link href="/services" className="footer-link">AI Chatbots</Link>
          <Link href="/services" className="footer-link">Voice Agents</Link>
          <Link href="/services" className="footer-link">Workflow Automation</Link>
          <Link href="/services" className="footer-link">AI Content Engine</Link>
          <Link href="/services" className="footer-link">Analytics &amp; Insights</Link>
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
