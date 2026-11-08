import { NextRequest, NextResponse } from "next/server";
import { stripeGet } from "@/lib/billing";
import { sb, upsertLead } from "@/lib/leads";
import { ensureBusinessForCheckout, getBusinessByContact } from "@/lib/businesses";
import { customerFor, customerLoginUrl } from "@/lib/customerAuth";
import { sendDashboardLink } from "@/lib/customerMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The page after Stripe.
 *
 * Nothing here marks anyone paid — that is the webhook's job. This only
 * reads the session back from Stripe to tell the customer what is happening
 * and, if the webhook is slow, to hand them their dashboard link anyway. The
 * email always comes from Stripe, never from the browser. */

const SESSION_RE = /^cs_(test_|live_)?[A-Za-z0-9]{10,}$/;
const OUR_PLANS = new Set(["get-found", "front-desk"]);

const WINDOW_MS = 15 * 60 * 1000;
const MAX = 10;
const hits = new Map<string, { n: number; resetAt: number }>();
function allow(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { n: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.n >= MAX) return false;
  e.n++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.resetAt) hits.delete(k); }, 300_000).unref?.();

type Session = {
  id: string;
  mode?: string;
  payment_status?: string;
  livemode?: boolean;
  customer?: string | null;
  subscription?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string>;
};

const mask = (email: string) => {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain ?? ""}`;
};

async function session(id: string): Promise<Session | null> {
  if (!SESSION_RE.test(id)) return null;
  const s = await stripeGet<Session>(`checkout/sessions/${id}`);
  if (!s || s.mode !== "subscription" || !OUR_PLANS.has(s.metadata?.plan ?? "")) return null;
  return s;
}

const emailOf = (s: Session) => (s.customer_email || s.customer_details?.email || "").trim().toLowerCase();

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("session_id") ?? "";
  const s = await session(id);
  if (!s) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const email = emailOf(s);
  const paid = s.payment_status === "paid";

  let businessReady = false;
  if (paid) {
    const pay = await sb<{ contact_id: string | null }[]>(`bilabs_payments?stripe_object_id=eq.${encodeURIComponent(s.id)}&select=contact_id&limit=1`);
    const contactId = pay?.[0]?.contact_id ?? null;
    businessReady = Boolean(contactId && (await getBusinessByContact(contactId)));
  }
  return NextResponse.json({ paid, plan: s.metadata?.plan ?? null, emailMasked: email ? mask(email) : null, businessReady });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return NextResponse.json({ error: "Too many requests — try again shortly." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const s = await session(String(body?.session_id ?? ""));
  if (!s) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (s.payment_status !== "paid") return NextResponse.json({ error: "That payment has not completed yet." }, { status: 409 });
  const email = emailOf(s);
  if (!email) return NextResponse.json({ error: "Stripe did not record an email for this payment." }, { status: 409 });

  let customer = await customerFor(email);
  if (!customer) {
    /* Webhook not landed yet. Create the contact and the business from the
     * session itself — the same inputs the webhook would use — so a paying
     * customer is never left waiting on Stripe's retry schedule. The payment
     * row and "paid" status still come only from the verified webhook. */
    const lead = await upsertLead({ email, source: "checkout", business_type: null, area: null });
    if (lead) {
      await ensureBusinessForCheckout({
        lead,
        evaluationId: s.metadata?.evaluation_id || null,
        customerId: s.customer ?? null,
        subscriptionId: s.subscription ?? null,
        plan: s.metadata?.plan ?? null,
        livemode: s.livemode === true,
      });
      customer = await customerFor(email);
    }
  }
  if (!customer) return NextResponse.json({ error: "Could not set up your account — email hello@bilabs.ai." }, { status: 500 });

  await sendDashboardLink(customer.email, customerLoginUrl(customer.email), customer.contactId);
  return NextResponse.json({ ok: true, emailMasked: mask(customer.email) });
}
