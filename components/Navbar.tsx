"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

// Every one of these must resolve to a section that exists on the homepage —
// the previous set pointed at #industries, #video-demo and #products, none of
// which survived the rebuild.
const links = [
  { href: "/#check", label: "Free check" },
  { href: "/#process", label: "How it works" },
  { href: "/#packages", label: "Pricing" },
  { href: "/dashboard", label: "Customer login" },
]

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
        // light theme: these inline values were overriding the stylesheet
        background: scrolled ? "rgba(250, 248, 243, 0.92)" : "transparent",
        backdropFilter: "blur(12px)",
        borderBottom: scrolled ? "1px solid rgba(17,17,18,0.1)" : "none",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center" }} aria-label="BiLabs — home">
        <Image
          src="/logo-light.png"
          alt="BiLabs"
          width={674}
          height={180}
          priority
          style={{ height: 26, width: "auto" }}
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
            href="/#check"
            className="btn-primary"
            style={{ padding: "9px 20px", fontSize: 13 }}
          >
            Free AI check
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
            background: "rgba(255, 255, 255, 0.96)",
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
            href="/#check"
            className="btn-primary"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 12,
              padding: "11px",
            }}
          >
            Free AI check
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
