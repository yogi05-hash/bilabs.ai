import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { sb, type Lead } from "@/lib/leads";
import { getBusiness } from "@/lib/businesses";
import { listChecks, type CheckResult } from "@/lib/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* One business, with everything the drawer shows: the contact, every check
 * with its per-assistant answers, the emails we sent, the money. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const b = await getBusiness(id);
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [contacts, checks, emails, payments, subs, auditRows] = await Promise.all([
    sb<Lead[]>(`bilabs_leads?id=eq.${b.contact_id}&limit=1`),
    listChecks(b.id, 24),
    sb<{ kind: string; subject: string | null; status: string; error: string | null; created_at: string }[]>(
      `bilabs_email_log?contact_id=eq.${b.contact_id}&order=created_at.desc&limit=50&select=kind,subject,status,error,created_at`,
    ),
    sb<Record<string, unknown>[]>(`bilabs_payments?contact_id=eq.${b.contact_id}&order=occurred_at.desc&limit=50`),
    sb<Record<string, unknown>[]>(`bilabs_subscriptions?contact_id=eq.${b.contact_id}&order=updated_at.desc&limit=5`),
    sb<{ actor: string; action: string; detail: unknown; created_at: string }[]>(
      `bilabs_audit_log?target_type=eq.business&target_id=eq.${b.id}&order=created_at.desc&limit=30&select=actor,action,detail,created_at`,
    ),
  ]);

  const checkIds = checks.map((c) => c.id);
  const results = checkIds.length
    ? (await sb<CheckResult[]>(`bilabs_check_results?check_id=in.(${checkIds.join(",")})&order=provider.asc,created_at.asc`)) ?? []
    : [];
  const byCheck = new Map<string, CheckResult[]>();
  for (const r of results) byCheck.set(r.check_id, [...(byCheck.get(r.check_id) ?? []), r]);

  return NextResponse.json({
    business: b,
    contact: contacts?.[0] ?? null,
    checks: checks.map((c) => ({ ...c, results: byCheck.get(c.id) ?? [] })),
    emails: emails ?? [],
    payments: payments ?? [],
    subscriptions: subs ?? [],
    audit: auditRows ?? [],
    role: admin.role,
  });
}
