import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createCheckoutSession, isPlanId } from "@/lib/checkout";
import { sb, type Lead } from "@/lib/leads";
import { getBusinessByContact } from "@/lib/businesses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The one-click pay link.
 *
 *   /start?plan=get-found&c=<contact id>&e=<evaluation id>&src=report
 *
 * Every email we send — the free report, the nurture sequence — points here
 * rather than at the pricing section, so paying is one tap from the inbox:
 * this opens Stripe Checkout with the person's email filled in and their free
 * check attached, which is what lets the paid profile pre-fill from it.
 *
 * The ids are the unguessable UUIDs already in those emails; knowing one
 * only pre-fills an email address on a payment form, it grants nothing.
 * Someone who already pays is sent to their dashboard instead of a second
 * subscription. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const q = req.nextUrl.searchParams;
  const plan = q.get("plan") ?? "get-found";
  if (!isPlanId(plan)) return NextResponse.redirect(`${site}/#packages`, 303);

  const contactId = UUID.test(q.get("c") ?? "") ? q.get("c") : null;
  const evaluationId = UUID.test(q.get("e") ?? "") ? q.get("e") : null;
  const src = (q.get("src") ?? "link").replace(/[^a-z0-9_-]/gi, "").slice(0, 60);

  let email: string | null = null;
  let leadId: string | null = contactId;
  if (contactId) {
    const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${contactId}&select=id,email,merged_into&limit=1`);
    let lead = rows?.[0] ?? null;
    if (lead?.merged_into) {
      const m = await sb<Lead[]>(`bilabs_leads?id=eq.${lead.merged_into}&select=id,email,merged_into&limit=1`);
      lead = m?.[0] ?? lead;
    }
    if (lead) {
      leadId = lead.id;
      email = lead.email;
      // already a customer: the dashboard is the right place, not a second checkout
      if (await getBusinessByContact(lead.id)) return NextResponse.redirect(`${site}/dashboard`, 303);
    }
  } else if (evaluationId) {
    const ev = await sb<{ contact_id: string | null }[]>(`bilabs_evaluations?id=eq.${evaluationId}&select=contact_id&limit=1`);
    const cid = ev?.[0]?.contact_id ?? null;
    if (cid) {
      const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${cid}&select=id,email&limit=1`);
      leadId = rows?.[0]?.id ?? null;
      email = rows?.[0]?.email ?? null;
    }
  }

  const r = await createCheckoutSession({
    request: req,
    plan,
    email,
    evaluationId,
    contactId: leadId,
    utm: { utm_source: q.get("utm_source") ?? "email", utm_medium: q.get("utm_medium") ?? "link", utm_campaign: q.get("utm_campaign") ?? src },
    via: "link",
    src,
  });
  if (!r.ok) {
    console.error("[start] checkout failed:", r.error);
    return NextResponse.redirect(`${site}/#packages`, 303);
  }
  return NextResponse.redirect(r.url, 303);
}
