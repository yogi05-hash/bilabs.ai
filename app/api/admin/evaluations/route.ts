import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireWriter } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import { resolvePeriod } from "@/lib/period";
import { sb } from "@/lib/leads";
import {
  ABANDON_AFTER_MS,
  DUPLICATE_WINDOW_MS,
  startEvaluation,
  sweepAbandoned,
  type Evaluation,
} from "@/lib/evaluations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  started: "started_at",
  score: "readiness_score",
  runtime: "runtime_ms",
  mentions: "mentions",
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await sweepAbandoned();

  const q = req.nextUrl.searchParams;
  const period = resolvePeriod(q.get("range"), q.get("from"), q.get("to"));
  const page = Math.max(0, Number(q.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(10, Number(q.get("size") ?? 25) || 25));
  const sort = SORTS[q.get("sort") ?? "started"] ?? "started_at";
  const dir = q.get("dir") === "asc" ? "asc" : "desc";
  const status = q.get("status") ?? "";
  const search = (q.get("q") ?? "").trim();

  const parts = [
    `started_at=gte.${period.from.toISOString()}`,
    `started_at=lt.${period.to.toISOString()}`,
    `order=${sort}.${dir}.nullslast`,
    `limit=${size}`,
    `offset=${page * size}`,
  ];
  if (q.get("tests") !== "1") parts.push("is_test=is.false");
  if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
  if (search) {
    const safe = search.replace(/[(),*]/g, " ");
    parts.push(`or=(website.ilike.*${safe}*,business_name.ilike.*${safe}*,business_type.ilike.*${safe}*,area.ilike.*${safe}*)`);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  let rows: Evaluation[] = [];
  let total = 0;
  if (base && key) {
    const res = await fetch(`${base}/rest/v1/bilabs_evaluations?${parts.join("&")}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      rows = (await res.json()) as Evaluation[];
      total = Number((res.headers.get("content-range") ?? "").split("/")[1]) || 0;
    }
  }

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
    evaluations: rows.map((r) => ({ ...r, contact: r.contact_id ? byId.get(r.contact_id) ?? null : null })),
    method: {
      readiness:
        "A fetch of the business's own website, scored out of 100 across nine checks (schema, hours, services, prices, FAQ, contact details, crawler access, llms.txt, load time). Deterministic and repeatable.",
      mentions:
        "Five differently-phrased questions put to an assistant with live web search, recording for each whether the business was named. A sample from one model at one moment — not a ranking, and not a property of their website.",
      separate:
        "The two are never combined. A site can score 90/100 and be mentioned 0 times, and often is.",
      abandonment: `A run still open ${ABANDON_AFTER_MS / 60000} minutes after it started is marked abandoned: the process never reported back. That is a different fact from failed, which means the job ran and told us why it could not finish.`,
      duplicates: `A repeat of the same website from the same visitor within ${DUPLICATE_WINDOW_MS / 1000}s is refused rather than run twice — each run costs five live web searches.`,
      cost: "Cost is the web searches the API actually reported for that run, at $10 per 1,000, converted at a fixed declared rate. Token cost is not included.",
    },
  });
}

/* Retry a failed or abandoned check.
 *
 * Creates a NEW row linked to the original by retry_of rather than reopening
 * it, so the failure stays on the record and the retry history is visible.
 * The actual run is performed by the public endpoint, which is the one place
 * that knows how to do it; this only queues and links. */
export async function POST(req: NextRequest) {
  const guard = await requireWriter(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const rows = await sb<Evaluation[]>(`bilabs_evaluations?id=eq.${id}&limit=1`);
  const original = rows?.[0];
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (original.status === "running") {
    return NextResponse.json({ error: "That check is still running." }, { status: 409 });
  }
  if (!original.business_type || !original.area) {
    return NextResponse.json(
      { error: "This check is missing the business type or area it needs to run again." },
      { status: 422 },
    );
  }

  // Don't let a retry stack on a retry without limit — a check that has
  // failed three times is a problem to look at, not to keep paying for.
  if ((original.attempt ?? 1) >= 3) {
    return NextResponse.json(
      { error: "This check has already been attempted three times. Look at the failure reason before retrying again." },
      { status: 429 },
    );
  }

  const queued = await startEvaluation({
    visitorId: original.visitor_id,
    contactId: original.contact_id,
    website: original.website,
    businessName: original.business_name,
    businessType: original.business_type,
    area: original.area,
    postcode: original.postcode,
    isTest: original.is_test,
    requestedBy: admin.email,
    retryOf: original.id,
    attempt: (original.attempt ?? 1) + 1,
  });
  if (!queued) return NextResponse.json({ error: "Could not queue the retry." }, { status: 502 });

  // It is queued, not run: nothing here calls the model, so no cost is
  // incurred until the run endpoint picks it up.
  await sb(`bilabs_evaluations?id=eq.${queued.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "queued" }),
  });

  await audit(admin, "evaluation.retry", { type: "evaluation", id: original.id }, { retryId: queued.id, attempt: (original.attempt ?? 1) + 1 });

  return NextResponse.json({
    ok: true,
    id: queued.id,
    note: "Queued. Run it from the public check with the same details, or wait for the next scheduled sweep.",
  });
}
