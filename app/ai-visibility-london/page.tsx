import type { Metadata } from "next";
import Link from "next/link";
import { SITE, serviceJsonLd } from "@/lib/site";

const AREA = ["Greenwich", "South East London", "London", "United Kingdom"];
const URL = `${SITE.url}/ai-visibility-london`;

export const metadata: Metadata = {
  title: "AI visibility for London businesses — BiLabs",
  description:
    "We publish your London business so ChatGPT, Claude, Perplexity and Google AI can read it: structured profile, schema, crawler access. £49/month, cancel anytime.",
  alternates: { canonical: "/ai-visibility-london" },
};

/* A plain-text page, deliberately. Everything an assistant needs — what we do,
 * what it costs, where we work, how to reach us — is readable text rather than
 * an image or a script-rendered widget. */

export default function Page() {
  return (
    <div style={{ paddingTop: 92 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            serviceJsonLd({
              name: "AI visibility for London businesses",
              description:
                "Publishing a London business's services, hours, prices and location in a structured, crawlable form that AI assistants can read.",
              url: URL,
              area: AREA,
            }),
          ),
        }}
      />

      <section className="sec">
        <div className="wrap" style={{ maxWidth: 780 }}>
          <h1 className="h2">AI visibility for London businesses</h1>

          <p className="body" style={{ fontSize: 17, marginTop: 14 }}>
            When someone asks ChatGPT, Claude, Perplexity or Google AI to recommend a business in London, the
            assistant answers from whatever it can read about you. BiLabs publishes your services, opening hours,
            prices and location in a structured form those systems can fetch — and keeps it current.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>What we do</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>Build a structured business profile from your real services, hours and prices.</li>
            <li>Publish schema.org markup that assistants and search engines can parse.</li>
            <li>Check that GPTBot, ClaudeBot, PerplexityBot and Google-Extended are not blocked from your site.</li>
            <li>Publish an llms.txt index pointing at the pages that matter.</li>
            <li>Send a monthly report on what the assistants are actually saying about you.</li>
          </ul>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Prices</h2>
          <ul className="body" style={{ marginTop: 10, paddingLeft: 20 }}>
            <li><strong>Free AI Check</strong> — £0. Five real questions put to an AI assistant, plus a readiness scan of your site.</li>
            <li><strong>Get Found by AI</strong> — £49 per month. Profile and schema built, published and kept current, with a monthly report.</li>
          </ul>
          <p className="body" style={{ marginTop: 10 }}>
            No setup fee. Cancel anytime. Prices in GBP.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Where we work</h2>
          <p className="body" style={{ marginTop: 10 }}>
            BiLabs is based in Greenwich, South East London, and works with businesses across London and the rest of
            the United Kingdom. The work is remote; we do not need to visit your premises.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>What we do not promise</h2>
          <p className="body" style={{ marginTop: 10 }}>
            We cannot guarantee that any AI assistant will recommend you. No one can — each platform decides what it
            indexes and what it quotes. What we control is whether your business is readable: accurate, structured,
            current, and published where these systems look.
          </p>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36 }}>Contact</h2>
          <p className="body" style={{ marginTop: 10 }}>
            Email <a href={`mailto:${SITE.email}`} style={{ color: "var(--ink)" }}>{SITE.email}</a>, or{" "}
            <Link href="/contact" style={{ color: "var(--ink)" }}>talk to us</Link>.
          </p>

          <p style={{ marginTop: 34, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/#check" className="btn-amber">Run the free AI check</Link>
            <Link href="/#packages" className="btn-line">See prices</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
