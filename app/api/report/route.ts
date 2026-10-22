import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/guide";
import { sendReport, type Payload } from "@/lib/report";

/* Unlocks the full checklist by emailing the report.
 *
 * It takes the result the visitor already has rather than re-running the
 * check: five live web searches cost real money, and running them twice to
 * hand back something already computed would be waste. */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { count: number; resetAt: number }>();
function allow(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.count >= MAX_PER_WINDOW) return false;
  e.count++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.resetAt) hits.delete(k); }, 600_000).unref?.();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allow(ip)) {
      return NextResponse.json({ error: "Too many requests from here. Try again shortly." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().slice(0, 160) : "";
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const report = body?.report as Payload | undefined;
    if (!report || typeof report.mentionCount !== "number") {
      return NextResponse.json({ error: "Run the check first." }, { status: 400 });
    }

    const type = typeof body?.businessType === "string" ? body.businessType.slice(0, 80) : "";
    const area = typeof body?.area === "string" ? body.area.slice(0, 80) : "";

    const sent = await sendReport(email, report, { type, area });

    await saveLead({
      source: "ai-check-unlock",
      email,
      business_type: type || null,
      area: area || null,
      company: report.business || null,
      website: report.scan?.url ?? null,
      message: `unlocked report · mentioned ${report.mentionCount}/${report.queriesRun}${report.scan?.score != null ? ` · readiness ${report.scan.score}/100` : ""}`,
    });

    return NextResponse.json({ ok: true, emailed: sent });
  } catch (e) {
    console.error("[report] threw:", e);
    return NextResponse.json({ error: "Could not send that just now." }, { status: 500 });
  }
}
