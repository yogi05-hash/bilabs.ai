/* The three plans, in one place.
 *
 * Prices here are the ones quoted on the page; the amounts actually charged
 * live in Stripe and are referenced by id in the checkout route, so a stale
 * constant here can never charge someone a different number than they read. */

export type Pack = {
  id: "free" | "get-found" | "front-desk";
  name: string;
  price: string;
  sub: string | null;
  blurb: string;
  points: string[];
  cta: "scroll" | "checkout";
  ctaLabel: string;
  href?: string;
  offer: boolean;
  featured?: boolean;
};

export const PACKAGES: Pack[] = [
  {
    id: "free",
    name: "Free AI Check",
    price: "£0",
    sub: null,
    blurb: "See what AI assistants say about you today.",
    points: [
      "We ask an assistant the question your customers ask",
      "You see the answer, and who it named instead",
      "Takes about 15 seconds",
      "No card, no account",
    ],
    cta: "scroll",
    ctaLabel: "Run the free check",
    href: "#check",
    offer: false,
  },
  {
    id: "get-found",
    name: "Get Found by AI",
    price: "£49",
    sub: "/month",
    blurb: "Published where AI assistants search — and measured every month.",
    points: [
      "Your profile published to AI web search — hosted on bilabs.ai, plus snippets for your own site",
      "Checked monthly in ChatGPT, Claude, Gemini and Grok with live web search",
      "Your dashboard: results, history and copy-paste snippets",
      "Cancel anytime",
    ],
    cta: "checkout",
    ctaLabel: "Start for £1",
    offer: true,
  },
  {
    id: "front-desk",
    name: "AI Front Desk",
    price: "£99",
    sub: "/month",
    blurb: "Everything above, plus an assistant that answers every enquiry.",
    points: [
      "Everything in Get Found by AI",
      "24/7 AI receptionist on your site, a link and a QR code",
      "Answers from your facts — and never invents one",
      "Enquiries emailed to you the moment they arrive",
    ],
    cta: "checkout",
    ctaLabel: "Start for £1",
    offer: true,
    featured: true,
  },
];
