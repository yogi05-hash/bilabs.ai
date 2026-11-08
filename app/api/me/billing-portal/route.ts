import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireCustomer } from "@/lib/customerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Stripe's hosted billing portal: update card, see invoices, cancel. The
 * customer id comes from our own row, never from the request. */
export async function POST(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const customerId = c.business?.stripe_customer_id ?? c.lead.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: "No billing record found — email hello@bilabs.ai." }, { status: 409 });

  const secret = env("STRIPE_SECRET_KEY");
  if (!secret) return NextResponse.json({ error: "Billing is unavailable just now." }, { status: 503 });
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");

  try {
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer: customerId, return_url: `${site}/dashboard` }),
      cache: "no-store",
    });
    const j = await res.json();
    if (!res.ok || !j?.url) {
      console.error("[billing-portal]", res.status, JSON.stringify(j).slice(0, 300));
      return NextResponse.json({ error: "Could not open billing just now." }, { status: 502 });
    }
    return NextResponse.json({ url: j.url });
  } catch (e) {
    console.error("[billing-portal] threw:", e);
    return NextResponse.json({ error: "Could not open billing just now." }, { status: 500 });
  }
}
