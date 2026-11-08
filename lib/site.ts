/* One source of truth for everything the structured data asserts.
 *
 * Anything here ends up as a machine-readable claim about a real company and
 * a real person, which is exactly the kind of thing that must not be guessed.
 * Fields I could not verify are left empty on purpose and are OMITTED from
 * the JSON-LD rather than filled with a plausible-looking value:
 *
 *   legalName       — the registered entity behind BiLabs was never given.
 *   companyNumber   — likewise.
 *   sameAs          — LinkedIn / Instagram / X URLs were asked for but not
 *                     supplied. Pointing schema at the wrong profile is worse
 *                     than pointing at none, so these stay blank until given.
 *   founderUrl      — same reasoning.
 *
 * Fill any of these in and they appear in the markup automatically. */

export const SITE = {
  url: "https://bilabs.ai",
  name: "BiLabs",
  legalName: "", // e.g. "BiLabs Ltd" — not supplied
  companyNumber: "", // not supplied
  email: "hello@bilabs.ai",
  description:
    "BiLabs makes small businesses readable to AI assistants and answers the enquiries that follow. AI visibility publishing and an AI receptionist, for local businesses in London and across the UK.",
  founder: {
    name: "Ram Yogi Velagapudi",
    jobTitle: "Founder",
    url: "", // not supplied
  },
  address: {
    locality: "Greenwich",
    region: "London",
    country: "GB",
  },
  areaServed: ["Greenwich", "South East London", "London", "United Kingdom"],
  sameAs: [] as string[], // LinkedIn / Instagram / X — not supplied
  services: [
    {
      name: "Get Found by AI",
      description:
        "A published business profile with schema.org structured data, hosted on bilabs.ai with copy-paste snippets for your own site, and a monthly check of whether ChatGPT, Claude, Gemini and Grok name your business — with every answer in your dashboard.",
      price: 49,
      period: "MONTH",
    },
    {
      name: "AI Front Desk",
      description:
        "Everything in Get Found by AI, plus a 24/7 AI receptionist on your website, a shareable link and a QR code, which answers from your facts and emails you every enquiry.",
      price: 99,
      period: "MONTH",
    },
  ],
} as const;

/* The one sentence every page, email and plan description must agree on.
 * Nobody can put facts inside a model; we publish where AI web search reads
 * and we measure what comes back. Weakening this anywhere is a bug. */
export const HONESTY_LINE =
  "We make your business discoverable to AI web search and measure whether assistants name you. We do not — and cannot — put anything inside a model.";

/** Drops empty strings and empty arrays so nothing unverified reaches the markup. */
export function prune<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(prune).filter((v) => v !== undefined) as unknown as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === "" || v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      const p = prune(v);
      if (p !== undefined) out[k] = p;
    }
    return out as T;
  }
  return obj;
}

/* Emitted as two standalone top-level objects rather than one @graph with an
 * @id cross-reference. The graph form validated cleanly, but schema.org's
 * validator would not expand `publisher: {"@id": ...}` — it recorded the
 * predicate and stopped. Anything that does not resolve references would
 * therefore miss the organisation entirely, which is a poor outcome on a
 * site whose whole pitch is being machine-readable. Standalone objects are
 * the most universally parsed form. */
export function organisationJsonLd() {
  const orgId = `${SITE.url}/#organization`;

  const offers = SITE.services.map((s) => ({
    "@type": "Offer",
    name: s.name,
    description: s.description,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: s.price,
      priceCurrency: "GBP",
      unitCode: s.period,
      billingDuration: 1,
      billingIncrement: 1,
    },
    itemOffered: { "@type": "Service", name: s.name, description: s.description },
  }));

  const org = prune({
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": orgId,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    email: SITE.email,
    description: SITE.description,
    logo: { "@type": "ImageObject", url: `${SITE.url}/logo.png` },
    image: `${SITE.url}/og.jpg`,
    founder: prune({
      "@type": "Person",
      name: SITE.founder.name,
      jobTitle: SITE.founder.jobTitle,
      url: SITE.founder.url,
    }),
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    areaServed: SITE.areaServed.map((a) => ({ "@type": "Place", name: a })),
    sameAs: SITE.sameAs,
    knowsAbout: [
      "AI visibility",
      "generative engine optimisation",
      "schema.org structured data",
      "AI receptionists",
      "lead capture for small businesses",
    ],
    makesOffer: offers,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "BiLabs services",
      itemListElement: offers,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: SITE.email,
      areaServed: "GB",
      availableLanguage: "en",
    },
  });

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    publisher: { "@id": orgId },
    inLanguage: "en-GB",
  };

  return [org, website];
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE.url}/#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function serviceJsonLd(opts: { name: string; description: string; url: string; area: string[] }) {
  return prune({
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    provider: { "@id": `${SITE.url}/#organization` },
    areaServed: opts.area.map((a) => ({ "@type": "Place", name: a })),
    offers: SITE.services.map((s) => ({
      "@type": "Offer",
      name: s.name,
      price: s.price,
      priceCurrency: "GBP",
    })),
  });
}
