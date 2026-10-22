import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sb, setStatus, type Lead } from "@/lib/leads";
import { STEPS, advance, buildEmail, buildRecheck, sendMail } from "@/lib/nurture";

export const maxDuration = 60;

/* Daily nurture run.
 *
 * Only ever touches leads that are consented, still "nurturing", and due.
 * Paid, unsubscribed and lost are excluded in the query itself rather than
 * filtered later, so a bug in the loop cannot email someone who opted out. */

function authorised(req: NextRequest): boolean {
  const secret = env("CRON_SECRET");
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  // Vercel cron sends its own header
  return req.headers.get("x-vercel-cron") !== null;
}

const days = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const leads =
    (await sb<Lead[]>(
      "bilabs_leads?status=eq.nurturing&marketing_consent=is.true&email=not.is.null&order=created_at.asc&limit=200",
    )) ?? [];

  const summary: Record<string, number> = { considered: leads.length, sent: 0, skipped: 0, finished: 0 };

  for (const lead of leads) {
    const age = days(lead.created_at);
    // the next step this lead has not had yet
    const next = STEPS.find((s) => s.step > lead.nurture_step);
    if (!next) continue;
    if (age < next.day) continue;

    // one email per lead per run, and never two in the same day
    if (lead.last_emailed_at && days(lead.last_emailed_at) < 1) continue;

    const mail = next.id === "recheck" ? await buildRecheck(lead) : buildEmail(lead, next.id);

    if (!mail) {
      // nothing honest to say for this step — move past it rather than pad it
      await advance(lead, next.step, next.id, false);
      summary.skipped++;
      continue;
    }

    const sent = await sendMail(lead, mail);
    await advance(lead, next.step, next.id, sent);
    if (sent) summary.sent++;
    else summary.skipped++;

    if (next.id === "last" && sent) {
      await setStatus(lead.id, "lost", "sequence finished");
      summary.finished++;
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
