import { sb, type Lead } from "@/lib/leads";
import type { Evaluation } from "@/lib/evaluations";
import { PROVIDER_IDS, type ProviderId } from "@/lib/providers";

/* A business is one paying contact's published profile.
 *
 * It is created the moment a BiLabs subscription is paid for — pre-filled from
 * the free check that sold it, so the customer confirms rather than retypes —
 * and it owns the product state:
 *
 *   onboarding  wizard not finished; nothing published
 *   processing  published, first check not yet finished
 *   live        published and checked
 *   paused      billing lapsed, or an admin paused it; profile stays up
 *   cancelled   subscription ended; profile comes down
 *
 * Billing truth stays in bilabs_subscriptions. bilabs_leads is never touched
 * from here — its status and pipeline_status belong to nurture and sales. */

export type BusinessStatus = "onboarding" | "processing" | "live" | "paused" | "cancelled";
export const BUSINESS_STATUSES: BusinessStatus[] = ["onboarding", "processing", "live", "paused", "cancelled"];

/** Published profile (live) or about to be (processing). */
export const PUBLISHABLE: BusinessStatus[] = ["processing", "live"];

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type Service = { name: string; description?: string; price?: string };
export type Hours = { day: Day; open: string; close: string; closed: boolean };
export type PriceItem = { item: string; price: string };
export type Faq = { q: string; a: string };
export type Photo = { url: string; alt?: string };

export type Business = {
  id: string;
  contact_id: string;
  evaluation_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  slug: string | null;
  name: string | null;
  website: string | null;
  business_type: string | null;
  area: string | null;
  postcode: string | null;
  address: string | null;
  description: string | null;
  services: Service[];
  hours: Hours[];
  prices: PriceItem[];
  faqs: Faq[];
  areas: string[];
  photos: Photo[];
  socials: string[];
  phone: string | null;
  email: string | null;
  target_models: ProviderId[];
  status: BusinessStatus;
  onboarding_step: number;
  confirmed_at: string | null;
  details_completed_at: string | null;
  published_at: string | null;
  republished_at: string | null;
  indexnow_pinged_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  next_check_at: string | null;
  last_check_at: string | null;
  last_check_id: string | null;
  last_error: string | null;
  is_test: boolean;
  /* automation (0005): setup reminders, check retries, snippet detection */
  setup_nudge_step: number;
  setup_nudged_at: string | null;
  check_failures: number;
  trouble_notified_at: string | null;
  snippets_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Columns a customer may see. Stripe ids and internal bookkeeping stay out. */
export function publicBusiness(b: Business) {
  const { stripe_customer_id: _c, stripe_subscription_id: _s, evaluation_id: _e, last_error: _l, is_test: _t, ...rest } = b;
  void _c; void _s; void _e; void _l; void _t;
  return rest;
}

export async function getBusiness(id: string): Promise<Business | null> {
  const rows = await sb<Business[]>(`bilabs_businesses?id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] ?? null;
}

export async function getBusinessByContact(contactId: string): Promise<Business | null> {
  const rows = await sb<Business[]>(`bilabs_businesses?contact_id=eq.${encodeURIComponent(contactId)}&limit=1`);
  return rows?.[0] ?? null;
}

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const rows = await sb<Business[]>(`bilabs_businesses?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows?.[0] ?? null;
}

export async function updateBusiness(id: string, patch: Partial<Business>): Promise<Business | null> {
  const rows = await sb<Business[]>(`bilabs_businesses?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return rows?.[0] ?? null;
}

export async function setBusinessStatus(id: string, status: BusinessStatus, extra: Partial<Business> = {}): Promise<Business | null> {
  const now = new Date().toISOString();
  const stamp: Partial<Business> =
    status === "paused" ? { paused_at: now } : status === "cancelled" ? { cancelled_at: now } : { paused_at: null, cancelled_at: null };
  return updateBusiness(id, { status, ...stamp, ...extra });
}

/* ------------------------------------------------------------ prefill */

/** Fill a new business from the check that sold it. Only facts the check
 *  actually found; never a guess, and never an invented FAQ. */
export function prefillFromEvaluation(ev: Evaluation | null, lead: Lead): Partial<Business> {
  const e = ev?.enrichment ?? null;
  const first = (xs: string[] | undefined | null) => (xs && xs.length ? xs[0] : null);
  return {
    name: ev?.business_name || ev?.site_title || e?.title || lead.company || null,
    website: ev?.website || lead.website || null,
    business_type: ev?.business_type || lead.business_type || null,
    area: ev?.area || lead.area?.replace(/\s*\(.*\)\s*$/, "") || null,
    postcode: ev?.postcode || null,
    phone: ev?.phone || first(e?.phones) || lead.phone || null,
    email: first(e?.emails),
    address: e?.address ?? null,
    socials: e?.socials?.slice(0, 6) ?? [],
    target_models: [...PROVIDER_IDS],
  };
}

async function evaluationFor(contactId: string, evaluationId: string | null): Promise<Evaluation | null> {
  if (evaluationId && /^[0-9a-f-]{36}$/i.test(evaluationId)) {
    const rows = await sb<Evaluation[]>(`bilabs_evaluations?id=eq.${evaluationId}&limit=1`);
    if (rows?.[0]) return rows[0];
  }
  const rows = await sb<Evaluation[]>(
    `bilabs_evaluations?contact_id=eq.${contactId}&status=eq.completed&order=completed_at.desc&limit=1`,
  );
  return rows?.[0] ?? null;
}

/** Idempotent: the row for this contact, created from the paid checkout if it
 *  does not exist, reactivated if it was paused or cancelled. */
export async function ensureBusinessForCheckout(input: {
  lead: Lead;
  evaluationId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  plan: string | null;
  livemode: boolean;
}): Promise<Business | null> {
  const { lead } = input;
  const ids = {
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
    plan: input.plan,
  };

  const existing = await getBusinessByContact(lead.id);
  if (existing) {
    const reactivate = existing.status === "paused" || existing.status === "cancelled";
    return updateBusiness(existing.id, {
      ...ids,
      ...(reactivate
        ? { status: existing.published_at ? "live" : "onboarding", paused_at: null, cancelled_at: null }
        : {}),
    });
  }

  const ev = await evaluationFor(lead.id, input.evaluationId);
  const prefill = prefillFromEvaluation(ev, lead);
  const inserted = await sb<Business[]>("bilabs_businesses", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({
      contact_id: lead.id,
      evaluation_id: ev?.id ?? null,
      ...ids,
      ...prefill,
      status: "onboarding",
      is_test: !input.livemode || lead.is_test === true,
    }),
  });
  // A duplicate insert (two webhooks racing) returns nothing; read the winner.
  return inserted?.[0] ?? (await getBusinessByContact(lead.id));
}

/** Billing drives the product state, in one direction each way:
 *  a deleted or unpaid subscription takes the profile down or pauses it,
 *  a subscription that is paying again brings it back. */
export type SyncOutcome = { action: "paused" | "cancelled" | "restored" | null; business: Business | null };

/** Billing drives the profile. Returns what changed so the caller can tell
 *  the customer — the email is sent from the webhook, not from here. */
export async function syncBusinessWithSubscription(
  contactId: string,
  subStatus: string | null,
  eventType: string,
): Promise<SyncOutcome> {
  const b = await getBusinessByContact(contactId);
  if (!b) return { action: null, business: null };

  if (eventType === "customer.subscription.deleted" || subStatus === "canceled") {
    if (b.status !== "cancelled") {
      await setBusinessStatus(b.id, "cancelled");
      return { action: "cancelled", business: b };
    }
    return { action: null, business: b };
  }
  if (subStatus === "unpaid" || subStatus === "incomplete_expired") {
    if (b.status === "live" || b.status === "processing" || b.status === "onboarding") {
      await setBusinessStatus(b.id, "paused");
      return { action: "paused", business: b };
    }
    return { action: null, business: b };
  }
  if (subStatus === "active" || subStatus === "trialing") {
    if (b.status === "paused" || b.status === "cancelled") {
      await setBusinessStatus(b.id, b.published_at ? "live" : "onboarding");
      return { action: "restored", business: b };
    }
  }
  return { action: null, business: b };
}
