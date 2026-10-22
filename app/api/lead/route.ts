import { NextRequest, NextResponse } from "next/server";
import { alertNewLead, upsertLead } from "@/lib/leads";

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

/* Config values arrive with junk attached more often than you would think.
 * This project's Supabase URL was stored as `"https://...supabase.co\n"` —
 * surrounding quotes AND a trailing newline — which .trim() alone does not
 * fix, and which failed only in production with an opaque Invalid URL. Strip
 * whitespace and matching quotes on the way in so a sloppy value cannot take
 * the form down again. */
const env = (name: string, fallback = ""): string => {
  const raw = process.env[name] ?? fallback;
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    // a LITERAL backslash-n, not a newline — this is how the value actually
    // arrived, and trim() cannot see it
    .replace(/(\\[rn])+$/g, "")
    .trim();
};

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_KEY = env("RESEND_API_KEY");
const NOTIFY_TO = env("LEAD_NOTIFY_TO", "hello@bilabs.ai");
// bilabs.ai is not a verified Resend sender (it belongs to another team), so
// notifications go out from a domain we do have verified. Internal only — the
// visitor never sees this address.
const FROM = env("LEAD_FROM", "BiLabs <no-reply@yourbotchat.com>");

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

    const lead_email = lead.email ?? "";
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

    // 1. Record it, as one row per email address. This replaced a raw INSERT
    //    that collided with the unique email index the moment the same person
    //    enquired twice — upsertLead creates or merges, so it cannot.
    const row = await upsertLead({
      email: lead_email,
      name: [clean(body?.firstName, 80), clean(body?.lastName, 80)].filter(Boolean).join(" ") || null,
      company: clean(body?.company, 120) || null,
      website: clean(body?.website, 200) || null,
      business_type: clean(body?.businessType, 120) || null,
      area: clean(body?.area, 120) || null,
      source: "contact",
      marketing_consent: body?.marketingConsent === true,
      message: clean(body?.message, 2000) || null,
    });
    if (!row) {
      console.error("[lead] upsert failed");
      return NextResponse.json(
        { error: "We could not record that just now. Please email hello@bilabs.ai." },
        { status: 502 },
      );
    }

    // 2. Tell someone. Best effort — a mail failure must not lose the lead.
    await alertNewLead(row, "contact form");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[lead] threw:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please email hello@bilabs.ai." },
      { status: 500 },
    );
  }
}
