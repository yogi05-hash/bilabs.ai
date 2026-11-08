import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { customerFor, customerLoginUrl } from "@/lib/customerAuth";
import { sendDashboardLink } from "@/lib/customerMail";

export const runtime = "nodejs";

/* Emails a customer their dashboard sign-in link.
 *
 * Same response whether or not the address is a customer: this is public,
 * and confirming who pays us would be a gift to anyone fishing. */

const WINDOW_MS = 15 * 60 * 1000;
const MAX = 5;
const hits = new Map<string, { n: number; resetAt: number }>();
function allow(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { n: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.n >= MAX) return false;
  e.n++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.resetAt) hits.delete(k); }, 300_000).unref?.();

const GENERIC = { ok: true, message: "If that address has a BiLabs subscription, a sign-in link is on its way." };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return NextResponse.json(GENERIC);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json(GENERIC);

  if (!env("CUSTOMER_SESSION_SECRET") && !env("ADMIN_SESSION_SECRET")) {
    console.error("[me-login] no session secret configured");
    return NextResponse.json(GENERIC);
  }

  const customer = await customerFor(email);
  if (!customer) return NextResponse.json(GENERIC);

  await sendDashboardLink(customer.email, customerLoginUrl(customer.email), customer.contactId);
  return NextResponse.json(GENERIC);
}
