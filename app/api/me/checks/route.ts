import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { getCheck, getCheckResults, listChecks } from "@/lib/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ?id= → one check with every answer; otherwise the recent history. A check
 * is only returned if it belongs to this customer's business. */
export async function GET(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!c.business) return NextResponse.json({ checks: [] });

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const check = await getCheck(id);
    if (!check || check.business_id !== c.business.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const results = check.status === "completed" || check.status === "failed" ? await getCheckResults(check.id) : [];
    return NextResponse.json({ check, results });
  }
  const checks = await listChecks(c.business.id, 24);
  return NextResponse.json({ checks });
}
