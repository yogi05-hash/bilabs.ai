import { env } from "@/lib/env";
import { prune, SITE } from "@/lib/site";
import type { Business, Day, Hours } from "@/lib/businesses";

/* The published profile, as structured data and as plain text.
 *
 * This is the artefact the whole product rests on: one stable page per
 * business whose facts are stated in schema.org JSON-LD, in readable HTML and
 * in an llms.txt — the three forms AI web search actually reads. Every
 * builder here is pure and uses prune(), so a field the customer left blank
 * is omitted rather than published as an empty claim. */

/** Crawlers we welcome in robots.txt — ours and, via the snippets, theirs. */
export const AI_AGENTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Bingbot", "CCBot", "Applebot-Extended",
];

export const siteUrl = () => env("NEXT_PUBLIC_SITE_URL", SITE.url).replace(/\/+$/, "");
export const profileUrl = (b: Pick<Business, "slug">) => `${siteUrl()}/b/${b.slug}`;

/** JSON for a <script type="application/ld+json">. Customer text goes in
 *  here, so "<" is escaped — "</script>" inside a description must not end
 *  the tag. */
export const safeJsonLd = (obj: unknown) => JSON.stringify(obj).replace(/</g, "\\u003c");

export const DAY_NAMES: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const openingHoursSpec = (hours: Hours[]) =>
  (hours ?? [])
    .filter((h) => !h.closed && h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_NAMES[h.day]}`,
      opens: h.open,
      closes: h.close,
    }));

/** "£45" / "45" → 45; anything else (from £30, POA) stays as text. */
const numericPrice = (p?: string): number | null => {
  const m = (p ?? "").trim().match(/^£?\s*(\d+(?:\.\d{1,2})?)$/);
  return m ? Number(m[1]) : null;
};

export function businessJsonLd(b: Business, opts: { canonicalUrl: string }) {
  const areas = Array.from(new Set([b.area, ...(b.areas ?? [])].filter((a): a is string => Boolean(a))));
  return prune({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${opts.canonicalUrl}#business`,
    name: b.name,
    description: b.description,
    url: b.website ?? opts.canonicalUrl,
    mainEntityOfPage: opts.canonicalUrl,
    telephone: b.phone,
    email: b.email,
    keywords: b.business_type,
    address: prune({
      "@type": "PostalAddress",
      streetAddress: b.address,
      addressLocality: b.area,
      postalCode: b.postcode,
      addressCountry: "GB",
    }),
    areaServed: areas.map((a) => ({ "@type": "Place", name: a })),
    openingHoursSpecification: openingHoursSpec(b.hours),
    image: (b.photos ?? []).map((p) => p.url),
    sameAs: b.socials ?? [],
    makesOffer: (b.services ?? []).map((s) => {
      const price = numericPrice(s.price);
      return prune({
        "@type": "Offer",
        name: s.name,
        description: [s.description, price === null && s.price ? `Price: ${s.price}` : ""].filter(Boolean).join(" "),
        price: price ?? undefined,
        priceCurrency: price !== null ? "GBP" : undefined,
        itemOffered: { "@type": "Service", name: s.name, description: s.description },
      });
    }),
  });
}

export function businessFaqJsonLd(b: Business, canonicalUrl: string) {
  const faqs = b.faqs ?? [];
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

const fmtHours = (hours: Hours[]) =>
  (hours ?? []).map((h) => `- ${DAY_NAMES[h.day]}: ${h.closed ? "Closed" : `${h.open}–${h.close}`}`).join("\n");

export function businessLlmsTxt(b: Business): string {
  const url = b.slug ? profileUrl(b) : siteUrl();
  const lines: string[] = [];
  lines.push(`# ${b.name ?? "Business"}`);
  lines.push("");
  lines.push(`> ${[b.business_type, b.area ? `in ${b.area}` : ""].filter(Boolean).join(" ")}${b.description ? `. ${b.description.replace(/\s+/g, " ")}` : ""}`);
  lines.push("");
  const facts = [
    b.website ? `- Website: ${b.website}` : "",
    b.phone ? `- Phone: ${b.phone}` : "",
    b.email ? `- Email: ${b.email}` : "",
    b.address ? `- Address: ${b.address}${b.postcode ? `, ${b.postcode}` : ""}` : b.postcode ? `- Postcode: ${b.postcode}` : "",
    b.areas?.length ? `- Areas served: ${[b.area, ...b.areas].filter(Boolean).join(", ")}` : b.area ? `- Area: ${b.area}` : "",
  ].filter(Boolean);
  if (facts.length) lines.push(...facts, "");
  if (b.services?.length) {
    lines.push("## Services", ...b.services.map((s) => `- ${s.name}${s.price ? ` — ${s.price}` : ""}${s.description ? `: ${s.description}` : ""}`), "");
  }
  if (b.prices?.length) lines.push("## Prices", ...b.prices.map((p) => `- ${p.item}: ${p.price}`), "");
  if (b.hours?.length) lines.push("## Opening hours", fmtHours(b.hours), "");
  if (b.faqs?.length) lines.push("## Frequently asked questions", ...b.faqs.flatMap((f) => [`### ${f.q}`, f.a, ""]));
  if (b.socials?.length) lines.push("## Links", ...b.socials.map((s) => `- ${s}`), "");
  lines.push("---");
  lines.push(`Profile: ${url}`);
  lines.push(`Published by BiLabs (${siteUrl()}) on behalf of the business from details it supplied. Last updated ${new Date(b.republished_at ?? b.updated_at).toISOString().slice(0, 10)}.`);
  return lines.join("\n") + "\n";
}
