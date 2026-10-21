import { NextRequest, NextResponse } from "next/server";

/* Enquiry capture.
 *
 * The form this replaces called preventDefault, set a success flag and sent
 * nothing anywhere — every enquiry since launch was shown a thank-you and
 * then discarded. So the order here matters: the lead is written to the
 * database FIRST and the notification email is best-effort afterwards. If
 * Resend is down, rate-limited or the sending domain breaks, the enquiry is
 * still safely recorded and the visitor is still told the truth.
 *
 * If the database write fails we return an error and the form says so, rather
 * than claiming success we cannot back up. */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const RESEND_KEY = (process.env.RESEND_API_KEY || "").trim();
const NOTIFY_TO = (process.env.LEAD_NOTIFY_TO || "hello@bilabs.ai").trim();
// bilabs.ai is not a verified Resend sender (it belongs to another team), so
// notifications go out from a domain we do have verified. Internal only — the
// visitor never sees this address.
const FROM = (process.env.LEAD_FROM || "BiLabs <no-reply@yourbotchat.com>").trim();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (e.count >= MAX_PER_WINDOW) return false;
  e.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
}, 300_000).unref?.();

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!allow(ip)) {
      return NextResponse.json(
        { error: "Too many enquiries from here. Please try again shortly, or email hello@bilabs.ai." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);

    const lead = {
      first_name: clean(body?.firstName, 80),
      last_name: clean(body?.lastName, 80),
      email: clean(body?.email, 160),
      company: clean(body?.company, 120),
      phone: clean(body?.phone, 40),
      message: clean(body?.message, 2000),
      business_type: clean(body?.businessType, 120),
      area: clean(body?.area, 120),
      website: clean(body?.website, 200),
      package: clean(body?.packageName, 80),
      source: clean(body?.source, 60) ?? "contact",
    };

    if (!lead.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[lead] supabase env missing");
      return NextResponse.json(
        { error: "We could not record that just now. Please email hello@bilabs.ai." },
        { status: 503 },
      );
    }

    // 1. Record it. This is the part that must not fail silently.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bilabs_leads`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(lead),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[lead] insert failed", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json(
        { error: "We could not record that just now. Please email hello@bilabs.ai." },
        { status: 502 },
      );
    }

    // 2. Tell someone. Best effort — a mail failure must not lose the lead.
    if (RESEND_KEY) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Someone";
      const rows = Object.entries({
        Name: name,
        Email: lead.email,
        Phone: lead.phone,
        Company: lead.company,
        "Business type": lead.business_type,
        Area: lead.area,
        Website: lead.website,
        Package: lead.package,
        Source: lead.source,
        Message: lead.message,
      })
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 16px 6px 0;color:#888;vertical-align:top">${k}</td><td style="font-weight:600">${esc(String(v))}</td></tr>`,
        )
        .join("");

      try {
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [NOTIFY_TO],
            reply_to: lead.email,
            subject: `New BiLabs enquiry — ${name}${lead.company ? ` (${lead.company})` : ""}`,
            html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
              <h2 style="margin:0 0 4px">New enquiry from bilabs.ai</h2>
              <p style="margin:0 0 16px;color:#666;font-size:14px">Reply directly to this email to reach them.</p>
              <table style="font-size:15px;border-collapse:collapse">${rows}</table>
            </div>`,
          }),
        });
        if (!mail.ok) {
          console.warn("[lead] resend failed", mail.status, (await mail.text()).slice(0, 200));
        }
      } catch (e) {
        console.warn("[lead] resend threw:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[lead] threw:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please email hello@bilabs.ai." },
      { status: 500 },
    );
  }
}
