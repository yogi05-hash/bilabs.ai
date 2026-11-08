import { NextRequest, NextResponse, after } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { publishBusiness } from "@/lib/pipeline";
import { runCheck } from "@/lib/checks";
import { publicBusiness } from "@/lib/businesses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// after() keeps the first check running once the response has gone
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!c.business) return NextResponse.json({ error: "No business is set up for this account yet." }, { status: 409 });

  const r = await publishBusiness(c.business.id, { by: c.email });
  if (!r.ok) return NextResponse.json({ error: Object.values(r.errors)[0], errors: r.errors }, { status: r.status });

  // The customer sees "first check running" immediately and the result
  // within a minute, rather than at the next cron tick.
  if (r.checkId) {
    const id = r.checkId;
    after(() => runCheck(id));
  }
  return NextResponse.json({ ok: true, url: r.url, firstPublish: r.firstPublish, checkId: r.checkId, business: publicBusiness(r.business) });
}
