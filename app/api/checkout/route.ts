import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, isPlanId } from "@/lib/checkout";

/* Checkout from a button on the page. The body carries what the browser
 * knows — the campaign and the free check that sold them — and
 * lib/checkout.ts turns it into a Stripe session. */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!isPlanId(body?.plan)) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });

    const r = await createCheckoutSession({
      request,
      plan: body.plan,
      email: typeof body?.email === "string" ? body.email : null,
      evaluationId: typeof body?.evaluationId === "string" && body.evaluationId ? body.evaluationId : null,
      utm: (typeof body?.utm === "object" && body.utm ? body.utm : {}) as Record<string, string>,
      via: "button",
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ url: r.url });
  } catch (e) {
    console.error("[checkout] threw:", e);
    return NextResponse.json({ error: "Could not start checkout. Please email hello@bilabs.ai." }, { status: 500 });
  }
}
