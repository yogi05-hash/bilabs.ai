import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireWriter } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import { logEvent, sb, setStatus, type Lead, type LeadStatus } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* One contact, with their whole history.
 *
 * The timeline is assembled from every table that knows something about this
 * person — checks they ran, events they fired, emails we sent, payments,
 * follow-ups and the older lead_events log — and sorted into one list, so the
 * story reads in order rather than being spread across five panels. */

const PIPELINE = ["new", "contacted", "interested", "customer", "closed"];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const [rows, legacy, evals, events, emails, payments, followUps, visitors] = await Promise.all([
    sb<Lead[]>(`bilabs_leads?id=eq.${id}&limit=1`),
    sb<{ kind: string; detail: string | null; created_at: string }[]>(
      `bilabs_lead_events?lead_id=eq.${id}&order=created_at.desc&limit=200`,
    ),
    sb<Record<string, unknown>[]>(
      `bilabs_evaluations?contact_id=eq.${id}&order=started_at.desc&limit=50`,
    ),
    sb<{ name: string; occurred_at: string; path: string | null; props: unknown }[]>(
      `bilabs_events?contact_id=eq.${id}&order=occurred_at.desc&limit=200&select=name,occurred_at,path,props`,
    ),
    sb<{ kind: string; subject: string | null; status: string; error: string | null; created_at: string }[]>(
      `bilabs_email_log?contact_id=eq.${id}&order=created_at.desc&limit=100&select=kind,subject,status,error,created_at`,
    ),
    sb<Record<string, unknown>[]>(`bilabs_payments?contact_id=eq.${id}&order=occurred_at.desc&limit=100`),
    sb<Record<string, unknown>[]>(`bilabs_followups?contact_id=eq.${id}&order=due_at.asc&limit=50`),
    sb<{ id: string; first_seen_at: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer_host: string | null; landing_path: string | null; device: string | null; country: string | null }[]>(
      `bilabs_visitors?contact_id=eq.${id}&order=first_seen_at.asc&limit=20`,
    ),
  ]);

  if (!rows?.[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type Entry = { at: string; kind: string; label: string; detail?: string | null };
  const timeline: Entry[] = [];
  for (const e of evals ?? []) {
    timeline.push({
      at: String(e.started_at),
      kind: "evaluation",
      label: `Check ${String(e.status)}`,
      detail: [e.website, e.readiness_score !== null ? `${e.readiness_score}/100 readable` : null,
        e.mentions !== null ? `mentioned ${e.mentions}/${e.mentions_total}` : null].filter(Boolean).join(" · ") || null,
    });
  }
  for (const e of events ?? []) timeline.push({ at: e.occurred_at, kind: "event", label: e.name.replace(/_/g, " "), detail: e.path });
  for (const e of emails ?? []) timeline.push({ at: e.created_at, kind: "email", label: `Email ${e.status}: ${e.kind}`, detail: e.error ?? e.subject });
  for (const p of payments ?? []) {
    timeline.push({
      at: String(p.occurred_at), kind: "payment",
      label: String(p.kind) === "refund" ? "Refund" : String(p.kind) === "payment_failed" ? "Payment failed" : "Payment",
      detail: `${((Number(p.amount_pence) || 0) / 100).toFixed(2)} ${String(p.currency).toUpperCase()}${p.plan ? ` · ${p.plan}` : ""}`,
    });
  }
  for (const e of legacy ?? []) timeline.push({ at: e.created_at, kind: "note", label: e.kind, detail: e.detail });
  timeline.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return NextResponse.json({
    lead: rows[0],
    timeline,
    evaluations: evals ?? [],
    payments: payments ?? [],
    followUps: followUps ?? [],
    emails: emails ?? [],
    visitors: visitors ?? [],
    // kept for the existing history panel
    events: legacy ?? [],
    role: admin.role,
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireWriter(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  const changed: string[] = [];

  if (typeof body?.notes === "string") {
    patch.notes = body.notes.slice(0, 4000);
    changed.push("notes");
  }
  if (typeof body?.owner === "string") {
    patch.owner = body.owner.trim().slice(0, 120) || null;
    changed.push("owner");
  }
  if (typeof body?.pipeline === "string" && PIPELINE.includes(body.pipeline)) {
    patch.pipeline_status = body.pipeline;
    changed.push("pipeline");
  }
  if (body?.nextFollowUpAt === null) {
    patch.next_follow_up_at = null;
    changed.push("followup");
  } else if (typeof body?.nextFollowUpAt === "string" && !Number.isNaN(Date.parse(body.nextFollowUpAt))) {
    patch.next_follow_up_at = new Date(body.nextFollowUpAt).toISOString();
    changed.push("followup");
  }

  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    await sb(`bilabs_leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (changed.includes("notes")) await logEvent(id, "note", `by ${admin.email}`);
    if (changed.includes("owner")) await audit(admin, "lead.owner", { type: "lead", id }, { owner: patch.owner });
    if (changed.includes("pipeline")) await audit(admin, "lead.status", { type: "lead", id }, { pipeline: patch.pipeline_status });
    if (changed.includes("followup")) await audit(admin, "lead.followup", { type: "lead", id }, { due: patch.next_follow_up_at });
    if (changed.includes("notes")) await audit(admin, "lead.notes", { type: "lead", id }, { length: String(patch.notes).length });
  }

  /* The nurture status is a separate axis from the sales pipeline and keeps
   * its own setter: `unsubscribed` is a marketing preference, not a stage of
   * a sales conversation, and the nurture cron reads this field. */
  const status = body?.status as LeadStatus | undefined;
  if (status && ["new", "nurturing", "paid", "unsubscribed", "lost"].includes(status)) {
    await setStatus(id, status, `by ${admin.email}`);
    await audit(admin, "lead.status", { type: "lead", id }, { status });
    const mirror =
      status === "paid" ? "customer" : status === "lost" ? "closed" : status === "nurturing" ? "contacted" : null;
    if (mirror) {
      await sb(`bilabs_leads?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ pipeline_status: mirror }),
      });
    }
  }

  if (!Object.keys(patch).length && !status) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
