import { NextRequest, NextResponse, after } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { PUBLISHABLE } from "@/lib/businesses";
import { enqueueCheck, openCheckFor, runCheck } from "@/lib/checks";
import { sb } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* "Run a check now."
 *
 * Each run is twenty live web searches, so the limits are the ones that
 * matter for money and they live in the database, not in memory: one manual
 * run a day and four a month per business, counted from bilabs_checks. */

const DAILY = 1;
const MONTHLY = 4;

export async function POST(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const b = c.business;
  if (!b) return NextResponse.json({ error: "No business is set up for this account yet." }, { status: 409 });
  if (!PUBLISHABLE.includes(b.status)) {
    return NextResponse.json({ error: "Publish your profile first — the check runs automatically when you do." }, { status: 409 });
  }

  if (await openCheckFor(b.id)) return NextResponse.json({ error: "A check is already running." }, { status: 409 });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [today, month] = await Promise.all([
    sb<{ id: string }[]>(`bilabs_checks?business_id=eq.${b.id}&trigger=eq.manual&created_at=gte.${dayAgo}&select=id`),
    sb<{ id: string }[]>(`bilabs_checks?business_id=eq.${b.id}&trigger=eq.manual&created_at=gte.${monthStart}&select=id`),
  ]);
  if ((today?.length ?? 0) >= DAILY) {
    return NextResponse.json({ error: "You can run one check a day. Your monthly check runs automatically." }, { status: 429 });
  }
  if ((month?.length ?? 0) >= MONTHLY) {
    return NextResponse.json({ error: `You've used this month's ${MONTHLY} extra checks. The scheduled check still runs.` }, { status: 429 });
  }

  const check = await enqueueCheck(b.id, "manual", c.email);
  if (!check) return NextResponse.json({ error: "Could not start a check just now." }, { status: 500 });

  const id = check.id;
  after(() => runCheck(id));
  return NextResponse.json({ checkId: id });
}
