import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { contextFrom, recordEvent, touchVisitor } from "@/lib/analytics";
import { getSettings } from "@/lib/admin";

/* Stripe Checkout for the two monthly plans.
 *
 * The launch offer is "first month £1 — first 10 businesses". Stripe caps
 * redemptions per coupon, and there is one coupon per plan, so the per-coupon
 * caps alone would allow ten on each and twenty in total. The combined count
 * is therefore checked here before the discount is attached: once ten have
 * been taken across both plans, checkout still works and simply charges full
 * price rather than quietly honouring an offer that has ended. */

const PLANS = {
  "get-found": { price: "STRIPE_PRICE_GET_FOUND", coupon: "STRIPE_COUPON_GET_FOUND", label: "Get Found by AI" },
  "front-desk": { price: "STRIPE_PRICE_FRONT_DESK", coupon: "STRIPE_COUPON_FRONT_DESK", label: "AI Front Desk" },
} as const;

type PlanId = keyof typeof PLANS;

async function offerPlacesLeft(secret: string): Promise<boolean> {
  const limit = Number(env("STRIPE_OFFER_LIMIT", "10")) || 10;
  const ids = [env("STRIPE_COUPON_GET_FOUND"), env("STRIPE_COUPON_FRONT_DESK")].filter(Boolean);
  try {
    let used = 0;
    for (const id of ids) {
      const res = await fetch(`https://api.stripe.com/v1/coupons/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
      });
      if (!res.ok) return false; // can't prove places remain — don't discount
      const c = await res.json();
      used += Number(c.times_redeemed ?? 0);
    }
    return used < limit;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = env("STRIPE_SECRET_KEY");
    const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
    if (!secret) {
      console.error("[checkout] stripe secret missing");
      return NextResponse.json({ error: "Checkout is unavailable. Please email hello@bilabs.ai." }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const planId = (typeof body?.plan === "string" ? body.plan : "") as PlanId;
    const plan = PLANS[planId];
    if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });

    const price = env(plan.price);
    if (!price) {
      console.error("[checkout] price id missing for", planId);
      return NextResponse.json({ error: "Checkout is unavailable. Please email hello@bilabs.ai." }, { status: 503 });
    }

    const form = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      // Stripe substitutes the placeholder; the welcome page uses the session
      // to confirm payment and hand over the dashboard link.
      success_url: `${site}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/#packages`,
      // allow_promotion_codes cannot be sent alongside discounts — Stripe
      // rejects the pair outright, even when it is "false".
      "subscription_data[metadata][plan]": planId,
      "metadata[plan]": planId,
    });

    const email = typeof body?.email === "string" ? body.email.trim().slice(0, 160) : "";
    if (email) form.set("customer_email", email);

    /* Carry the campaign and the visitor out to Stripe and back on the
     * webhook. Without this every paying customer would attribute to
     * "direct", because the trip to Checkout and back loses the referrer
     * and the UTM tags. */
    const settings = await getSettings();
    const ctx = contextFrom(request, settings.internalIpHashes);
    const { visitor } = await touchVisitor({ ctx, countPageView: false });
    const utm = (typeof body?.utm === "object" && body.utm ? body.utm : {}) as Record<string, string>;
    const meta: Record<string, string> = {};
    if (visitor?.id) meta.visitor_id = visitor.id;
    if (typeof body?.evaluationId === "string" && body.evaluationId) {
      meta.evaluation_id = body.evaluationId.slice(0, 40);
    }
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      if (typeof utm[k] === "string" && utm[k]) meta[k] = utm[k].slice(0, 120);
    }
    for (const [k, v] of Object.entries(meta)) {
      form.set(`metadata[${k}]`, v);
      form.set(`subscription_data[metadata][${k}]`, v);
    }

    const coupon = env(plan.coupon);
    if (coupon && (await offerPlacesLeft(secret))) {
      form.set("discounts[0][coupon]", coupon);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });

    const session = await res.json();
    if (!res.ok || !session?.url) {
      console.error("[checkout] stripe", res.status, JSON.stringify(session).slice(0, 300));
      return NextResponse.json({ error: "Could not start checkout. Please email hello@bilabs.ai." }, { status: 502 });
    }

    /* "Started", not "paid". This records only that Stripe handed us a
     * session URL; whether any money moved is decided by a signed webhook. */
    await recordEvent({
      name: "checkout_started",
      origin: "server",
      visitorId: visitor?.id ?? null,
      contactId: visitor?.contact_id ?? null,
      dedupeKey: `checkout_started:${session.id}`,
      props: { plan: planId, session_id: session.id, discounted: form.has("discounts[0][coupon]") },
      isInternal: ctx.isInternal,
      isTest: ctx.isTest,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout] threw:", e);
    return NextResponse.json({ error: "Could not start checkout. Please email hello@bilabs.ai." }, { status: 500 });
  }
}
