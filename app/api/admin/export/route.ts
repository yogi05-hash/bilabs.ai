import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/adminAuth";
import { audit } from "@/lib/admin";
import { resolvePeriod } from "@/lib/period";
import { sb, type Lead } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* CSV export of the filtered contact list, and contact deletion.
 *
 * Both are audited. The export records how many rows left and under what
 * filter — not who was in it, because a log of exported people is another
 * copy of the same personal data.
 */

/** RFC 4180 quoting, plus the formula-injection guard: a cell beginning = + -
 *  or @ is executed by Excel and Sheets when the file is opened, so it is
 *  prefixed with an apostrophe. Exporting a contact should not be able to run
 *  code on the machine that opens it. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const COLUMNS: Array<[string, (l: Lead & { evaluationCount?: number }) => unknown]> = [
  ["Created", (l) => l.created_at],
  ["Name", (l) => l.name],
  ["Email", (l) => l.email],
  ["Business", (l) => l.company],
  ["Website", (l) => l.website],
  ["Type", (l) => l.business_type],
  ["Area", (l) => l.area],
  ["Pipeline", (l) => (l as unknown as { pipeline_status?: string }).pipeline_status],
  ["Nurture status", (l) => l.status],
  ["Owner", (l) => (l as unknown as { owner?: string }).owner],
  ["First source", (l) => (l as unknown as { first_source?: string }).first_source],
  ["Latest source", (l) => (l as unknown as { last_source?: string }).last_source],
  ["Readiness score", (l) => l.readiness_score],
  ["Mentions", (l) => (l.mentions === null ? "" : `${l.mentions}/${l.mentions_total ?? "?"}`)],
  ["Marketing consent", (l) => (l.marketing_consent ? "yes" : "no")],
  ["Consent recorded", (l) => l.consent_at],
  ["Next follow-up", (l) => (l as unknown as { next_follow_up_at?: string }).next_follow_up_at],
  ["Notes", (l) => l.notes],
];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const parts = ["order=created_at.desc", "limit=5000", "merged_into=is.null"];

  if (q.get("range")) {
    const period = resolvePeriod(q.get("range"), q.get("from"), q.get("to"));
    parts.push(`created_at=gte.${period.from.toISOString()}`, `created_at=lt.${period.to.toISOString()}`);
  }
  const pipeline = q.get("pipeline") ?? "";
  const status = q.get("status") ?? "";
  const search = (q.get("q") ?? "").trim();
  if (pipeline) parts.push(`pipeline_status=eq.${encodeURIComponent(pipeline)}`);
  if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
  if (search) {
    const safe = search.replace(/[(),*]/g, " ");
    parts.push(`or=(email.ilike.*${safe}*,company.ilike.*${safe}*,website.ilike.*${safe}*,name.ilike.*${safe}*)`);
  }

  const rows = (await sb<Lead[]>(`bilabs_leads?${parts.join("&")}`)) ?? [];

  const head = COLUMNS.map(([h]) => cell(h)).join(",");
  const body = rows.map((l) => COLUMNS.map(([, get]) => cell(get(l))).join(",")).join("\r\n");
  const csv = `${head}\r\n${body}`;

  await audit(admin, "lead.export", null, {
    rows: rows.length,
    filters: { pipeline: pipeline || null, status: status || null, search: search ? "yes" : "no", range: q.get("range") },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bilabs-contacts-${stamp}.csv"`,
      // an export is personal data: never cached, never indexed
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex",
    },
  });
}

/* Delete a contact and everything personal attached to them — the erasure
 * path a UK GDPR request needs. Owner-only.
 *
 * Financial records are the documented exception: payments and subscriptions
 * are kept with the contact link severed, because there is a legal duty to
 * retain transaction records that does not disappear on request. */
export async function DELETE(req: NextRequest) {
  const guard = await requireOwner(req);
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${id}&limit=1`);
  if (!rows?.[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sever rather than delete, for the records we must keep.
  for (const table of ["bilabs_payments", "bilabs_subscriptions"]) {
    await sb(`${table}?contact_id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ contact_id: null, email: null }),
    });
  }
  // Anonymise the visitor rather than delete it, so the traffic count for a
  // past period does not silently change.
  await sb(`bilabs_visitors?contact_id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ contact_id: null, identified_at: null }),
  });

  for (const table of ["bilabs_email_log", "bilabs_followups", "bilabs_evaluations", "bilabs_events"]) {
    await sb(`${table}?contact_id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  }
  await sb(`bilabs_lead_events?lead_id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await sb(`bilabs_leads?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

  // The audit entry names no one — it records that an erasure happened.
  await audit(admin, "lead.delete", { type: "lead", id }, { financialRecordsRetained: true });

  return NextResponse.json({
    ok: true,
    note: "Contact and their activity removed. Payment and subscription records were kept with the personal link severed, as transaction records must be retained.",
  });
}
