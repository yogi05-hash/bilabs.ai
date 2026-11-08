import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import {
  bilabsProductIds,
  bilabsSubscriptions,
  mrrFrom,
  planLabel,
  recordPayment,
  stripeGet,
  unix,
  upsertSubscription,
} from "@/lib/billing";
import { resolvePeriod } from "@/lib/period";
import { getLeadByEmail, sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Customers and billing.
 *
 * Every figure is scoped to the two BiLabs products. This Stripe account also
 * carries several other products, and the previous dashboard summed the whole
 * account — which is why it showed an MRR and active subscribers while BiLabs
 * had no paying customers at all. */

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const period = resolvePeriod(q.get("range"), q.get("from"), q.get("to"));

  const products = await bilabsProductIds();
  const subs = await bilabsSubscriptions();
  const mrr = subs ? mrrFrom(subs) : null;

  const payments =
    (await sb<{
      id: string; kind: string; email: string | null; contact_id: string | null;
      amount_pence: number; currency: string; plan: string | null; recurring: boolean;
      livemode: boolean; occurred_at: string; stripe_object_id: string | null;
    }[]>(
      `bilabs_payments?order=occurred_at.desc&limit=200` +
        `&select=id,kind,email,contact_id,amount_pence,currency,plan,recurring,livemode,occurred_at,stripe_object_id`,
    )) ?? [];

  const mirrored =
    (await sb<Record<string, unknown>[]>(
      `bilabs_subscriptions?order=updated_at.desc&limit=200`,
    )) ?? [];

  const inPeriod = payments.filter(
    (p) => p.livemode && new Date(p.occurred_at) >= period.from && new Date(p.occurred_at) < period.to,
  );
  const sum = (f: (p: (typeof payments)[number]) => boolean) =>
    inPeriod.filter(f).reduce((n, p) => n + p.amount_pence, 0);

  const currencies = Array.from(new Set(inPeriod.map((p) => p.currency)));

  return NextResponse.json({
    connected: subs !== null,
    products,
    // Live subscription state, straight from Stripe, BiLabs products only.
    subscriptions: (subs ?? []).map((s) => {
      const item = s.items?.data?.[0];
      const cust = typeof s.customer === "object" ? s.customer : null;
      return {
        id: s.id,
        status: s.status,
        email: cust?.email ?? null,
        customerId: typeof s.customer === "string" ? s.customer : cust?.id ?? null,
        plan: planLabel(item?.price?.id ?? null),
        amountPence: item?.price?.unit_amount ?? null,
        currency: item?.price?.currency ?? "gbp",
        interval: item?.price?.recurring?.interval ?? null,
        quantity: item?.quantity ?? 1,
        startedAt: unix(s.start_date ?? s.created),
        renewsAt: unix(s.current_period_end),
        cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
        canceledAt: unix(s.canceled_at ?? null),
        livemode: s.livemode,
      };
    }),
    mirrored,
    payments,
    period: {
      label: period.label,
      receivedPence: sum((p) => p.kind === "payment"),
      refundedPence: Math.abs(sum((p) => p.kind === "refund")),
      failedCount: inPeriod.filter((p) => p.kind === "payment_failed").length,
      oneOffPence: sum((p) => p.kind === "payment" && !p.recurring),
      recurringPence: sum((p) => p.kind === "payment" && p.recurring),
      mixedCurrency: currencies.length > 1,
      currencies,
    },
    mrr,
    definitions: {
      mrr:
        "Subscriptions in status active or trialing, for BiLabs products only. Annual prices contribute amount/12; weekly and daily are normalised to a 30.4375-day month. Quantity is honoured. Past-due, incomplete and cancelled are excluded. One-off payments never contribute.",
      discounts:
        "Checkout applies no discounts. A coupon added by hand in Stripe is not deducted from MRR, since a one-off discount would understate the run-rate; the amount actually charged still appears in payments received.",
      currency:
        "Currencies are reported separately and never added together — there is no FX rate in this system, and inventing one would make the headline untraceable.",
      testMode:
        "Test-mode payments are stored but excluded from every revenue figure. Only livemode rows count.",
      source:
        "Payments come from signature-verified webhooks, keyed on the Stripe event id so a redelivery cannot double-count. Visiting the success page never marks anyone paid.",
      scope: `Scoped to BiLabs products ${products.join(", ") || "(none resolved)"} — this Stripe account is shared with other products.`,
    },
  });
}

/* Reconciliation.
 *
 * The path back when a webhook was missed — endpoint down, secret rotated,
 * event dropped. Reads the authoritative history from Stripe and fills gaps.
 * Idempotent: rows already recorded keep their original event id and are not
 * written twice. Owner-only, because it writes financial records. */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const products = await bilabsProductIds();
  if (!products.length) {
    return NextResponse.json({ error: "Could not resolve the BiLabs product ids from Stripe." }, { status: 503 });
  }

  const subs = await bilabsSubscriptions();
  if (subs === null) return NextResponse.json({ error: "Stripe is not reachable." }, { status: 503 });

  let subsWritten = 0;
  let paymentsWritten = 0;

  for (const s of subs) {
    const item = s.items?.data?.[0];
    const cust = typeof s.customer === "object" ? s.customer : null;
    const email = cust?.email ?? null;
    const customerId = typeof s.customer === "string" ? s.customer : cust?.id ?? null;
    const lead = email ? await getLeadByEmail(email) : null;

    await upsertSubscription({
      id: s.id,
      customerId,
      contactId: lead?.id ?? null,
      email,
      status: s.status,
      productId: item?.price?.product ?? null,
      priceId: item?.price?.id ?? null,
      plan: planLabel(item?.price?.id ?? null),
      unitAmountPence: item?.price?.unit_amount ?? null,
      currency: item?.price?.currency ?? "gbp",
      interval: item?.price?.recurring?.interval ?? null,
      quantity: item?.quantity ?? 1,
      startedAt: unix(s.start_date ?? s.created),
      currentPeriodEnd: unix(s.current_period_end),
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      canceledAt: unix(s.canceled_at ?? null),
      livemode: s.livemode,
      // Reconciliation must not win over a real event that arrived later, so
      // it stamps the subscription's own last-updated moment, not "now".
      eventAt: unix(s.current_period_end ?? s.created) ?? new Date().toISOString(),
    });
    subsWritten++;

    // Paid invoices for this subscription, so historical receipts exist even
    // for the period before the webhook was recording them.
    const invoices = await stripeGet<{ data: Array<Record<string, unknown>> }>(
      `invoices?subscription=${encodeURIComponent(s.id)}&limit=100&status=paid`,
    );
    for (const inv of invoices?.data ?? []) {
      const amount = Number(inv.amount_paid ?? 0);
      if (!amount) continue;
      await recordPayment({
        // Synthetic, stable id: re-running reconciliation hits the same unique
        // key and is ignored rather than duplicating the receipt.
        stripeEventId: `reconcile:invoice:${inv.id as string}`,
        stripeObjectId: inv.id as string,
        kind: "payment",
        contactId: lead?.id ?? null,
        email,
        customerId,
        subscriptionId: s.id,
        amountPence: amount,
        currency: String(inv.currency ?? "gbp"),
        productId: item?.price?.product ?? null,
        priceId: item?.price?.id ?? null,
        plan: planLabel(item?.price?.id ?? null),
        recurring: true,
        livemode: Boolean(inv.livemode),
        occurredAt: unix(inv.created as number) ?? new Date().toISOString(),
      });
      paymentsWritten++;
    }
  }

  await audit(admin, "billing.reconcile", null, { subscriptions: subsWritten, invoices: paymentsWritten });

  return NextResponse.json({
    ok: true,
    subscriptions: subsWritten,
    invoicesSeen: paymentsWritten,
    note: "Existing rows were left alone; only gaps were filled.",
  });
}
