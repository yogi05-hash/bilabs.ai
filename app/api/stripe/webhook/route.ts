import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { getLeadByEmail, logEvent, sb, setStatus, upsertLead, type Lead } from "@/lib/leads";
import { sendWelcome } from "@/lib/nurture";
import { recordEvent } from "@/lib/analytics";
import { ensureBusinessForCheckout, getBusinessByContact, syncBusinessWithSubscription } from "@/lib/businesses";
import { sendPaused, sendPaymentFailed, sendRestored } from "@/lib/customerMail";
import { customerLoginUrl } from "@/lib/customerAuth";
import {
  isBilabsProduct,
  planLabel,
  recordPayment,
  stripeGet,
  unix,
  upsertSubscription,
} from "@/lib/billing";

export const runtime = "nodejs";

/* Stripe webhook.
 *
 * Three things have to be true before anything here changes a customer's
 * state, and each has bitten this endpoint or would have:
 *
 *  1. The signature verifies. An unverified webhook is a stranger claiming
 *     someone paid, and this endpoint marks people paid and emails them.
 *
 *  2. The purchase is OURS. This Stripe account is shared with several other
 *     products, and one endpoint per site receives the whole account's
 *     events. The previous version checked nothing, so a ShowBizy or
 *     YourBotChat sale would have created a BiLabs "customer" and sent them
 *     an onboarding email about AI visibility. Every handler now resolves the
 *     product and ignores anything that is not a BiLabs product.
 *
 *  3. We have not already handled it. Stripe retries on any non-2xx and can
 *     deliver out of order. Event ids are recorded before processing, so a
 *     redelivery is a no-op rather than a second welcome email and a second
 *     row of revenue.
 *
 * Visiting the success page is never sufficient to be marked paid — only a
 * verified event from this endpoint sets that.
 */

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

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

/** Claim the event. Returns false when it has already been handled. */
async function claim(ev: StripeEvent): Promise<boolean> {
  const rows = await sb<{ stripe_event_id: string }[]>("bilabs_webhook_events", {
    method: "POST",
    // a duplicate id simply returns nothing rather than erroring
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({
      stripe_event_id: ev.id,
      type: ev.type,
      api_created_at: unix(ev.created),
      livemode: ev.livemode,
      status: "received",
    }),
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function close(id: string, status: string, reason?: string) {
  await sb(`bilabs_webhook_events?stripe_event_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, reason: reason ?? null, processed_at: new Date().toISOString() }),
  });
}

type LineItem = { price?: { id: string; product: string; unit_amount: number | null; currency: string; recurring: { interval: string } | null }; quantity?: number };

/** The BiLabs line on this object, or null if the purchase was not ours. */
async function ourLine(items: LineItem[]): Promise<LineItem | null> {
  for (const i of items) {
    if (i.price && (await isBilabsProduct(i.price.product))) return i;
  }
  return null;
}

async function contactFor(email: string | null, customerId: string | null): Promise<Lead | null> {
  if (email) {
    const byEmail = await getLeadByEmail(email);
    if (byEmail) return byEmail;
  }
  if (customerId) {
    const rows = await sb<Lead[]>(`bilabs_leads?stripe_customer_id=eq.${encodeURIComponent(customerId)}&limit=1`);
    if (rows?.[0]) return rows[0];
  }
  return null;
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

  let event: StripeEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  if (!(await claim(event))) {
    // Already seen. 200 so Stripe stops retrying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const handled = await handle(event);
    await close(event.id, handled.status, handled.reason);
    return NextResponse.json({ received: true, ...handled });
  } catch (e) {
    console.error("[stripe] handler threw:", e);
    await close(event.id, "error", e instanceof Error ? e.message.slice(0, 300) : String(e));
    // 500 so Stripe retries; the claim row is already marked error and the
    // retry will not be treated as a duplicate because the id check happens
    // against a row we will have to clear manually if it keeps failing.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

async function handle(event: StripeEvent): Promise<{ status: string; reason?: string }> {
  const at = unix(event.created) ?? new Date().toISOString();

  /* --------------------------------------------- checkout completed */
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const sessionId = s.id as string;

    const li = await stripeGet<{ data: LineItem[] }>(`checkout/sessions/${sessionId}/line_items?limit=10&expand[]=data.price`);
    const line = await ourLine(li?.data ?? []);
    if (!line) return { status: "ignored_other_product", reason: "No BiLabs product on this session" };

    const email =
      (s.customer_email as string) ||
      ((s.customer_details as Record<string, unknown> | undefined)?.email as string) ||
      "";
    const customerId = (s.customer as string) ?? null;
    const meta = (s.metadata ?? {}) as Record<string, string>;
    const plan = meta.plan || planLabel(line.price?.id ?? null);

    let lead = await contactFor(email || null, customerId);
    if (!lead && email) {
      lead = await upsertLead({ email, source: "checkout", business_type: null, area: null });
    }

    // amount_total is what was actually charged, which is what receipts and
    // revenue must show — not the list price.
    const amount = Number(s.amount_total ?? 0);
    const currency = String(s.currency ?? "gbp");

    await recordPayment({
      stripeEventId: event.id,
      stripeObjectId: sessionId,
      kind: "payment",
      contactId: lead?.id ?? null,
      email: email || null,
      customerId,
      subscriptionId: (s.subscription as string) ?? null,
      amountPence: amount,
      currency,
      productId: line.price?.product ?? null,
      priceId: line.price?.id ?? null,
      plan,
      recurring: Boolean(line.price?.recurring),
      livemode: event.livemode,
      occurredAt: at,
    });

    if (lead) {
      await sb(`bilabs_leads?id=eq.${lead.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "paid",
          pipeline_status: "customer",
          stripe_customer_id: customerId,
          last_source: "checkout",
          updated_at: new Date().toISOString(),
        }),
      });
      await logEvent(lead.id, "paid", plan || "checkout completed");
      await recordEvent({
        name: "payment_succeeded",
        origin: "stripe",
        contactId: lead.id,
        visitorId: meta.visitor_id || null,
        evaluationId: meta.evaluation_id || null,
        dedupeKey: `stripe:${event.id}`,
        occurredAt: at,
        utm: { utm_source: meta.utm_source ?? null, utm_medium: meta.utm_medium ?? null, utm_campaign: meta.utm_campaign ?? null },
        props: { plan, amount_pence: amount, currency },
        isTest: !event.livemode,
      });
      /* The product starts here: a business row pre-filled from the check
       * that sold it, and a welcome email whose link signs them straight into
       * the setup wizard. Nurture stops on its own because the lead's status
       * is no longer "nurturing". */
      const business = await ensureBusinessForCheckout({
        lead,
        evaluationId: meta.evaluation_id || null,
        customerId,
        subscriptionId: (s.subscription as string) ?? null,
        plan: plan ?? null,
        livemode: event.livemode,
      });
      const dashboardUrl = business && lead.email ? customerLoginUrl(lead.email) : null;
      await sendWelcome({ ...lead, status: "paid" }, { dashboardUrl });
    }
    return { status: "processed" };
  }

  /* ------------------------------------------- recurring invoices */
  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
    const inv = event.data.object;
    const lines = ((inv.lines as { data?: LineItem[] } | undefined)?.data ?? []) as LineItem[];
    const line = await ourLine(lines);
    if (!line) return { status: "ignored_other_product", reason: "No BiLabs product on this invoice" };

    const email = (inv.customer_email as string) || null;
    const customerId = (inv.customer as string) ?? null;
    const lead = await contactFor(email, customerId);
    const failed = event.type === "invoice.payment_failed";

    await recordPayment({
      stripeEventId: event.id,
      stripeObjectId: inv.id as string,
      kind: failed ? "payment_failed" : "payment",
      contactId: lead?.id ?? null,
      email,
      customerId,
      subscriptionId: (inv.subscription as string) ?? null,
      amountPence: Number(failed ? inv.amount_due ?? 0 : inv.amount_paid ?? 0),
      currency: String(inv.currency ?? "gbp"),
      productId: line.price?.product ?? null,
      priceId: line.price?.id ?? null,
      plan: planLabel(line.price?.id ?? null),
      recurring: true,
      livemode: event.livemode,
      occurredAt: at,
    });

    if (lead) {
      await logEvent(lead.id, failed ? "payment_failed" : "payment", `invoice ${inv.id as string}`);
      await recordEvent({
        name: failed ? "subscription_updated" : "payment_succeeded",
        origin: "stripe",
        contactId: lead.id,
        dedupeKey: `stripe:${event.id}`,
        occurredAt: at,
        props: { invoice: inv.id, failed },
        isTest: !event.livemode,
      });
      // Tell them before Stripe gives up, while the fix is still one minute.
      if (failed && lead.email && !lead.is_test && event.livemode) {
        const business = await getBusinessByContact(lead.id);
        await sendPaymentFailed(lead, business, Number(inv.amount_due ?? 0));
      }
    }
    return { status: "processed" };
  }

  /* ------------------------------------------------------ refunds */
  if (event.type === "charge.refunded") {
    const ch = event.data.object;
    // A charge carries no price, so ownership is established through the
    // invoice it belongs to.
    const invoiceId = ch.invoice as string | null;
    if (!invoiceId) return { status: "ignored_other_product", reason: "Refund not tied to an invoice" };
    const inv = await stripeGet<{ lines?: { data?: LineItem[] }; customer_email?: string; customer?: string }>(
      `invoices/${invoiceId}?expand[]=lines.data.price`,
    );
    const line = await ourLine(inv?.lines?.data ?? []);
    if (!line) return { status: "ignored_other_product", reason: "Refund is not for a BiLabs product" };

    const email = inv?.customer_email ?? null;
    const customerId = (ch.customer as string) ?? null;
    const lead = await contactFor(email, customerId);

    await recordPayment({
      stripeEventId: event.id,
      stripeObjectId: ch.id as string,
      kind: "refund",
      contactId: lead?.id ?? null,
      email,
      customerId,
      amountPence: Number(ch.amount_refunded ?? 0),
      currency: String(ch.currency ?? "gbp"),
      productId: line.price?.product ?? null,
      priceId: line.price?.id ?? null,
      plan: planLabel(line.price?.id ?? null),
      recurring: true,
      livemode: event.livemode,
      occurredAt: at,
    });

    if (lead) {
      await logEvent(lead.id, "refund", `charge ${ch.id as string}`);
      await recordEvent({
        name: "refund_recorded",
        origin: "stripe",
        contactId: lead.id,
        dedupeKey: `stripe:${event.id}`,
        occurredAt: at,
        props: { amount_pence: Number(ch.amount_refunded ?? 0) },
        isTest: !event.livemode,
      });
    }
    return { status: "processed" };
  }

  /* ------------------------------------------------ subscriptions */
  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object;
    const items = ((sub.items as { data?: LineItem[] } | undefined)?.data ?? []) as LineItem[];
    const line = await ourLine(items);
    if (!line) return { status: "ignored_other_product", reason: "Subscription is not a BiLabs product" };

    const customerId = (sub.customer as string) ?? null;
    const cust = customerId ? await stripeGet<{ email?: string }>(`customers/${customerId}`) : null;
    const email = cust?.email ?? null;
    const lead = await contactFor(email, customerId);
    const status = String(sub.status ?? "");

    await upsertSubscription({
      id: sub.id as string,
      customerId,
      contactId: lead?.id ?? null,
      email,
      status,
      productId: line.price?.product ?? null,
      priceId: line.price?.id ?? null,
      plan: planLabel(line.price?.id ?? null),
      unitAmountPence: line.price?.unit_amount ?? null,
      currency: line.price?.currency ?? "gbp",
      interval: line.price?.recurring?.interval ?? null,
      quantity: line.quantity ?? 1,
      startedAt: unix(sub.start_date as number),
      currentPeriodEnd: unix(sub.current_period_end as number),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      canceledAt: unix(sub.canceled_at as number),
      livemode: event.livemode,
      eventAt: at,
    });

    if (lead) {
      await recordEvent({
        name: "subscription_updated",
        origin: "stripe",
        contactId: lead.id,
        dedupeKey: `stripe:${event.id}`,
        occurredAt: at,
        props: { status, subscription: sub.id },
        isTest: !event.livemode,
      });
      // Billing drives the published profile: unpaid pauses it, deleted takes
      // it down, paying again brings it back.
      const sync = await syncBusinessWithSubscription(lead.id, status, event.type);
      if (sync.business && lead.email && !lead.is_test && event.livemode) {
        if (sync.action === "paused") await sendPaused(lead, sync.business);
        if (sync.action === "restored") await sendRestored(lead, sync.business);
      }
      // Only a genuine end of the relationship closes the contact. An update
      // that merely flags cancel_at_period_end has not ended anything yet.
      if (event.type === "customer.subscription.deleted") {
        await setStatus(lead.id, "lost", "subscription cancelled");
        await sb(`bilabs_leads?id=eq.${lead.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ pipeline_status: "closed" }),
        });
      }
    }
    return { status: "processed" };
  }

  return { status: "ignored", reason: `Unhandled type ${event.type}` };
}
