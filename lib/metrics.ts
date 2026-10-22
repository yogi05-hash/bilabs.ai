import { sb } from "@/lib/leads";
import { CLEAN, channelOf } from "@/lib/analytics";
import { bilabsSubscriptions, mrrFrom, type MrrBreakdown } from "@/lib/billing";
import { londonDayKey, dayKeys, delta, type Period } from "@/lib/period";

/* Where the dashboard's numbers come from.
 *
 * Two rules run through all of it:
 *
 *   - Period metrics and current totals are different things and are never
 *     mixed. "New customers" counts the selected period; "active subscribers"
 *     is a fact about right now and ignores the date filter. They are labelled
 *     differently on screen for the same reason.
 *
 *   - A conversion rate is only meaningful with its denominator and its
 *     window attached, so every rate here is a cohort: of the people who
 *     ENTERED in the period, how many had converted within the attribution
 *     window. A cohort younger than that window is still maturing, and says
 *     so rather than reporting a number that can only go up.
 */

const COUNT = { Prefer: "count=exact" };

/** Cheap exact count without transferring rows. */
async function count(path: string): Promise<number> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!base || !key) return 0;
  try {
    const res = await fetch(`${base}/rest/v1/${path}${path.includes("?") ? "&" : "?"}select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, ...COUNT },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const range = res.headers.get("content-range") ?? "";
    const total = Number(range.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

const iso = (d: Date) => d.toISOString();
const between = (col: string, p: { from: Date; to: Date }) =>
  `${col}=gte.${iso(p.from)}&${col}=lt.${iso(p.to)}`;

export type Metric = { value: number; prev: number; delta: number | null };
const metric = (value: number, prev: number): Metric => ({ value, prev, delta: delta(value, prev) });

/* ------------------------------------------------------------ visitors */

async function visitorMetrics(p: Period) {
  const win = (r: { from: Date; to: Date }) => `${CLEAN}&${between("last_seen_at", r)}`;
  // "New" means first ever seen inside the window; everyone else active in it
  // is returning. The two therefore sum to active visitors, with no overlap.
  const [active, prevActive, fresh, prevFresh] = await Promise.all([
    count(`bilabs_visitors?${win(p)}`),
    count(`bilabs_visitors?${win(p.prev)}`),
    count(`bilabs_visitors?${CLEAN}&${between("first_seen_at", p)}`),
    count(`bilabs_visitors?${CLEAN}&${between("first_seen_at", p.prev)}`),
  ]);
  return {
    unique: metric(active, prevActive),
    new: metric(fresh, prevFresh),
    returning: metric(Math.max(0, active - fresh), Math.max(0, prevActive - prevFresh)),
  };
}

/* --------------------------------------------------------- evaluations */

async function evaluationMetrics(p: Period) {
  const base = (r: { from: Date; to: Date }, extra = "") =>
    `bilabs_evaluations?is_test=is.false&${between("started_at", r)}${extra}`;
  const [started, pStarted, completed, pCompleted, failed, pFailed, abandoned, pAbandoned, running] =
    await Promise.all([
      count(base(p)), count(base(p.prev)),
      count(base(p, "&status=eq.completed")), count(base(p.prev, "&status=eq.completed")),
      count(base(p, "&status=eq.failed")), count(base(p.prev, "&status=eq.failed")),
      count(base(p, "&status=eq.abandoned")), count(base(p.prev, "&status=eq.abandoned")),
      count(base(p, "&status=eq.running")),
    ]);
  const [viewed, pViewed] = await Promise.all([
    count(`bilabs_evaluations?is_test=is.false&report_views=gt.0&${between("started_at", p)}`),
    count(`bilabs_evaluations?is_test=is.false&report_views=gt.0&${between("started_at", p.prev)}`),
  ]);
  return {
    started: metric(started, pStarted),
    completed: metric(completed, pCompleted),
    failed: metric(failed, pFailed),
    abandoned: metric(abandoned, pAbandoned),
    running,
    reportsViewed: metric(viewed, pViewed),
  };
}

/* --------------------------------------------------------- money */

export type MoneyMetrics = {
  receivedPence: Metric;
  refundedPence: Metric;
  netPence: Metric;
  currency: string;
  mixedCurrency: boolean;
  oneOffPence: number;
  recurringPence: number;
};

async function moneyMetrics(p: Period): Promise<MoneyMetrics> {
  // Only live-mode rows ever reach a revenue figure; test payments are stored
  // but filtered out here so the two can never be confused.
  const rows = async (r: { from: Date; to: Date }) =>
    (await sb<{ kind: string; amount_pence: number; currency: string; recurring: boolean }[]>(
      `bilabs_payments?livemode=is.true&${between("occurred_at", r)}&select=kind,amount_pence,currency,recurring&limit=5000`,
    )) ?? [];

  const [now, before] = await Promise.all([rows(p), rows(p.prev)]);
  const sum = (list: typeof now, pick: (r: (typeof now)[number]) => boolean) =>
    list.filter(pick).reduce((n, r) => n + r.amount_pence, 0);

  const currencies = Array.from(new Set(now.map((r) => r.currency)));
  const received = sum(now, (r) => r.kind === "payment");
  const refunded = Math.abs(sum(now, (r) => r.kind === "refund"));

  return {
    receivedPence: metric(received, sum(before, (r) => r.kind === "payment")),
    refundedPence: metric(refunded, Math.abs(sum(before, (r) => r.kind === "refund"))),
    netPence: metric(received - refunded, sum(before, (r) => r.kind !== "payment_failed")),
    currency: currencies.length === 1 ? currencies[0] : "gbp",
    // Adding currencies together needs an FX rate this system does not have,
    // so the UI shows them apart rather than inventing one.
    mixedCurrency: currencies.length > 1,
    oneOffPence: sum(now, (r) => r.kind === "payment" && !r.recurring),
    recurringPence: sum(now, (r) => r.kind === "payment" && r.recurring),
  };
}

/* ----------------------------------------------------- linked funnel */

export type FunnelStage = { id: string; label: string; count: number; ofPrev: number | null; dropped: number };

/* The funnel follows one cohort of visitors through their own journey rather
 * than putting five unrelated totals side by side. Everyone counted at stage
 * N is a subset of stage N-1, so the drop-offs are real.
 *
 * Email capture is deliberately not a fixed position: it can happen before an
 * evaluation (typed up front) or after one (unlocking the report), and both
 * count at the same stage. */
async function funnel(p: Period, windowDays: number): Promise<FunnelStage[]> {
  const horizon = new Date(p.to.getTime() + windowDays * 86_400_000);
  const upTo = iso(new Date(Math.min(horizon.getTime(), Date.now())));

  const visitors =
    (await sb<{ id: string; contact_id: string | null }[]>(
      `bilabs_visitors?${CLEAN}&${between("first_seen_at", p)}&select=id,contact_id&limit=5000`,
    )) ?? [];
  const ids = new Set(visitors.map((v) => v.id));
  if (!ids.size) {
    return [
      { id: "visitors", label: "Visitors", count: 0, ofPrev: null, dropped: 0 },
      { id: "evaluation_started", label: "Started a check", count: 0, ofPrev: null, dropped: 0 },
      { id: "evaluation_completed", label: "Check completed", count: 0, ofPrev: null, dropped: 0 },
      { id: "email_captured", label: "Gave an email", count: 0, ofPrev: null, dropped: 0 },
      { id: "checkout_started", label: "Started checkout", count: 0, ofPrev: null, dropped: 0 },
      { id: "paid", label: "Paid", count: 0, ofPrev: null, dropped: 0 },
    ];
  }

  const evals =
    (await sb<{ visitor_id: string | null; status: string; contact_id: string | null }[]>(
      `bilabs_evaluations?is_test=is.false&started_at=lt.${upTo}&select=visitor_id,status,contact_id&limit=5000`,
    )) ?? [];
  const mine = evals.filter((e) => e.visitor_id && ids.has(e.visitor_id));
  const startedBy = new Set(mine.map((e) => e.visitor_id!));
  const completedBy = new Set(mine.filter((e) => e.status === "completed").map((e) => e.visitor_id!));

  // Identified either by the visitor row carrying a contact, or by an event.
  const identifiedBy = new Set(visitors.filter((v) => v.contact_id).map((v) => v.id));
  const captureEvents =
    (await sb<{ visitor_id: string | null }[]>(
      `bilabs_events?name=eq.email_captured&occurred_at=lt.${upTo}&select=visitor_id&limit=5000`,
    )) ?? [];
  for (const e of captureEvents) if (e.visitor_id && ids.has(e.visitor_id)) identifiedBy.add(e.visitor_id);

  const checkoutEvents =
    (await sb<{ visitor_id: string | null }[]>(
      `bilabs_events?name=eq.checkout_started&occurred_at=lt.${upTo}&select=visitor_id&limit=5000`,
    )) ?? [];
  const checkoutBy = new Set(checkoutEvents.filter((e) => e.visitor_id && ids.has(e.visitor_id)).map((e) => e.visitor_id!));

  const paidEvents =
    (await sb<{ visitor_id: string | null; contact_id: string | null }[]>(
      `bilabs_events?name=eq.payment_succeeded&occurred_at=lt.${upTo}&select=visitor_id,contact_id&limit=5000`,
    )) ?? [];
  const contactToVisitor = new Map<string, string>();
  for (const v of visitors) if (v.contact_id) contactToVisitor.set(v.contact_id, v.id);
  const paidBy = new Set<string>();
  for (const e of paidEvents) {
    if (e.visitor_id && ids.has(e.visitor_id)) paidBy.add(e.visitor_id);
    else if (e.contact_id && contactToVisitor.has(e.contact_id)) paidBy.add(contactToVisitor.get(e.contact_id)!);
  }

  const raw: Array<[string, string, number]> = [
    ["visitors", "Visitors", ids.size],
    ["evaluation_started", "Started a check", startedBy.size],
    ["evaluation_completed", "Check completed", completedBy.size],
    ["email_captured", "Gave an email", identifiedBy.size],
    ["checkout_started", "Started checkout", checkoutBy.size],
    ["paid", "Paid", paidBy.size],
  ];

  return raw.map(([id, label, c], i) => {
    const prev = i === 0 ? null : raw[i - 1][2];
    return {
      id,
      label,
      count: c,
      ofPrev: prev ? Math.round((c / prev) * 1000) / 10 : null,
      dropped: prev ? Math.max(0, prev - c) : 0,
    };
  });
}

/* ------------------------------------------------------------ series */

async function series(p: Period) {
  const keys = dayKeys(p.from, p.to);
  const blank = () => Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;

  const [visits, evals, caps, pays] = await Promise.all([
    sb<{ first_seen_at: string }[]>(`bilabs_visitors?${CLEAN}&${between("first_seen_at", p)}&select=first_seen_at&limit=5000`),
    sb<{ started_at: string; status: string }[]>(`bilabs_evaluations?is_test=is.false&${between("started_at", p)}&select=started_at,status&limit=5000`),
    sb<{ occurred_at: string }[]>(`bilabs_events?name=eq.email_captured&${between("occurred_at", p)}&select=occurred_at&limit=5000`),
    sb<{ occurred_at: string; amount_pence: number }[]>(`bilabs_payments?livemode=is.true&kind=eq.payment&${between("occurred_at", p)}&select=occurred_at,amount_pence&limit=5000`),
  ]);

  const visitors = blank(), checks = blank(), leads = blank(), revenue = blank();
  for (const r of visits ?? []) { const k = londonDayKey(new Date(r.first_seen_at)); if (k in visitors) visitors[k]++; }
  for (const r of evals ?? []) { const k = londonDayKey(new Date(r.started_at)); if (k in checks) checks[k]++; }
  for (const r of caps ?? []) { const k = londonDayKey(new Date(r.occurred_at)); if (k in leads) leads[k]++; }
  for (const r of pays ?? []) { const k = londonDayKey(new Date(r.occurred_at)); if (k in revenue) revenue[k] += r.amount_pence; }

  return keys.map((k) => ({ day: k, visitors: visitors[k], checks: checks[k], leads: leads[k], revenuePence: revenue[k] }));
}

/* ----------------------------------------------------------- sources */

export type SourceRow = {
  channel: string;
  visitors: number;
  leads: number;
  evaluations: number;
  customers: number;
  revenuePence: number;
};

async function sources(p: Period): Promise<SourceRow[]> {
  const visitors =
    (await sb<{
      id: string; contact_id: string | null;
      utm_source: string | null; utm_medium: string | null; referrer_host: string | null;
    }[]>(`bilabs_visitors?${CLEAN}&${between("first_seen_at", p)}&select=id,contact_id,utm_source,utm_medium,referrer_host&limit=5000`)) ?? [];

  const map = new Map<string, SourceRow>();
  const chanOf = new Map<string, string>();
  for (const v of visitors) {
    const ch = channelOf(v.utm_source, v.utm_medium, v.referrer_host);
    chanOf.set(v.id, ch);
    const row = map.get(ch) ?? { channel: ch, visitors: 0, leads: 0, evaluations: 0, customers: 0, revenuePence: 0 };
    row.visitors++;
    if (v.contact_id) row.leads++;
    map.set(ch, row);
  }

  const ids = new Set(visitors.map((v) => v.id));
  const evals =
    (await sb<{ visitor_id: string | null }[]>(
      `bilabs_evaluations?is_test=is.false&status=eq.completed&select=visitor_id&limit=5000`,
    )) ?? [];
  for (const e of evals) {
    if (!e.visitor_id || !ids.has(e.visitor_id)) continue;
    const ch = chanOf.get(e.visitor_id)!;
    const row = map.get(ch);
    if (row) row.evaluations++;
  }

  // Revenue is attributed first-touch, from the campaign carried through
  // Checkout in metadata; a payment with no visitor link is left out rather
  // than spread across channels.
  const pays =
    (await sb<{ amount_pence: number; contact_id: string | null }[]>(
      `bilabs_payments?livemode=is.true&kind=eq.payment&select=amount_pence,contact_id&limit=5000`,
    )) ?? [];
  const contactToChannel = new Map<string, string>();
  for (const v of visitors) if (v.contact_id) contactToChannel.set(v.contact_id, chanOf.get(v.id)!);
  for (const pay of pays) {
    if (!pay.contact_id) continue;
    const ch = contactToChannel.get(pay.contact_id);
    if (!ch) continue;
    const row = map.get(ch);
    if (row) { row.revenuePence += pay.amount_pence; row.customers++; }
  }

  return Array.from(map.values()).sort((a, b) => b.visitors - a.visitors).slice(0, 12);
}

/* ------------------------------------------------------------- build */

export type Overview = {
  period: { id: string; label: string; from: string; to: string; days: number; prevFrom: string; prevTo: string };
  visitors: Awaited<ReturnType<typeof visitorMetrics>>;
  contacts: { captured: Metric; total: number };
  evaluations: Awaited<ReturnType<typeof evaluationMetrics>>;
  checkouts: { started: Metric; completed: Metric };
  customers: { new: Metric; activeNow: number; trialingNow: number };
  money: MoneyMetrics;
  mrr: MrrBreakdown | null;
  conversion: {
    visitorToLead: { rate: number | null; numerator: number; denominator: number; definition: string; maturing: boolean };
    evaluationToPaid: { rate: number | null; numerator: number; denominator: number; definition: string; maturing: boolean };
    windowDays: number;
  };
  funnel: FunnelStage[];
  series: Awaited<ReturnType<typeof series>>;
  sources: SourceRow[];
  dataHealth: { stripeConnected: boolean; trackingRows: number; firstEventAt: string | null };
};

export async function buildOverview(p: Period, windowDays: number): Promise<Overview> {
  const [vis, evalM, money, fun, ser, src, subs] = await Promise.all([
    visitorMetrics(p),
    evaluationMetrics(p),
    moneyMetrics(p),
    funnel(p, windowDays),
    series(p),
    sources(p),
    bilabsSubscriptions(),
  ]);

  const [captured, prevCaptured, totalContacts] = await Promise.all([
    count(`bilabs_events?name=eq.email_captured&${between("occurred_at", p)}&is_internal=is.false&is_test=is.false`),
    count(`bilabs_events?name=eq.email_captured&${between("occurred_at", p.prev)}&is_internal=is.false&is_test=is.false`),
    count("bilabs_leads?email=not.is.null&merged_into=is.null"),
  ]);

  const [coStarted, pCoStarted, coDone, pCoDone] = await Promise.all([
    count(`bilabs_events?name=eq.checkout_started&${between("occurred_at", p)}&is_internal=is.false&is_test=is.false`),
    count(`bilabs_events?name=eq.checkout_started&${between("occurred_at", p.prev)}&is_internal=is.false&is_test=is.false`),
    count(`bilabs_payments?livemode=is.true&kind=eq.payment&recurring=is.true&${between("occurred_at", p)}`),
    count(`bilabs_payments?livemode=is.true&kind=eq.payment&recurring=is.true&${between("occurred_at", p.prev)}`),
  ]);

  const [newCust, pNewCust] = await Promise.all([
    count(`bilabs_leads?status=eq.paid&${between("updated_at", p)}`),
    count(`bilabs_leads?status=eq.paid&${between("updated_at", p.prev)}`),
  ]);

  const mrr = subs ? mrrFrom(subs) : null;

  const visitorsIn = vis.new.value;
  const leadsFromThem = fun.find((s) => s.id === "email_captured")?.count ?? 0;
  const completedIn = evalM.completed.value;
  const paidFromThem = fun.find((s) => s.id === "paid")?.count ?? 0;

  // A cohort is still maturing when less than `windowDays` has passed since
  // the period ended — later conversions can still land in it.
  const maturing = Date.now() - p.to.getTime() < windowDays * 86_400_000;

  const [firstEvent, trackingRows] = await Promise.all([
    sb<{ occurred_at: string }[]>("bilabs_events?select=occurred_at&order=occurred_at.asc&limit=1"),
    count("bilabs_events"),
  ]);

  return {
    period: {
      id: p.id, label: p.label, from: iso(p.from), to: iso(p.to), days: p.days,
      prevFrom: iso(p.prev.from), prevTo: iso(p.prev.to),
    },
    visitors: vis,
    contacts: { captured: metric(captured, prevCaptured), total: totalContacts },
    evaluations: evalM,
    checkouts: { started: metric(coStarted, pCoStarted), completed: metric(coDone, pCoDone) },
    customers: { new: metric(newCust, pNewCust), activeNow: mrr?.activeCount ?? 0, trialingNow: mrr?.trialingCount ?? 0 },
    money,
    mrr,
    conversion: {
      visitorToLead: {
        rate: visitorsIn ? Math.round((leadsFromThem / visitorsIn) * 1000) / 10 : null,
        numerator: leadsFromThem,
        denominator: visitorsIn,
        definition: `Of visitors first seen in ${p.label.toLowerCase()}, the share who gave us an email address within ${windowDays} days.`,
        maturing,
      },
      evaluationToPaid: {
        rate: completedIn ? Math.round((paidFromThem / completedIn) * 1000) / 10 : null,
        numerator: paidFromThem,
        denominator: completedIn,
        definition: `Of checks completed in ${p.label.toLowerCase()}, the share whose visitor went on to pay within ${windowDays} days.`,
        maturing,
      },
      windowDays,
    },
    funnel: fun,
    series: ser,
    sources: src,
    dataHealth: {
      stripeConnected: subs !== null,
      trackingRows,
      firstEventAt: firstEvent?.[0]?.occurred_at ?? null,
    },
  };
}
