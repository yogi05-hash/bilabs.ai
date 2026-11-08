import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { COOKIE, SESSION_TTL_MS, customerFor, makeCustomerSession, readCustomerLink, safeNext } from "@/lib/customerAuth";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";

/* Turns a valid customer link token into an httpOnly session cookie. */
export async function GET(req: NextRequest) {
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  const email = readCustomerLink(token);
  const customer = email ? await customerFor(email) : null;
  if (!customer) return NextResponse.redirect(`${site}/dashboard?err=link`);

  await recordEvent({
    name: "dashboard_login",
    origin: "server",
    contactId: customer.contactId,
    // one login event per customer per day; a refreshed link is not a new fact
    dedupeKey: `dashboard_login:${customer.contactId}:${new Date().toISOString().slice(0, 10)}`,
    props: { has_business: Boolean(customer.business) },
    isTest: customer.lead.is_test === true,
  });

  const res = NextResponse.redirect(`${site}${next}`);
  res.cookies.set(COOKIE, makeCustomerSession(customer.email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
