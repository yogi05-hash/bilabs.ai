"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        bi<span>labs</span>.ai
      </Link>
      <ul className="nav-links">
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
          <Link href="/contact" className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
            Book a Demo
          </Link>
        </li>
      </ul>
    </nav>
  );
}
