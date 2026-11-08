import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug, PUBLISHABLE } from "@/lib/businesses";
import { businessFaqJsonLd, businessJsonLd, DAY_NAMES, profileUrl, safeJsonLd } from "@/lib/profile";

/* A published business profile.
 *
 * Server-rendered, cached ten minutes, and written to be read by machines
 * first: every fact is in plain HTML text AND in JSON-LD, the FAQ is real
 * <details> elements, and nothing here depends on JavaScript. The customer's
 * own words are rendered as text by React, and the JSON-LD goes through
 * safeJsonLd, so nothing they typed can become markup. */

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const b = await getBusinessBySlug(slug);
  return b && PUBLISHABLE.includes(b.status) ? b : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await load(slug);
  if (!b) return { title: "Not found" };
  const title = `${b.name}${b.business_type ? ` — ${b.business_type}` : ""}${b.area ? ` in ${b.area}` : ""}`;
  const description = (b.description ?? `${b.business_type ?? "Business"} in ${b.area ?? "the UK"}.`).slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: profileUrl(b) },
    robots: b.is_test ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url: profileUrl(b), type: "website", images: b.photos?.[0] ? [{ url: b.photos[0].url }] : undefined },
  };
}

const row: React.CSSProperties = { display: "flex", gap: 12, fontSize: 15, lineHeight: 1.55 };
const label: React.CSSProperties = { width: 120, flexShrink: 0, color: "var(--ink-3)" };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: "36px 0 12px", letterSpacing: "-0.01em" };

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  const b = await load(slug);
  if (!b) notFound();

  const url = profileUrl(b);
  const ld = [businessJsonLd(b, { canonicalUrl: url }), businessFaqJsonLd(b, url)].filter(Boolean);
  const areas = Array.from(new Set([b.area, ...(b.areas ?? [])].filter(Boolean))) as string[];
  const updated = new Date(b.republished_at ?? b.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

  return (
    <>
      {ld.map((o, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(o) }} />
      ))}

      <header style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", fontSize: 13, color: "var(--ink-3)" }}>
          <span>Business profile</span>
          <a href="/" style={{ color: "var(--ink-3)" }}>Published by BiLabs</a>
        </div>
      </header>

      <main className="wrap" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 60 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {[b.business_type, b.area].filter(Boolean).join(" · ")}
        </p>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", margin: "8px 0 0", lineHeight: 1.1 }}>{b.name}</h1>
        {b.description && <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--ink-2)", marginTop: 16, whiteSpace: "pre-line" }}>{b.description}</p>}

        <section aria-label="Contact" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          {b.website && <div style={row}><span style={label}>Website</span><a href={b.website} rel="noopener">{b.website.replace(/^https?:\/\//, "")}</a></div>}
          {b.phone && <div style={row}><span style={label}>Phone</span><a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}>{b.phone}</a></div>}
          {b.email && <div style={row}><span style={label}>Email</span><a href={`mailto:${b.email}`}>{b.email}</a></div>}
          {(b.address || b.postcode) && <div style={row}><span style={label}>Address</span><span>{[b.address, b.postcode].filter(Boolean).join(", ")}</span></div>}
          {areas.length > 0 && <div style={row}><span style={label}>Areas served</span><span>{areas.join(", ")}</span></div>}
        </section>

        {b.services?.length > 0 && (
          <section>
            <h2 style={h2}>Services</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {b.services.map((s, i) => (
                <li key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15.5 }}>{s.name}</strong>
                    {s.price && <span style={{ color: "var(--ink-2)", fontSize: 15 }}>{s.price}</span>}
                  </div>
                  {s.description && <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>{s.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {b.prices?.length > 0 && (
          <section>
            <h2 style={h2}>Prices</h2>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15 }}>
              <tbody>
                {b.prices.map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 0" }}>{p.item}</td>
                    <td style={{ padding: "8px 0", textAlign: "right", color: "var(--ink-2)" }}>{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {b.hours?.length > 0 && (
          <section>
            <h2 style={h2}>Opening hours</h2>
            <table style={{ borderCollapse: "collapse", fontSize: 15 }}>
              <tbody>
                {b.hours.map((h) => (
                  <tr key={h.day}>
                    <td style={{ padding: "4px 24px 4px 0", color: "var(--ink-3)" }}>{DAY_NAMES[h.day]}</td>
                    <td style={{ padding: "4px 0" }}>{h.closed ? "Closed" : `${h.open} – ${h.close}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {b.faqs?.length > 0 && (
          <section>
            <h2 style={h2}>Frequently asked questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {b.faqs.map((f, i) => (
                <details key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 16px" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15 }}>{f.q}</summary>
                  <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-2)", whiteSpace: "pre-line" }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {b.photos?.length > 0 && (
          <section>
            <h2 style={h2}>Photos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {b.photos.map((p, i) => (
                // plain <img>: customer-hosted images from any domain
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.url} alt={p.alt ?? b.name ?? ""} loading="lazy" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
              ))}
            </div>
          </section>
        )}

        {b.socials?.length > 0 && (
          <section>
            <h2 style={h2}>Find us</h2>
            <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {b.socials.map((s) => (
                <li key={s}><a href={s} rel="noopener me" style={{ fontSize: 14 }}>{s.replace(/^https?:\/\/(www\.)?/, "")}</a></li>
              ))}
            </ul>
          </section>
        )}

        <footer style={{ marginTop: 48, paddingTop: 18, borderTop: "1px solid var(--line)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-3)" }}>
          <p style={{ margin: 0 }}>Last updated {updated}. Details supplied by the business. Machine-readable version: <a href={`${url}/llms.txt`} style={{ color: "var(--ink-3)" }}>llms.txt</a>.</p>
          <p style={{ margin: "6px 0 0" }}>Published by <a href="/" style={{ color: "var(--ink-3)" }}>BiLabs</a> · Something wrong on this page? Email hello@bilabs.ai</p>
        </footer>
      </main>
    </>
  );
}
