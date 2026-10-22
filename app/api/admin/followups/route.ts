import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireWriter } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Follow-ups, report deliveries and delivery health.
 *
 * `report_delivery` tasks are kept apart from marketing on purpose: a report
 * someone asked for is a thing they requested and is owed to them regardless
 * of marketing consent. Marketing is the opposite — it needs consent, and
 * stops the moment it is withdrawn. Conflating the two is how businesses end
 * up emailing people who opted out. */

type FollowUp = {
  id: string; contact_id: string | null; title: string; kind: string;
  owner: string | null; due_at: string | null; done_at: string | null;
  status: string; notes: string | null; created_by: string | null; created_at: string;
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const status = q.get("status") ?? "open";
  const parts = ["order=due_at.asc.nullslast", "limit=200"];
  if (status !== "all") parts.push(`status=eq.${encodeURIComponent(status)}`);

  const rows = (await sb<FollowUp[]>(`bilabs_followups?${parts.join("&")}`)) ?? [];

  const contactIds = Array.from(new Set(rows.map((r) => r.contact_id).filter(Boolean))) as string[];
  const contacts = contactIds.length
    ? (await sb<{ id: string; email: string | null; company: string | null; marketing_consent: boolean; status: string }[]>(
        `bilabs_leads?id=in.(${contactIds.join(",")})&select=id,email,company,marketing_consent,status`,
      )) ?? []
    : [];
  const byId = new Map(contacts.map((c) => [c.id, c]));

  // Report deliveries requested but not yet confirmed sent.
  const pendingReports =
    (await sb<{ id: string; website: string | null; contact_id: string | null; completed_at: string | null }[]>(
      "bilabs_evaluations?is_test=is.false&status=eq.completed&contact_id=not.is.null&report_emailed_at=is.null" +
        "&order=completed_at.desc&limit=50&select=id,website,contact_id,completed_at",
    )) ?? [];

  const emailFailures =
    (await sb<{ id: string; email: string | null; kind: string; error: string | null; created_at: string }[]>(
      "bilabs_email_log?status=eq.failed&order=created_at.desc&limit=50&select=id,email,kind,error,created_at",
    )) ?? [];

  const recentEmails =
    (await sb<{ id: string; email: string | null; kind: string; subject: string | null; status: string; created_at: string }[]>(
      "bilabs_email_log?order=created_at.desc&limit=50&select=id,email,kind,subject,status,created_at",
    )) ?? [];

  const suppressed =
    (await sb<{ id: string; email: string | null; status: string; marketing_consent: boolean }[]>(
      "bilabs_leads?or=(status.eq.unsubscribed,marketing_consent.is.false)&email=not.is.null&limit=500&select=id,email,status,marketing_consent",
    )) ?? [];

  return NextResponse.json({
    followUps: rows.map((r) => ({ ...r, contact: r.contact_id ? byId.get(r.contact_id) ?? null : null })),
    pendingReports,
    emailFailures,
    recentEmails,
    suppressedCount: suppressed.length,
    /* Marketing sequences, prepared but switched off.
     *
     * These are drafts only. Nothing in this response activates anything, no
     * bulk send exists behind it, and the nurture cron remains the single
     * sending path — which already refuses anyone without consent or in a
     * terminal state. */
    marketingDrafts: {
      enabled: false,
      note:
        "Drafts only — not scheduled and not sending. Enabling bulk marketing is a deliberate, separate decision and would need consent checks re-verified against every recipient first.",
      sequences: [
        { id: "welcome-series", name: "Welcome series", steps: 3, status: "draft", requiresConsent: true },
        { id: "re-check-nudge", name: "Re-check nudge (90 days)", steps: 1, status: "draft", requiresConsent: true },
        { id: "win-back", name: "Win-back after cancellation", steps: 2, status: "draft", requiresConsent: true },
      ],
    },
    rules: {
      reportDelivery:
        "A report the person asked for. Delivered regardless of marketing consent, because they requested it; it is not marketing.",
      marketing:
        "Requires marketing_consent = true and a non-terminal status. Unsubscribing or replying stops it permanently.",
      suppression:
        "Unsubscribed contacts and anyone who never consented are suppressed from every marketing send and are counted above.",
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireWriter(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const contactId = typeof body?.contactId === "string" && /^[0-9a-f-]{36}$/i.test(body.contactId) ? body.contactId : null;
  const dueAt = typeof body?.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : null;
  const kind = body?.kind === "report_delivery" ? "report_delivery" : "task";

  const rows = await sb<FollowUp[]>("bilabs_followups", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      contact_id: contactId,
      title,
      kind,
      owner: typeof body?.owner === "string" ? body.owner.slice(0, 120) : admin.email,
      due_at: dueAt,
      notes: typeof body?.notes === "string" ? body.notes.slice(0, 2000) : null,
      created_by: admin.email,
    }),
  });
  const created = rows?.[0];
  if (!created) return NextResponse.json({ error: "Could not create that." }, { status: 502 });

  if (contactId && dueAt) {
    await sb(`bilabs_leads?id=eq.${contactId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ next_follow_up_at: dueAt }),
    });
  }

  await audit(admin, "followup.create", { type: "followup", id: created.id }, { kind, hasDueDate: Boolean(dueAt) });
  return NextResponse.json({ ok: true, followUp: created });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireWriter(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body?.status === "done") { patch.status = "done"; patch.done_at = new Date().toISOString(); }
  else if (body?.status === "open") { patch.status = "open"; patch.done_at = null; }
  else if (body?.status === "cancelled") { patch.status = "cancelled"; patch.done_at = new Date().toISOString(); }
  if (typeof body?.owner === "string") patch.owner = body.owner.slice(0, 120);
  if (typeof body?.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt))) patch.due_at = new Date(body.dueAt).toISOString();
  if (typeof body?.notes === "string") patch.notes = body.notes.slice(0, 2000);

  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  await sb(`bilabs_followups?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  await audit(admin, "followup.complete", { type: "followup", id }, { fields: Object.keys(patch) });
  return NextResponse.json({ ok: true });
}
