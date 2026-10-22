import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

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
      success_url: `${site}/contact?started=${planId}`,
      cancel_url: `${site}/#packages`,
      // allow_promotion_codes cannot be sent alongside discounts — Stripe
      // rejects the pair outright, even when it is "false".
      "subscription_data[metadata][plan]": planId,
      "metadata[plan]": planId,
    });

    const email = typeof body?.email === "string" ? body.email.trim().slice(0, 160) : "";
    if (email) form.set("customer_email", email);

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

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout] threw:", e);
    return NextResponse.json({ error: "Could not start checkout. Please email hello@bilabs.ai." }, { status: 500 });
  }
}
