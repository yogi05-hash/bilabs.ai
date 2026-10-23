import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { channelOf } from "@/lib/analytics";
import { resolvePeriod } from "@/lib/period";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Anonymous visitors.
 *
 * Nothing identifying is shown unless the person identified themselves: the
 * list carries a short form of our own random id, never an address we guessed
 * at. `contact_id` appears only when they typed an email into a form. */

const SORTS: Record<string, string> = {
  last: "last_seen_at",
  first: "first_seen_at",
  views: "page_views",
  visits: "visit_count",
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const period = resolvePeriod(q.get("range"), q.get("from"), q.get("to"));
  const page = Math.max(0, Number(q.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(10, Number(q.get("size") ?? 25) || 25));
  const sort = SORTS[q.get("sort") ?? "last"] ?? "last_seen_at";
  const dir = q.get("dir") === "asc" ? "asc" : "desc";
  const includeExcluded = q.get("excluded") === "1";
  const onlyIdentified = q.get("identified") === "1";
  const device = q.get("device") ?? "";

  const parts = [
    `last_seen_at=gte.${period.from.toISOString()}`,
    `last_seen_at=lt.${period.to.toISOString()}`,
    `order=${sort}.${dir}`,
    `limit=${size}`,
    `offset=${page * size}`,
  ];
  // Excluded traffic is hidden by default but can be shown, so the exclusion
  // itself is inspectable rather than a silent filter.
  if (!includeExcluded) parts.push("is_bot=is.false", "is_internal=is.false", "is_test=is.false");
  if (onlyIdentified) parts.push("contact_id=not.is.null");
  if (device) parts.push(`device=eq.${encodeURIComponent(device)}`);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  let total = 0;
  type Row = {
    id: string; visitor_key: string; first_seen_at: string; last_seen_at: string;
    visit_count: number; page_views: number; landing_path: string | null; last_path: string | null;
    referrer_host: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
    device: string | null; country: string | null; contact_id: string | null; identified_at: string | null;
    is_bot: boolean; is_internal: boolean; is_test: boolean;
  };
  let rows: Row[] = [];

  if (base && key) {
    const res = await fetch(`${base}/rest/v1/bilabs_visitors?${parts.join("&")}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      rows = (await res.json()) as Row[];
      total = Number((res.headers.get("content-range") ?? "").split("/")[1]) || 0;
    }
  }

  // What each visitor checked: their most recent evaluation, one query for
  // the whole page. Newest first, so the first hit per visitor wins.
  const vIds = rows.map((r) => r.id);
  const checkedBy = new Map<string, { id: string; website: string | null; business_name: string | null; readiness_score: number | null; mentions: number | null; mentions_total: number | null }>();
  if (vIds.length) {
    const evals = await sb<{ id: string; visitor_id: string; website: string | null; business_name: string | null; readiness_score: number | null; mentions: number | null; mentions_total: number | null }[]>(
      `bilabs_evaluations?visitor_id=in.(${vIds.join(",")})&is_test=is.false&order=started_at.desc&limit=500` +
        `&select=id,visitor_id,website,business_name,readiness_score,mentions,mentions_total`,
    );
    for (const e of evals ?? []) if (!checkedBy.has(e.visitor_id)) checkedBy.set(e.visitor_id, e);
  }

  // Attach the contact's email where — and only where — one exists.
  const contactIds = Array.from(new Set(rows.map((r) => r.contact_id).filter(Boolean))) as string[];
  const contacts = contactIds.length
    ? (await sb<{ id: string; email: string | null; company: string | null }[]>(
        `bilabs_leads?id=in.(${contactIds.join(",")})&select=id,email,company`,
      )) ?? []
    : [];
  const byId = new Map(contacts.map((c) => [c.id, c]));

  return NextResponse.json({
    total,
    page,
    size,
    visitors: rows.map((r) => ({
      ...r,
      // short, non-reversible label for the UI — the full key is an internal id
      label: r.visitor_key.slice(0, 8),
      visitor_key: undefined,
      channel: channelOf(r.utm_source, r.utm_medium, r.referrer_host),
      contact: r.contact_id ? byId.get(r.contact_id) ?? null : null,
      checked: checkedBy.get(r.id) ?? null,
      returning: r.visit_count > 1,
    })),
    limitations: [
      "A cleared cookie, a private window or another browser reads as a new visitor, so unique counts are an upper bound.",
      "Visitors who block first-party requests are not counted at all; evaluations and payments are recorded server-side and do not have this gap.",
      "Country is the CDN's IP geolocation — approximate, and absent on local runs.",
      "Bot filtering is user-agent based: it removes crawlers that identify themselves and nothing else.",
      "No fingerprinting is used, so people are not recognised across devices.",
    ],
  });
}
