import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { resolvePeriod } from "@/lib/period";
import { sb, type Lead } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The contact list.
 *
 * One row per person, keyed on their email address. Deliberately NOT keyed on
 * the business website: agencies, franchises and anyone sharing a domain with
 * a colleague are different people, and merging them on the domain would lose
 * one of them. Repeated checks by the same person update their single row —
 * the individual runs live in bilabs_evaluations, not here. */

const SORTS: Record<string, string> = {
  created: "created_at",
  updated: "updated_at",
  score: "readiness_score",
  followup: "next_follow_up_at",
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const page = Math.max(0, Number(q.get("page") ?? 0) || 0);
  const size = Math.min(200, Math.max(10, Number(q.get("size") ?? 25) || 25));
  const sort = SORTS[q.get("sort") ?? "created"] ?? "created_at";
  const dir = q.get("dir") === "asc" ? "asc" : "desc";

  const parts = [`order=${sort}.${dir}.nullslast`, `limit=${size}`, `offset=${page * size}`, "merged_into=is.null"];

  // Dates are optional on this page — the contact list is usually wanted in
  // full, and filtering it by period hides people who are still live.
  if (q.get("range")) {
    const period = resolvePeriod(q.get("range"), q.get("from"), q.get("to"));
    parts.push(`created_at=gte.${period.from.toISOString()}`, `created_at=lt.${period.to.toISOString()}`);
  }

  const pipeline = q.get("pipeline") ?? "";
  const status = q.get("status") ?? "";
  const source = q.get("source") ?? "";
  const owner = q.get("owner") ?? "";
  const result = q.get("result") ?? "";
  const search = (q.get("q") ?? "").trim();

  if (pipeline) parts.push(`pipeline_status=eq.${encodeURIComponent(pipeline)}`);
  if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
  if (source) parts.push(`or=(source.eq.${encodeURIComponent(source)},first_source.eq.${encodeURIComponent(source)})`);
  if (owner) parts.push(`owner=eq.${encodeURIComponent(owner)}`);

  // Evaluation result bands, so "who scored badly" is one click.
  if (result === "scored") parts.push("readiness_score=not.is.null");
  else if (result === "none") parts.push("readiness_score=is.null");
  else if (result === "low") parts.push("readiness_score=lt.50");
  else if (result === "mid") parts.push("readiness_score=gte.50", "readiness_score=lt.80");
  else if (result === "high") parts.push("readiness_score=gte.80");
  else if (result === "unmentioned") parts.push("mentions=eq.0");

  if (search) {
    const safe = search.replace(/[(),*]/g, " ");
    parts.push(
      `or=(email.ilike.*${safe}*,company.ilike.*${safe}*,website.ilike.*${safe}*,name.ilike.*${safe}*)`,
    );
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  let rows: Lead[] = [];
  let total = 0;
  if (base && key) {
    const res = await fetch(`${base}/rest/v1/bilabs_leads?${parts.join("&")}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      rows = (await res.json()) as Lead[];
      total = Number((res.headers.get("content-range") ?? "").split("/")[1]) || 0;
    }
  }

  // How many checks each of these people has run.
  const ids = rows.map((r) => r.id);
  const evals = ids.length
    ? (await sb<{ contact_id: string | null; status: string }[]>(
        `bilabs_evaluations?contact_id=in.(${ids.join(",")})&select=contact_id,status&limit=2000`,
      )) ?? []
    : [];
  const evalCount = new Map<string, number>();
  for (const e of evals) {
    if (!e.contact_id) continue;
    evalCount.set(e.contact_id, (evalCount.get(e.contact_id) ?? 0) + 1);
  }

  return NextResponse.json({
    total,
    page,
    size,
    leads: rows.map((l) => ({ ...l, evaluationCount: evalCount.get(l.id) ?? 0 })),
  });
}
