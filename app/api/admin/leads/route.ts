import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { sb, type Lead } from "@/lib/leads";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const status = p.get("status") ?? "";
  const source = p.get("source") ?? "";
  const q = (p.get("q") ?? "").trim();
  const sort = p.get("sort") === "score" ? "readiness_score" : "created_at";
  const dir = p.get("dir") === "asc" ? "asc" : "desc";

  const parts = [`order=${sort}.${dir}.nullslast`, "limit=500"];
  if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
  if (source) parts.push(`source=eq.${encodeURIComponent(source)}`);
  if (q) {
    const safe = q.replace(/[(),*]/g, " ");
    parts.push(`or=(email.ilike.*${safe}*,company.ilike.*${safe}*,website.ilike.*${safe}*,name.ilike.*${safe}*)`);
  }

  const rows = (await sb<Lead[]>(`bilabs_leads?${parts.join("&")}`)) ?? [];
  return NextResponse.json({ leads: rows });
}
