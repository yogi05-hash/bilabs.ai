import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { getLeadByEmail, logEvent, sb, setStatus, upsertLead } from "@/lib/leads";
import { sendWelcome } from "@/lib/nurture";

export const runtime = "nodejs";

/* Stripe webhook.
 *
 * The signature is verified before anything is trusted — an unverified
 * webhook is just a stranger telling us someone paid, and this endpoint
 * stops nurture and marks a customer paid. */

function verify(payload: string, header: string, secret: string): boolean {
  try {
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    const t = parts["t"];
    const v1 = parts["v1"];
    if (!t || !v1) return false;
    // reject anything older than five minutes
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  if (!secret) {
    console.error("[stripe] webhook secret missing");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (!verify(body, sig, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const email =
      (s.customer_email as string) ||
      ((s.customer_details as Record<string, unknown> | undefined)?.email as string) ||
      "";
    const plan = ((s.metadata as Record<string, unknown> | undefined)?.plan as string) || "";

    if (email) {
      let lead = await getLeadByEmail(email);
      if (!lead) {
        lead = await upsertLead({ email, source: "checkout", business_type: null, area: null });
      }
      if (lead) {
        await sb(`bilabs_leads?id=eq.${lead.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: "paid",
            stripe_customer_id: (s.customer as string) ?? null,
            updated_at: new Date().toISOString(),
          }),
        });
        await logEvent(lead.id, "paid", plan || "checkout completed");
        // nurture stops because status is no longer "nurturing"; send the
        // onboarding note instead of the next sales email
        await sendWelcome({ ...lead, status: "paid" });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const customer = sub.customer as string;
    const rows = await sb<{ id: string }[]>(`bilabs_leads?stripe_customer_id=eq.${customer}&limit=1`);
    if (rows?.[0]) await setStatus(rows[0].id, "lost", "subscription cancelled");
  }

  return NextResponse.json({ received: true });
}
