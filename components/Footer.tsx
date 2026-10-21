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
              width={180}
              height={56}
              style={{ height: 44, width: "auto", objectFit: "contain" }}
            />
          </div>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 280 }}>
            AI-first agency building intelligent products and automation systems.
            From chatbots to video AI — we ship products that work.
          </p>
        </div>
        <div>
          <div className="footer-heading">Company</div>
          <Link href="/about" className="footer-link">About</Link>
          <Link href="/#packages" className="footer-link">Packages</Link>
          <Link href="/#check" className="footer-link">Free AI check</Link>
          <Link href="/contact" className="footer-link">Contact</Link>
        </div>
        <div>
          <div className="footer-heading">Products</div>
          <a href="https://yourbotchat.com" target="_blank" rel="noopener noreferrer" className="footer-link">YourBotChat ↗</a>
          <a href="https://reelmakerbot.com" target="_blank" rel="noopener noreferrer" className="footer-link">ReelMakerBot ↗</a>
          <a href="https://showbizy.ai" target="_blank" rel="noopener noreferrer" className="footer-link">Showbizy ↗</a>
        </div>
        <div>
          <div className="footer-heading">Connect</div>
          <a href="mailto:hello@bilabs.ai" className="footer-link">hello@bilabs.ai</a>
          <span className="footer-link">Twitter / X</span>
          <span className="footer-link">LinkedIn</span>
          <span className="footer-link">Instagram</span>
        </div>
      </div>
      <div className="footer-bottom" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span>&copy; {new Date().getFullYear()} bilabs.ai. All rights reserved.</span>
        <span>Built with AI, shipped by humans.</span>
      </div>
    </footer>
  );
}
