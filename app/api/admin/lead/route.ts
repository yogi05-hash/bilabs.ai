import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { logEvent, sb, setStatus, type Lead, type LeadStatus } from "@/lib/leads";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${id}&limit=1`);
  const events = await sb<{ kind: string; detail: string | null; created_at: string }[]>(
    `bilabs_lead_events?lead_id=eq.${id}&order=created_at.desc&limit=100`,
  );
  if (!rows?.[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead: rows[0], events: events ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  if (typeof body?.notes === "string") {
    await sb(`bilabs_leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ notes: body.notes.slice(0, 4000), updated_at: new Date().toISOString() }),
    });
    await logEvent(id, "note", `by ${admin.email}`);
  }

  const status = body?.status as LeadStatus | undefined;
  if (status && ["new", "nurturing", "paid", "unsubscribed", "lost"].includes(status)) {
    await setStatus(id, status, `by ${admin.email}`);
  }

  return NextResponse.json({ ok: true });
}
