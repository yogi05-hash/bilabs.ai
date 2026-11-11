import { NextRequest, NextResponse } from "next/server";
import { alertNewLead, sb, upsertLead } from "@/lib/leads";
import { sendReport, type Payload } from "@/lib/report";
import { contextFrom, identifyVisitor, recordEvent, touchVisitor } from "@/lib/analytics";
import { getSettings } from "@/lib/admin";
import { attachContact, markReportEmailed } from "@/lib/evaluations";
import { startUrl } from "@/lib/checkout";

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
    // optional callback number — "want a free 10-minute walkthrough?"
    const rawPhone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const phone = /\d{7,}/.test(rawPhone.replace(/[^\d]/g, "")) ? rawPhone : null;

    /* Order matters, and it was the wrong way round. The email was sent
     * first, so anything that threw while building or sending it returned a
     * 500 and the person's address was never recorded at all — the exact
     * failure the contact form was fixed for. Record first, mail second. */
    const lead = await upsertLead({
      email,
      phone,
      company: report.business || null,
      website: report.scan?.url ?? null,
      business_type: type || null,
      area: area || null,
      source: "check",
      mentions: report.mentionCount ?? null,
      mentions_total: report.queriesRun ?? null,
      readiness_score: report.scan?.score ?? null,
      marketing_consent: body?.marketingConsent === true,
      report,
    });
    if (!lead) {
      return NextResponse.json(
        { error: "We could not record that just now. Please email hello@bilabs.ai." },
        { status: 502 },
      );
    }

    const evaluationIdForLink = typeof body?.evaluationId === "string" && /^[0-9a-f-]{36}$/i.test(body.evaluationId) ? body.evaluationId : null;
    const sent = await sendReport(email, report, {
      type,
      area,
      // one click from the inbox to Stripe, with this check attached
      startUrl: startUrl({ contactId: lead.id, evaluationId: evaluationIdForLink, src: "report" }),
    });
    await alertNewLead(lead, "report unlock");

    /* This is the "email after the evaluation" half of capture. The funnel
     * has to accept both orders — someone who typed an address up front and
     * someone who ran the check first and unlocked afterwards are the same
     * journey, and the evaluation id is what joins them. */
    const settings = await getSettings();
    const ctx = contextFrom(request, settings.internalIpHashes);
    const { visitor } = await touchVisitor({ ctx, countPageView: false });
    const evaluationId = typeof body?.evaluationId === "string" ? body.evaluationId : null;

    if (lead) {
      if (evaluationId) {
        await attachContact(evaluationId, lead.id);
        if (sent) await markReportEmailed(evaluationId);
        if (phone) {
          await sb(`bilabs_evaluations?id=eq.${evaluationId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ phone }),
          });
        }
      }
      if (visitor) await identifyVisitor(visitor.id, lead.id);
      await recordEvent({
        name: "email_captured",
        origin: "server",
        visitorId: visitor?.id ?? null,
        contactId: lead.id,
        evaluationId,
        dedupeKey: `email_captured:${lead.id}:${evaluationId ?? "none"}`,
        props: { at: "report_unlock", marketing_consent: body?.marketingConsent === true },
        isTest: ctx.isTest,
      });
    }

    return NextResponse.json({ ok: true, emailed: sent });
  } catch (e) {
    console.error("[report] threw:", e);
    return NextResponse.json({ error: "Could not send that just now." }, { status: 500 });
  }
}
