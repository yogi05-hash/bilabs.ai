import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSettings } from "@/lib/admin";
import { buildOverview } from "@/lib/metrics";
import { resolvePeriod } from "@/lib/period";
import { sweepAbandoned } from "@/lib/evaluations";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Everything on the Overview, for one period.
 *
 * The abandonment sweep runs here rather than in a worker: opening the
 * dashboard is the moment the figures need to be current, and it is the only
 * guaranteed-regular trigger this project has. It is idempotent. */

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const period = resolvePeriod(p.get("range"), p.get("from"), p.get("to"));
  const settings = await getSettings();

  await sweepAbandoned();

  const overview = await buildOverview(period, settings.attributionWindowDays);

  /* The action-needed panel. Only things that are actually actionable:
   * a failing check, a follow-up that is late, a payment that did not go
   * through, an email that bounced, or a webhook we could not process. */
  const nowIso = new Date().toISOString();
  const [failed, overdue, failedPayments, failedEmails, badHooks] = await Promise.all([
    sb<{ id: string; website: string | null; failure_reason: string | null; started_at: string }[]>(
      `bilabs_evaluations?is_test=is.false&status=eq.failed&order=started_at.desc&limit=5&select=id,website,failure_reason,started_at`,
    ),
    sb<{ id: string; title: string; due_at: string; contact_id: string | null }[]>(
      `bilabs_followups?status=eq.open&due_at=lt.${nowIso}&order=due_at.asc&limit=5&select=id,title,due_at,contact_id`,
    ),
    sb<{ id: string; email: string | null; occurred_at: string; amount_pence: number }[]>(
      `bilabs_payments?kind=eq.payment_failed&order=occurred_at.desc&limit=5&select=id,email,occurred_at,amount_pence`,
    ),
    sb<{ id: string; email: string | null; kind: string; error: string | null; created_at: string }[]>(
      `bilabs_email_log?status=eq.failed&order=created_at.desc&limit=5&select=id,email,kind,error,created_at`,
    ),
    sb<{ stripe_event_id: string; type: string; reason: string | null; received_at: string }[]>(
      `bilabs_webhook_events?status=eq.error&order=received_at.desc&limit=5&select=stripe_event_id,type,reason,received_at`,
    ),
  ]);

  const recent =
    (await sb<{ name: string; occurred_at: string; path: string | null; contact_id: string | null; props: unknown }[]>(
      `bilabs_events?is_bot=is.false&is_internal=is.false&is_test=is.false&order=occurred_at.desc&limit=25` +
        `&select=name,occurred_at,path,contact_id,props`,
    )) ?? [];

  return NextResponse.json({
    ...overview,
    actionNeeded: {
      failedEvaluations: failed ?? [],
      overdueFollowUps: overdue ?? [],
      failedPayments: failedPayments ?? [],
      failedEmails: failedEmails ?? [],
      webhookErrors: badHooks ?? [],
    },
    recent,
    settings: { attributionWindowDays: settings.attributionWindowDays },
    role: admin.role,
  });
}
