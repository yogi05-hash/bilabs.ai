import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

/* Stripe Checkout for the £149 audit — the only package that takes payment
 * online. The price lives in Stripe and is referenced by id, so the amount
 * charged can never drift from the amount quoted by a stale constant here. */

export async function POST(request: NextRequest) {
  try {
    const secret = env("STRIPE_SECRET_KEY");
    const price = env("STRIPE_AUDIT_PRICE_ID");
    const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");

    if (!secret || !price) {
      console.error("[checkout] stripe env missing");
      return NextResponse.json({ error: "Checkout is unavailable. Please email hello@bilabs.ai." }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().slice(0, 160) : "";

    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: `${site}/contact?paid=audit`,
      cancel_url: `${site}/#packages`,
      // Shared Stripe account: never touch account-wide branding, only the
      // per-payment suffix, so this shows as BiLabs on a customer's statement.
      "payment_intent_data[statement_descriptor_suffix]": "BILABS AUDIT",
      "metadata[product]": "ai-visibility-audit",
    });
    if (email) form.set("customer_email", email);

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
