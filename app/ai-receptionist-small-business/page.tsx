import type { Metadata } from "next";
import Link from "next/link";
import { SITE, serviceJsonLd } from "@/lib/site";

const AREA = ["Greenwich", "South East London", "London", "United Kingdom"];
const URL = `${SITE.url}/ai-receptionist-small-business`;

export const metadata: Metadata = {
  title: "AI receptionist for small businesses — BiLabs",
  description:
    "A 24/7 AI receptionist that answers customers from your own facts, captures the enquiry and emails it to you. £99/month, cancel anytime. London and UK-wide.",
  alternates: { canonical: "/ai-receptionist-small-business" },
};

export default function Page() {
  return (
    <div style={{ paddingTop: 92 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            serviceJsonLd({
              name: "AI receptionist for small businesses",
              description:
                "A 24/7 AI receptionist on a small business's website, shareable link and QR code, answering from the owner's own facts and emailing each enquiry.",
              url: URL,
              area: AREA,
            }),
          ),
        }}
      />

      <section className="sec">
        <div className="wrap" style={{ maxWidth: 780 }}>
          <h1 className="h2">AI receptionist for small businesses</h1>

          <p className="body" style={{ fontSize: 17, marginTop: 14 }}>
            Most enquiries now arrive outside the hours anyone is at a desk. The BiLabs AI Front Desk answers them —
            on your website, through a shareable link, or from a printed QR code — using only the facts you gave it,
            then emails you the enquiry the moment it arrives.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>What it does</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>Answers common questions: opening hours, services, prices, location, whether you are taking new customers.</li>
            <li>Collects the caller&apos;s name, number and what they need, in conversation rather than as a form.</li>
            <li>Emails you every enquiry immediately, with the number ready to call.</li>
            <li>Works on your website, as a link for social profiles, and as a printable QR code.</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>What it will not do</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>It does not invent prices or facts. If it has not been told, it says it will check.</li>
            <li>It never confirms a booking itself. It shares your booking link or takes details for you to confirm.</li>
            <li>It does not answer phone calls — it handles written enquiries.</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Price</h2>
          <p className="body" style={{ marginTop: 10 }}>
            <strong>AI Front Desk — £99 per month.</strong> Includes everything in Get Found by AI (£49 per month):
            your structured profile and schema published and kept current, with a monthly AI visibility report. No
            setup fee. Cancel anytime. Prices in GBP.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Who it suits</h2>
          <p className="body" style={{ marginTop: 10 }}>
            Trades, clinics, salons, lettings and estate agents, garages, accountants and other small businesses that
            get asked the same questions all day and lose enquiries in the evenings and at weekends.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Where we work</h2>
          <p className="body" style={{ marginTop: 10 }}>
            Greenwich and South East London, across London, and anywhere in the United Kingdom. Setup is remote.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Contact</h2>
          <p className="body" style={{ marginTop: 10 }}>
            Email <a href={`mailto:${SITE.email}`} style={{ color: "var(--ink)" }}>{SITE.email}</a>, or{" "}
            <Link href="/contact" style={{ color: "var(--ink)" }}>talk to us</Link>.
          </p>

          <p style={{ marginTop: 34, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/#packages" className="btn-amber">See prices</Link>
            <Link href="/#check" className="btn-line">Run the free AI check</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
