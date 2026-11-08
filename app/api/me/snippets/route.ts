import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customerAuth";
import { buildSnippets } from "@/lib/snippets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const c = await requireCustomer(req);
  if (!c) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!c.business) return NextResponse.json({ error: "No business is set up for this account yet." }, { status: 409 });
  return NextResponse.json(buildSnippets(c.business));
}
