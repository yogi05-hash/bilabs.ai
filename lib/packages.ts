/* The three packages, in one place.
 *
 * Prices here are the ones quoted on the page and charged by Stripe; if they
 * ever disagree, a customer has been misled. The audit is the only one that
 * takes payment online — the other two start with a conversation, because we
 * cannot scope them without knowing the business. */

export type Pack = {
  id: "audit" | "get-found" | "front-desk";
  name: string;
  price: string;
  sub: string | null;
  blurb: string;
  points: string[];
  cta: "checkout" | "call";
  ctaLabel: string;
};

export const PACKAGES: Pack[] = [
  {
    id: "audit",
    name: "AI Visibility Audit",
    price: "£149",
    sub: "one-off",
    blurb: "Find out exactly how AI assistants describe your business today.",
    points: [
      "We ask the assistants your customers ask",
      "Written report of what they say — and who they name instead",
      "A prioritised fix list you can hand to anyone",
      "Yours to keep, whether or not you work with us",
    ],
    cta: "checkout",
    ctaLabel: "Buy the audit — £149",
  },
  {
    id: "get-found",
    name: "Get Found by AI",
    price: "£499",
    sub: "then £99/month",
    blurb: "We publish your business in a form AI systems can actually read.",
    points: [
      "Structured profile built from your real services, hours and prices",
      "Schema markup and a crawlable listing AI assistants can fetch",
      "Kept current as your business changes",
      "Monthly check of what the assistants are saying",
    ],
    cta: "call",
    ctaLabel: "Book a call",
  },
  {
    id: "front-desk",
    name: "AI Front Desk",
    price: "£999",
    sub: "then £199/month",
    blurb: "Everything above, plus an assistant that answers every enquiry.",
    points: [
      "AI receptionist on your site, a link and a QR code",
      "Answers 24/7 from your facts — and never invents one",
      "Captures the enquiry and emails it to you immediately",
      "Monthly reporting on enquiries and answers",
    ],
    cta: "call",
    ctaLabel: "Book a call",
  },
];
