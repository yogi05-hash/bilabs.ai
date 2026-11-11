import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { contextFrom, recordEvent, touchVisitor } from "@/lib/analytics";
import { getSettings } from "@/lib/admin";

/* Stripe Checkout for the two monthly plans — one function behind every
 * "Start" button and every pay link in an email.
 *
 * Full price from the first payment: no coupons, no promotion codes, no
 * trial. What the page says is what the first invoice charges. */

export const PLANS = {
  "get-found": { price: "STRIPE_PRICE_GET_FOUND", label: "Get Found by AI" },
  "front-desk": { price: "STRIPE_PRICE_FRONT_DESK", label: "AI Front Desk" },
} as const;

export type PlanId = keyof typeof PLANS;
export const isPlanId = (p: unknown): p is PlanId => typeof p === "string" && p in PLANS;

const UNAVAILABLE = "Checkout is unavailable. Please email hello@bilabs.ai.";
const FAILED = "Could not start checkout. Please email hello@bilabs.ai.";

export type CheckoutInput = {
  request: NextRequest;
  plan: PlanId;
  email?: string | null;
  evaluationId?: string | null;
  contactId?: string | null;
  utm?: Record<string, string>;
  /** "button" from the page, "link" from an email or a shared URL */
  via: "button" | "link";
  src?: string | null;
};

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; error: string; status: number }> {
  const secret = env("STRIPE_SECRET_KEY");
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  if (!secret) {
    console.error("[checkout] stripe secret missing");
    return { ok: false, error: UNAVAILABLE, status: 503 };
  }
  const price = env(PLANS[input.plan].price);
  if (!price) {
    console.error("[checkout] price id missing for", input.plan);
    return { ok: false, error: UNAVAILABLE, status: 503 };
  }

  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    // Stripe substitutes the placeholder; the welcome page uses the session
    // to confirm payment and hand over the dashboard link.
    success_url: `${site}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/#packages`,
    "subscription_data[metadata][plan]": input.plan,
    "metadata[plan]": input.plan,
  });

  const email = (input.email ?? "").trim().slice(0, 160);
  if (email) form.set("customer_email", email);

  /* Carry the campaign and the visitor out to Stripe and back on the
   * webhook. Without this every paying customer would attribute to
   * "direct", because the trip to Checkout and back loses the referrer
   * and the UTM tags. */
  const settings = await getSettings();
  const ctx = contextFrom(input.request, settings.internalIpHashes);
  const { visitor } = await touchVisitor({ ctx, countPageView: false });
  const utm = input.utm ?? {};
  const meta: Record<string, string> = { via: input.via };
  if (visitor?.id) meta.visitor_id = visitor.id;
  if (input.evaluationId) meta.evaluation_id = input.evaluationId.slice(0, 40);
  if (input.src) meta.src = input.src.slice(0, 60);
  for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
    if (typeof utm[k] === "string" && utm[k]) meta[k] = utm[k].slice(0, 120);
  }
  for (const [k, v] of Object.entries(meta)) {
    form.set(`metadata[${k}]`, v);
    form.set(`subscription_data[metadata][${k}]`, v);
  }

  let session: { id?: string; url?: string } | null = null;
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    session = (await res.json()) as { id?: string; url?: string };
    if (!res.ok || !session?.url || !session.id) {
      console.error("[checkout] stripe", res.status, JSON.stringify(session).slice(0, 300));
      return { ok: false, error: FAILED, status: 502 };
    }
  } catch (e) {
    console.error("[checkout] stripe threw:", e);
    return { ok: false, error: FAILED, status: 502 };
  }

  /* "Started", not "paid". This records only that Stripe handed us a
   * session URL; whether any money moved is decided by a signed webhook. */
  await recordEvent({
    name: "checkout_started",
    origin: "server",
    visitorId: visitor?.id ?? null,
    contactId: input.contactId ?? visitor?.contact_id ?? null,
    evaluationId: input.evaluationId ?? null,
    dedupeKey: `checkout_started:${session.id}`,
    props: { plan: input.plan, session_id: session.id, via: input.via, src: input.src ?? null },
    isInternal: ctx.isInternal,
    isTest: ctx.isTest,
  });

  return { ok: true, url: session.url, sessionId: session.id };
}

/** A pay link for emails: one click opens Stripe with the person's email
 *  and their free check already attached, so the paid profile pre-fills. */
export function startUrl(opts: { contactId?: string | null; evaluationId?: string | null; plan?: PlanId; src: string }): string {
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const p = new URLSearchParams({ plan: opts.plan ?? "get-found", src: opts.src });
  if (opts.contactId) p.set("c", opts.contactId);
  if (opts.evaluationId) p.set("e", opts.evaluationId);
  return `${site}/start?${p.toString()}`;
}
