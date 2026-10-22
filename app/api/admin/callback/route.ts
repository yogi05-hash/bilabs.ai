import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { COOKIE, SESSION_TTL_MS, isAdminEmail, makeSession, readLinkToken } from "@/lib/adminAuth";

/* Turns a valid link token into an httpOnly session cookie. */
export async function GET(req: NextRequest) {
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = readLinkToken(token);

  if (!email || !isAdminEmail(email)) {
    return NextResponse.redirect(`${site}/admin?err=link`);
  }

  const res = NextResponse.redirect(`${site}/admin`);
  res.cookies.set(COOKIE, makeSession(email), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
