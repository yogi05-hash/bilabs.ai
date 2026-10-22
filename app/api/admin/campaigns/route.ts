import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { CLEAN, channelOf } from "@/lib/analytics";
import { resolvePeriod } from "@/lib/period";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Campaign performance.
 *
 * First-touch and latest-touch are reported as separate tables rather than
 * blended. They answer different questions — which channel found this person,
 * and which one was in play when they converted — and averaging them would
 * answer neither.
 *
 * Where attribution is genuinely unknown it says so. Nothing is spread across
 * channels to make the totals tie up. */

type Row = {
  key: string;
  visitors: number;
  leads: number;
  evaluations: number;
  customers: number;
  revenuePence: number;
};

const blank = (key: string): Row => ({ key, visitors: 0, leads: 0, evaluations: 0, customers: 0, revenuePence: 0 });

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const period = resolvePeriod(q.get("range"), q.get("from"), q.get("to"));
  const fromIso = period.from.toISOString();
  const toIso = period.to.toISOString();

  const visitors =
    (await sb<{
      id: string; contact_id: string | null; landing_path: string | null;
      utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
      referrer_host: string | null;
    }[]>(
      `bilabs_visitors?${CLEAN}&first_seen_at=gte.${fromIso}&first_seen_at=lt.${toIso}` +
        `&select=id,contact_id,landing_path,utm_source,utm_medium,utm_campaign,referrer_host&limit=5000`,
    )) ?? [];

  const bySourceMedium = new Map<string, Row>();
  const byCampaign = new Map<string, Row>();
  const byLanding = new Map<string, Row>();
  const channelOfVisitor = new Map<string, string>();
  const campaignOfVisitor = new Map<string, string>();
  const landingOfVisitor = new Map<string, string>();

  for (const v of visitors) {
    const ch = channelOf(v.utm_source, v.utm_medium, v.referrer_host);
    const camp = v.utm_campaign || "(no campaign tag)";
    const land = v.landing_path || "(unknown)";
    channelOfVisitor.set(v.id, ch);
    campaignOfVisitor.set(v.id, camp);
    landingOfVisitor.set(v.id, land);

    for (const [map, key] of [[bySourceMedium, ch], [byCampaign, camp], [byLanding, land]] as const) {
      const row = map.get(key) ?? blank(key);
      row.visitors++;
      if (v.contact_id) row.leads++;
      map.set(key, row);
    }
  }

  const ids = new Set(visitors.map((v) => v.id));
  const evals =
    (await sb<{ visitor_id: string | null }[]>(
      "bilabs_evaluations?is_test=is.false&status=eq.completed&select=visitor_id&limit=5000",
    )) ?? [];
  for (const e of evals) {
    if (!e.visitor_id || !ids.has(e.visitor_id)) continue;
    bySourceMedium.get(channelOfVisitor.get(e.visitor_id)!)!.evaluations++;
    byCampaign.get(campaignOfVisitor.get(e.visitor_id)!)!.evaluations++;
    byLanding.get(landingOfVisitor.get(e.visitor_id)!)!.evaluations++;
  }

  const contactToVisitor = new Map<string, string>();
  for (const v of visitors) if (v.contact_id) contactToVisitor.set(v.contact_id, v.id);

  const pays =
    (await sb<{ amount_pence: number; contact_id: string | null; kind: string }[]>(
      "bilabs_payments?livemode=is.true&kind=eq.payment&select=amount_pence,contact_id,kind&limit=5000",
    )) ?? [];

  let unattributedRevenue = 0;
  let unattributedCount = 0;
  for (const p of pays) {
    const vid = p.contact_id ? contactToVisitor.get(p.contact_id) : undefined;
    if (!vid) {
      // No first-touch record for this payer — counted honestly as unknown
      // rather than assigned to whichever channel looked plausible.
      unattributedRevenue += p.amount_pence;
      unattributedCount++;
      continue;
    }
    for (const [map, keyMap] of [
      [bySourceMedium, channelOfVisitor],
      [byCampaign, campaignOfVisitor],
      [byLanding, landingOfVisitor],
    ] as const) {
      const row = map.get(keyMap.get(vid)!);
      if (row) { row.revenuePence += p.amount_pence; row.customers++; }
    }
  }

  /* Latest-touch: the campaign on the contact at the time they converted,
   * recorded separately on the contact row by the capture path. */
  const contacts =
    (await sb<{ id: string; last_utm: Record<string, string> | null; last_source: string | null; status: string }[]>(
      `bilabs_leads?created_at=gte.${fromIso}&created_at=lt.${toIso}&select=id,last_utm,last_source,status&limit=5000`,
    )) ?? [];
  const latest = new Map<string, { key: string; leads: number; customers: number }>();
  for (const c of contacts) {
    const key = c.last_utm?.utm_source
      ? `${c.last_utm.utm_source} / ${c.last_utm.utm_medium ?? "unknown"}`
      : c.last_source || "(unknown)";
    const row = latest.get(key) ?? { key, leads: 0, customers: 0 };
    row.leads++;
    if (c.status === "paid") row.customers++;
    latest.set(key, row);
  }

  const sortRows = (m: Map<string, Row>) => Array.from(m.values()).sort((a, b) => b.visitors - a.visitors || b.leads - a.leads);

  return NextResponse.json({
    period: { label: period.label, from: fromIso, to: toIso },
    firstTouch: {
      bySourceMedium: sortRows(bySourceMedium),
      byCampaign: sortRows(byCampaign),
      byLandingPage: sortRows(byLanding),
    },
    latestTouch: Array.from(latest.values()).sort((a, b) => b.leads - a.leads),
    unattributed: { revenuePence: unattributedRevenue, payments: unattributedCount },
    notes: {
      firstTouch:
        "The channel on a visitor's very first visit. Written once and never overwritten, so a later direct visit cannot erase the campaign that found them.",
      latestTouch:
        "The source recorded on the contact at the time of their most recent touch. Shown apart from first-touch because they answer different questions.",
      preserved:
        "UTM tags are stashed on arrival and carried through the evaluation and into Stripe Checkout metadata, so a campaign still attributes after the round trip to the payment page.",
      unattributed:
        "Payments with no linked first-touch visitor are reported as unknown rather than distributed across channels.",
      limits:
        "Attribution needs the first-party cookie. Anyone blocking it, or arriving in a fresh browser, appears as a new direct visitor.",
    },
  });
}
