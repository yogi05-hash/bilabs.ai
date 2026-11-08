import { env } from "@/lib/env";
import { sb } from "@/lib/leads";

/* Stripe, scoped to BiLabs.
 *
 * This Stripe account is shared across several unrelated products. The old
 * dashboard asked it for `subscriptions?status=active` and summed the lot,
 * so the MRR and "active subscribers" shown on the BiLabs admin were in fact
 * other products' customers. BiLabs has exactly two products, and every query
 * in this file is filtered to them.
 *
 * The same sharing makes the webhook dangerous rather than merely wrong: one
 * endpoint per site receives the whole account's events, so a purchase of a
 * different product would otherwise mark someone a paying BiLabs customer and
 * email them about AI visibility. Nothing is acted on here until the product
 * has been checked.
 */

export type Money = { pence: number; currency: string };

export function stripeKey(): string {
  return env("STRIPE_SECRET_KEY");
}

/* Stripe calls get a hard deadline.
 *
 * Without one a stalled socket hangs the caller indefinitely: a webhook that
 * never returns is retried by Stripe, and a dashboard request just spins. An
 * ECONNRESET with no timeout held a request open for fifteen minutes during
 * testing. Ten seconds is far beyond a healthy Stripe response, and failing
 * returns null — which every caller already treats as "unknown", not "zero". */
const STRIPE_TIMEOUT_MS = 10_000;

export async function stripeGet<T = Record<string, unknown>>(path: string): Promise<T | null> {
  const key = stripeKey();
  if (!key) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[billing] stripe", path, res.status, (await res.text()).slice(0, 200));
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("[billing] stripe threw:", e);
    return null;
  }
}

/* The two BiLabs price ids are already configured for checkout. Their product
 * ids are resolved from them once and cached, so the ownership test needs no
 * second source of truth that could drift from what we actually sell. */
let productCache: { ids: string[]; at: number } | null = null;
const PRODUCT_TTL = 10 * 60 * 1000;

export async function bilabsProductIds(): Promise<string[]> {
  if (productCache && Date.now() - productCache.at < PRODUCT_TTL) return productCache.ids;

  const explicit = env("STRIPE_BILABS_PRODUCTS");
  if (explicit) {
    const ids = explicit.split(",").map((s) => s.trim()).filter(Boolean);
    productCache = { ids, at: Date.now() };
    return ids;
  }

  const priceIds = [env("STRIPE_PRICE_GET_FOUND"), env("STRIPE_PRICE_FRONT_DESK")].filter(Boolean);
  const ids: string[] = [];
  for (const p of priceIds) {
    const price = await stripeGet<{ product?: string }>(`prices/${encodeURIComponent(p)}`);
    if (price?.product) ids.push(price.product);
  }
  if (ids.length) productCache = { ids, at: Date.now() };
  return ids;
}

export async function isBilabsProduct(productId: string | null | undefined): Promise<boolean> {
  if (!productId) return false;
  return (await bilabsProductIds()).includes(productId);
}

export function planLabel(priceId: string | null): string | null {
  if (!priceId) return null;
  if (priceId === env("STRIPE_PRICE_GET_FOUND")) return "get-found";
  if (priceId === env("STRIPE_PRICE_FRONT_DESK")) return "front-desk";
  return null;
}

/* ------------------------------------------------------------------ MRR */

/* MRR, defined:
 *   - Counts subscriptions in status `active` or `trialing` only. Past-due is
 *     excluded, because money that has not arrived is not revenue; cancelled
 *     and incomplete are excluded outright.
 *   - An annual price contributes amount/12. Monthly contributes its amount.
 *     Weekly and daily intervals are normalised to a 30.4375-day month.
 *   - One-off payments never contribute. They are reported separately.
 *   - Quantity is honoured. Any coupon applied by hand in Stripe is NOT
 *     deducted: a one-off discount would understate the recurring run-rate.
 *     The amount actually charged still shows in payments received.
 *   - Currencies are never added together. Each currency is reported as its
 *     own line; there is no FX rate in this system and inventing one would
 *     make the headline number untraceable.
 */
export type MrrBreakdown = {
  byCurrency: Record<string, number>;
  activeCount: number;
  trialingCount: number;
  /** present only when every subscription is GBP, so a single headline is honest */
  gbpOnly: number | null;
  currencies: string[];
};

const MONTH_DAYS = 30.4375;

export function monthlyPence(unitAmount: number, interval: string | null, intervalCount = 1): number {
  const n = Math.max(1, intervalCount || 1);
  switch (interval) {
    case "year": return Math.round(unitAmount / (12 * n));
    case "month": return Math.round(unitAmount / n);
    case "week": return Math.round((unitAmount * (MONTH_DAYS / 7)) / n);
    case "day": return Math.round((unitAmount * MONTH_DAYS) / n);
    default: return 0;
  }
}

type StripeSub = {
  id: string;
  status: string;
  customer: string | { id: string; email?: string };
  livemode: boolean;
  created: number;
  start_date?: number;
  canceled_at?: number | null;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items?: { data: Array<{ quantity?: number; price?: StripePrice }> };
};
type StripePrice = {
  id: string;
  product: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string; interval_count?: number } | null;
};

/** Subscriptions for BiLabs products only, read live from Stripe. */
export async function bilabsSubscriptions(): Promise<StripeSub[] | null> {
  const ours = await bilabsProductIds();
  if (!ours.length) return null;

  const out: StripeSub[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ status: "all", limit: "100" });
    qs.append("expand[]", "data.customer");
    if (startingAfter) qs.set("starting_after", startingAfter);
    const d = await stripeGet<{ data: StripeSub[]; has_more: boolean }>(`subscriptions?${qs}`);
    if (!d) return out.length ? out : null;
    for (const s of d.data ?? []) {
      const owned = (s.items?.data ?? []).some((i) => i.price && ours.includes(i.price.product));
      if (owned) out.push(s);
    }
    if (!d.has_more || !d.data?.length) break;
    startingAfter = d.data[d.data.length - 1].id;
  }
  return out;
}

export function mrrFrom(subs: StripeSub[]): MrrBreakdown {
  const byCurrency: Record<string, number> = {};
  let active = 0;
  let trialing = 0;

  for (const s of subs) {
    if (s.status !== "active" && s.status !== "trialing") continue;
    if (s.status === "active") active++;
    else trialing++;

    for (const item of s.items?.data ?? []) {
      const p = item.price;
      if (!p?.recurring || p.unit_amount === null) continue;
      const amount = p.unit_amount * (item.quantity ?? 1);
      const cur = p.currency.toLowerCase();
      byCurrency[cur] = (byCurrency[cur] ?? 0) + monthlyPence(amount, p.recurring.interval, p.recurring.interval_count);
    }
  }

  const currencies = Object.keys(byCurrency);
  return {
    byCurrency,
    activeCount: active,
    trialingCount: trialing,
    gbpOnly: currencies.length === 0 ? 0 : currencies.length === 1 && currencies[0] === "gbp" ? byCurrency.gbp : null,
    currencies,
  };
}

/* ------------------------------------------------- local mirror writes */

export type PaymentRow = {
  id: string;
  kind: "payment" | "refund" | "payment_failed";
  email: string | null;
  contact_id: string | null;
  amount_pence: number;
  currency: string;
  plan: string | null;
  recurring: boolean;
  livemode: boolean;
  occurred_at: string;
  stripe_object_id: string | null;
};

export async function recordPayment(row: {
  stripeEventId: string;
  stripeObjectId: string | null;
  kind: "payment" | "refund" | "payment_failed";
  contactId: string | null;
  email: string | null;
  customerId: string | null;
  subscriptionId?: string | null;
  amountPence: number;
  currency: string;
  productId: string | null;
  priceId: string | null;
  plan: string | null;
  recurring: boolean;
  livemode: boolean;
  occurredAt: string;
}): Promise<void> {
  // on_conflict names the unique column explicitly — PostgREST otherwise
  // resolves against the primary key, and a redelivered Stripe event would
  // 409 instead of being quietly ignored.
  await sb("bilabs_payments?on_conflict=stripe_event_id", {
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    method: "POST",
    body: JSON.stringify({
      stripe_event_id: row.stripeEventId,
      stripe_object_id: row.stripeObjectId,
      kind: row.kind,
      contact_id: row.contactId,
      email: row.email,
      stripe_customer_id: row.customerId,
      stripe_subscription_id: row.subscriptionId ?? null,
      // refunds stored negative, so sum() over the table is net receipts
      amount_pence: row.kind === "refund" ? -Math.abs(row.amountPence) : row.amountPence,
      currency: row.currency.toLowerCase(),
      product_id: row.productId,
      price_id: row.priceId,
      plan: row.plan,
      recurring: row.recurring,
      livemode: row.livemode,
      occurred_at: row.occurredAt,
    }),
  });
}

export async function upsertSubscription(sub: {
  id: string;
  customerId: string | null;
  contactId: string | null;
  email: string | null;
  status: string;
  productId: string | null;
  priceId: string | null;
  plan: string | null;
  unitAmountPence: number | null;
  currency: string;
  interval: string | null;
  quantity: number;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  livemode: boolean;
  eventAt: string;
}): Promise<void> {
  // Stripe can deliver events out of order. Only write when this event is at
  // least as new as the last one applied, so a late "created" cannot undo a
  // "cancelled" that already landed.
  const existing = await sb<{ last_event_at: string | null }[]>(
    `bilabs_subscriptions?id=eq.${encodeURIComponent(sub.id)}&select=last_event_at&limit=1`,
  );
  const prev = existing?.[0]?.last_event_at;
  if (prev && new Date(sub.eventAt) < new Date(prev)) return;

  await sb("bilabs_subscriptions", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({
      id: sub.id,
      stripe_customer_id: sub.customerId,
      contact_id: sub.contactId,
      email: sub.email,
      status: sub.status,
      product_id: sub.productId,
      price_id: sub.priceId,
      plan: sub.plan,
      unit_amount_pence: sub.unitAmountPence,
      currency: sub.currency.toLowerCase(),
      interval: sub.interval,
      quantity: sub.quantity,
      started_at: sub.startedAt,
      current_period_end: sub.currentPeriodEnd,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      canceled_at: sub.canceledAt,
      livemode: sub.livemode,
      last_event_at: sub.eventAt,
      updated_at: new Date().toISOString(),
    }),
  });
}

export const unix = (n: number | null | undefined): string | null =>
  typeof n === "number" && n > 0 ? new Date(n * 1000).toISOString() : null;
