import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logEvent, sb, type Lead } from "@/lib/leads";

/* One-click unsubscribe. The token is per-lead, so a link cannot be used to
 * unsubscribe anyone else, and the link works without a login. */

async function handle(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");

  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.redirect(`${site}/unsubscribed?ok=0`);
  }

  const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${id}&unsubscribe_token=eq.${token}&limit=1`);
  const lead = rows?.[0];
  if (!lead) return NextResponse.redirect(`${site}/unsubscribed?ok=0`);

  await sb(`bilabs_leads?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "unsubscribed", marketing_consent: false, updated_at: new Date().toISOString() }),
  });
  await logEvent(id, "unsubscribed", "one-click link");

  return NextResponse.redirect(`${site}/unsubscribed?ok=1`);
}

export async function GET(req: NextRequest) { return handle(req); }
// RFC 8058: mail clients send a POST for List-Unsubscribe-Post.
export async function POST(req: NextRequest) { return handle(req); }
