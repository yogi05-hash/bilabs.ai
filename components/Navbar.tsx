"use client";

import Link from "next/link";
import Image from "next/image";
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
      <Link href="/" style={{ display: "flex", alignItems: "center" }}>
        <Image
          src="/logo.png"
          alt="BiLabs"
          width={160}
          height={50}
          style={{ height: 44, width: "auto", objectFit: "contain" }}
          priority
        />
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
          <Link href="/contact" className="btn-primary" style={{ padding: "8px 18px", fontSize: 13, background: "#F5B731", color: "#0a0a0f" }}>
            Book a Demo
          </Link>
        </li>
      </ul>
    </nav>
  );
}
