"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/#pricing", label: "Packages" },
  { href: "/#industries", label: "Industries" },
  { href: "/#video-demo", label: "Live Demo" },
  { href: "/#process", label: "Process" },
  { href: "/#products", label: "Our Products" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="nav"
      style={{
        background: scrolled ? "rgba(5, 5, 7, 0.85)" : "rgba(5, 5, 7, 0.5)",
        borderBottom: scrolled ? "0.5px solid var(--border)" : "none",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center" }}>
        <Image
          src="/logo.png"
          alt="BiLabs"
          width={160}
          height={50}
          style={{ height: 40, width: "auto", objectFit: "contain" }}
          priority
        />
      </Link>

      {/* Desktop */}
      <ul className="nav-links" style={{ display: undefined }}>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="nav-link"
              style={pathname === l.href ? { color: "var(--text-1)" } : undefined}
            >
              {l.label}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/contact"
            className="btn-primary"
            style={{ padding: "8px 18px", fontSize: 13, background: "#F5B731", color: "#0a0a0f" }}
          >
            Get Free AI Audit
          </Link>
        </li>
      </ul>

      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "none",
          background: "none",
          border: "none",
          color: "var(--text-2)",
          cursor: "pointer",
        }}
        className="mobile-menu-btn"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile menu */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 0,
            right: 0,
            background: "rgba(5, 5, 7, 0.95)",
            backdropFilter: "blur(20px)",
            borderBottom: "0.5px solid var(--border)",
            padding: "16px 20px",
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              onClick={() => setOpen(false)}
              style={{ display: "block", padding: "10px 0", fontSize: 15 }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/contact"
            className="btn-primary"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 12,
              padding: "10px",
              background: "#F5B731",
              color: "#0a0a0f",
            }}
          >
            Get Free AI Audit
          </Link>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
