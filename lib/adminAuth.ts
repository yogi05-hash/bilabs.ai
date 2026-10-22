import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";

/* Admin access, by magic link we deliver ourselves.
 *
 * Supabase's own auth emails never arrived, so the link is signed here and
 * sent through Resend — the same transport the rest of the site already uses
 * and which we can see the delivery status of.
 *
 * Two signed artefacts, both HMAC-SHA256 over a server-only secret:
 *   - the link token: short-lived (15 minutes), carries the email
 *   - the session cookie: httpOnly, 7 days, carries the email
 * Neither is a bearer token anyone can mint, and neither contains anything
 * secret — forging one requires ADMIN_SESSION_SECRET.
 *
 * Allowlist membership is checked when the link is requested AND again on
 * every verified request, so removing an address from ADMIN_EMAILS locks out
 * an already-issued session on its next call rather than at expiry. */

export const COOKIE = "bl_admin";
const LINK_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const secret = () => env("ADMIN_SESSION_SECRET");

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function pack(kind: "link" | "session", email: string, expiresAt: number): string {
  // nonce makes two tokens for the same email differ, so one cannot be
  // recognised or replayed from a previously seen string
  const body = `${kind}.${Buffer.from(email).toString("base64url")}.${expiresAt}.${randomUUID()}`;
  return `${body}.${sign(body)}`;
}

function unpack(kind: "link" | "session", token: string): string | null {
  if (!secret() || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [k, emailB64, expStr, nonce, mac] = parts;
  if (k !== kind) return null;

  const body = `${k}.${emailB64}.${expStr}.${nonce}`;
  const expected = sign(body);
  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  try {
    return Buffer.from(emailB64, "base64url").toString("utf8").toLowerCase();
  } catch {
    return null;
  }
}

export function adminEmails(): string[] {
  return env("ADMIN_EMAILS", "hello@bilabs.ai")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdminEmail = (email: string) => adminEmails().includes(email.trim().toLowerCase());

export const makeLinkToken = (email: string) => pack("link", email.toLowerCase(), Date.now() + LINK_TTL_MS);
export const readLinkToken = (token: string) => unpack("link", token);

export const makeSession = (email: string) => pack("session", email.toLowerCase(), Date.now() + SESSION_TTL_MS);

export type Admin = { email: string };

/** The only way in. Reads the signed cookie and re-checks the allowlist. */
export async function requireAdmin(req: NextRequest): Promise<Admin | null> {
  const raw = req.cookies.get(COOKIE)?.value ?? "";
  const email = unpack("session", raw);
  if (!email) return null;
  if (!isAdminEmail(email)) return null;
  return { email };
}
