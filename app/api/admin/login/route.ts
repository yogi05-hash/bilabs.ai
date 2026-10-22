import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isAdminEmail, makeLinkToken } from "@/lib/adminAuth";

/* Emails a signed sign-in link through Resend.
 *
 * The response is identical whether or not the address is an admin — this
 * endpoint is public, and telling a stranger which addresses are privileged
 * would be handing them half the problem. */

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

const GENERIC = { ok: true, message: "If that address can access the admin, a sign-in link is on its way." };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return NextResponse.json(GENERIC);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json(GENERIC);

  // Silently stop here for non-admins — same response, no email sent.
  if (!isAdminEmail(email)) return NextResponse.json(GENERIC);

  const key = env("RESEND_API_KEY");
  if (!key || !env("ADMIN_SESSION_SECRET")) {
    console.error("[admin-login] not configured");
    return NextResponse.json(GENERIC);
  }

  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const link = `${site}/api/admin/callback?token=${encodeURIComponent(makeLinkToken(email))}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("LEAD_FROM", "BiLabs <no-reply@yourbotchat.com>"),
        to: [email],
        subject: "Your BiLabs admin sign-in link",
        html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;font-size:15px;line-height:1.6;color:#111">
          <h2 style="margin:0 0 12px">Sign in to BiLabs admin</h2>
          <p style="margin:0 0 18px">This link works once, for 15 minutes.</p>
          <p><a href="${link}" style="display:inline-block;background:#F5B731;color:#1a1205;padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none">Open the admin</a></p>
          <p style="margin:20px 0 0;font-size:12.5px;color:#888">If you did not ask for this, ignore it — nothing happens until the link is opened.</p>
        </div>`,
      }),
    });
    if (!res.ok) console.warn("[admin-login] resend", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.warn("[admin-login] send threw:", e);
  }

  return NextResponse.json(GENERIC);
}
