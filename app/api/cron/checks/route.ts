import { NextRequest, NextResponse, after } from "next/server";
import { env } from "@/lib/env";
import { cronAuthorised } from "@/lib/cron";
import { claimQueuedCheck, runCheck, scheduleDueBusinesses, sweepAbandonedChecks } from "@/lib/checks";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* The check runner.
 *
 * On each tick: close out runs that died, queue every business whose monthly
 * date has come, then work the queue for as long as the function budget
 * allows. If work remains it calls itself again through after(), up to a
 * hop cap, so one scheduled tick drains the whole queue in 60-second slices
 * — a daily schedule is enough even on a plan whose crons run once a day.
 * Customer-triggered runs never wait for this: they start via after() in
 * their own routes. */

const BUDGET_MS = 35_000;
const MAX_HOPS = 10;

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const t0 = Date.now();
  const hop = Number(req.nextUrl.searchParams.get("hop") ?? "0") || 0;

  const swept = await sweepAbandonedChecks();
  const scheduled = hop === 0 ? await scheduleDueBusinesses() : 0;

  let ran = 0;
  const outcomes: { id: string; ok: boolean; reason?: string }[] = [];
  while (Date.now() - t0 < BUDGET_MS) {
    const check = await claimQueuedCheck();
    if (!check) break;
    const r = await runCheck(check.id);
    ran++;
    outcomes.push({ id: check.id, ...r });
  }

  const left = await sb<{ id: string }[]>("bilabs_checks?status=eq.queued&select=id&limit=1");
  const remaining = left?.length ?? 0;
  if (remaining > 0 && hop < MAX_HOPS) {
    const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
    const secret = env("CRON_SECRET");
    after(async () => {
      try {
        await fetch(`${site}/api/cron/checks?hop=${hop + 1}`, { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" });
      } catch (e) {
        console.warn("[cron/checks] chain failed:", e);
      }
    });
  }

  return NextResponse.json({ ok: true, hop, swept, scheduled, ran, outcomes, remaining, ms: Date.now() - t0 });
}
