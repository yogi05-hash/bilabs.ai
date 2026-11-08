import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin, requireWriter } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import { sb } from "@/lib/leads";
import { BUSINESS_STATUSES, getBusiness, setBusinessStatus, type Business, type BusinessStatus } from "@/lib/businesses";
import { enqueueCheck, runCheck, sweepAbandonedChecks, type Check } from "@/lib/checks";
import { publishBusiness } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Paying businesses: who they are, what they have paid, where their profile
 * and checks stand. One list, enriched in JS from the tables that know each
 * part — contact, subscription, payments, latest check. */

const SORTS: Record<string, string> = { created: "created_at", next: "next_check_at", last: "last_check_at", name: "name" };

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await sweepAbandonedChecks();

  const q = req.nextUrl.searchParams;
  const page = Math.max(0, Number(q.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(10, Number(q.get("size") ?? 25) || 25));
  const sort = SORTS[q.get("sort") ?? "created"] ?? "created_at";
  const dir = q.get("dir") === "asc" ? "asc" : "desc";
  const status = q.get("status") ?? "";
  const search = (q.get("q") ?? "").trim();
  const tests = q.get("tests") === "1";

  const parts = [`order=${sort}.${dir}.nullslast`, `limit=${size}`, `offset=${page * size}`];
  if (!tests) parts.push("is_test=is.false");
  if (status && (BUSINESS_STATUSES as string[]).includes(status)) parts.push(`status=eq.${status}`);
  if (search) {
    const safe = search.replace(/[(),*]/g, " ");
    parts.push(`or=(name.ilike.*${safe}*,website.ilike.*${safe}*,business_type.ilike.*${safe}*,area.ilike.*${safe}*,slug.ilike.*${safe}*)`);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  let rows: Business[] = [];
  let total = 0;
  if (base && key) {
    const res = await fetch(`${base}/rest/v1/bilabs_businesses?${parts.join("&")}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      rows = (await res.json()) as Business[];
      total = Number((res.headers.get("content-range") ?? "").split("/")[1]) || 0;
    }
  }

  const contactIds = Array.from(new Set(rows.map((r) => r.contact_id)));
  const bizIds = rows.map((r) => r.id);
  const inList = (ids: string[]) => ids.join(",");

  const [contacts, subs, payments, checks, open, all] = await Promise.all([
    contactIds.length ? sb<{ id: string; email: string | null; phone: string | null; name: string | null; company: string | null }[]>(`bilabs_leads?id=in.(${inList(contactIds)})&select=id,email,phone,name,company`) : Promise.resolve([]),
    contactIds.length ? sb<{ contact_id: string; status: string; plan: string | null; current_period_end: string | null; cancel_at_period_end: boolean; updated_at: string }[]>(`bilabs_subscriptions?contact_id=in.(${inList(contactIds)})&order=updated_at.desc&select=contact_id,status,plan,current_period_end,cancel_at_period_end,updated_at`) : Promise.resolve([]),
    contactIds.length ? sb<{ contact_id: string; kind: string; amount_pence: number; livemode: boolean }[]>(`bilabs_payments?contact_id=in.(${inList(contactIds)})&select=contact_id,kind,amount_pence,livemode`) : Promise.resolve([]),
    bizIds.length ? sb<Check[]>(`bilabs_checks?business_id=in.(${inList(bizIds)})&status=eq.completed&order=created_at.desc&limit=${bizIds.length * 3}&select=id,business_id,status,trigger,completed_at,totals,found_total,answers_total,est_cost_pence`) : Promise.resolve([]),
    bizIds.length ? sb<{ business_id: string; status: string }[]>(`bilabs_checks?business_id=in.(${inList(bizIds)})&status=in.(queued,running)&select=business_id,status`) : Promise.resolve([]),
    sb<{ status: BusinessStatus; is_test: boolean }[]>("bilabs_businesses?select=status,is_test"),
  ]);

  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));
  const subByContact = new Map<string, (typeof subs extends (infer T)[] | null ? T : never)>();
  for (const s of subs ?? []) if (!subByContact.has(s.contact_id)) subByContact.set(s.contact_id, s);
  const paidByContact = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!p.livemode && !tests) continue;
    const delta = p.kind === "payment" ? p.amount_pence : p.kind === "refund" ? -p.amount_pence : 0;
    paidByContact.set(p.contact_id, (paidByContact.get(p.contact_id) ?? 0) + delta);
  }
  const latestByBiz = new Map<string, Check>();
  for (const c of checks ?? []) if (!latestByBiz.has(c.business_id)) latestByBiz.set(c.business_id, c);
  const openByBiz = new Map((open ?? []).map((o) => [o.business_id, o.status]));

  const counts: Record<BusinessStatus, number> = { onboarding: 0, processing: 0, live: 0, paused: 0, cancelled: 0 };
  for (const b of all ?? []) if ((tests || !b.is_test) && b.status in counts) counts[b.status]++;

  return NextResponse.json({
    total, page, size, counts,
    businesses: rows.map((b) => ({
      ...b,
      contact: contactById.get(b.contact_id) ?? null,
      subscription: subByContact.get(b.contact_id) ?? null,
      paidPence: paidByContact.get(b.contact_id) ?? 0,
      latestCheck: latestByBiz.get(b.id) ?? null,
      openCheck: openByBiz.get(b.id) ?? null,
    })),
    method: {
      status: "onboarding = paid but setup unfinished · processing = published, first check not finished · live = published and checked · paused = billing lapsed or paused by an admin (profile stays up) · cancelled = subscription ended (profile comes down).",
      paid: "Net of refunds, live mode only, from verified Stripe webhooks. Test-mode money shows only with test rows on.",
      checks: "Each monthly check asks every chosen assistant the same five questions with live web search. x/5 is how many answers named the business; — means that assistant was not configured or could not be reached.",
      cost: "Per-search prices declared per provider in lib/providers.ts at a fixed GBP rate. An estimate, labelled as one.",
    },
  });
}

/* Admin actions on a business. Each is audited. */
export async function PATCH(req: NextRequest) {
  const guard = await requireWriter(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const action = String(body?.action ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const b = await getBusiness(id);
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "pause" || action === "resume" || action === "cancel") {
    const next: BusinessStatus = action === "pause" ? "paused" : action === "cancel" ? "cancelled" : b.published_at ? "live" : "onboarding";
    await setBusinessStatus(id, next);
    await audit(admin, "business.status", { type: "business", id }, { from: b.status, to: next });
    return NextResponse.json({ ok: true, status: next });
  }

  if (action === "publish") {
    const r = await publishBusiness(id, { by: admin.email, force: body?.force === true });
    await audit(admin, "business.publish", { type: "business", id }, { ok: r.ok, force: body?.force === true, ...(r.ok ? { first: r.firstPublish } : { errors: Object.keys(r.errors) }) });
    if (!r.ok) return NextResponse.json({ error: Object.values(r.errors)[0], errors: r.errors }, { status: r.status });
    if (r.checkId) { const cid = r.checkId; after(() => runCheck(cid)); }
    return NextResponse.json({ ok: true, url: r.url, firstPublish: r.firstPublish });
  }

  if (action === "recheck") {
    const check = await enqueueCheck(id, "admin", admin.email);
    if (!check) return NextResponse.json({ error: "A check is already queued or running for this business." }, { status: 409 });
    await audit(admin, "business.recheck", { type: "business", id }, { checkId: check.id });
    const cid = check.id;
    after(() => runCheck(cid));
    return NextResponse.json({ ok: true, checkId: cid });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
