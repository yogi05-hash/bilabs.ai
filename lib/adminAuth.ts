import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sb } from "@/lib/leads";
import { makeToken, readToken } from "@/lib/signedToken";

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

// The token format lives in lib/signedToken.ts and is shared with the
// customer sign-in; the kinds differ, so neither can be read as the other.
const pack = (kind: "link" | "session", email: string, ttlMs: number) => makeToken(secret(), kind, email, ttlMs);
const unpack = (kind: "link" | "session", token: string) => readToken(secret(), kind, token);

export function adminEmails(): string[] {
  return env("ADMIN_EMAILS", "hello@bilabs.ai")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdminEmail = (email: string) => adminEmails().includes(email.trim().toLowerCase());

export const makeLinkToken = (email: string) => pack("link", email, LINK_TTL_MS);
export const readLinkToken = (token: string) => unpack("link", token);

export const makeSession = (email: string) => pack("session", email, SESSION_TTL_MS);

export type Role = "owner" | "admin" | "readonly";
export type Admin = { email: string; role: Role };

const ROLES: Role[] = ["owner", "admin", "readonly"];

/* Roles live in bilabs_admins. ADMIN_EMAILS stays the gate — an address must
 * be on it to get in at all — and anyone on it without a row is treated as
 * owner, so adding the table could not lock the existing admins out of their
 * own dashboard. */
async function roleFor(email: string): Promise<Role> {
  const rows = await sb<{ role: string }[]>(
    `bilabs_admins?email=eq.${encodeURIComponent(email)}&select=role&limit=1`,
  );
  const r = rows?.[0]?.role as Role | undefined;
  return r && ROLES.includes(r) ? r : "owner";
}

/** The only way in. Reads the signed cookie and re-checks the allowlist. */
export async function requireAdmin(req: NextRequest): Promise<Admin | null> {
  const raw = req.cookies.get(COOKIE)?.value ?? "";
  const email = unpack("session", raw);
  if (!email) return null;
  if (!isAdminEmail(email)) return null;
  return { email, role: await roleFor(email) };
}

/** Write access. A read-only admin can see everything and change nothing. */
export function canWrite(admin: Admin): boolean {
  return admin.role === "owner" || admin.role === "admin";
}

/** Owner-only: roles, retention, deletion, integration settings. */
export function canAdminister(admin: Admin): boolean {
  return admin.role === "owner";
}

/** Guard for a mutating route. Returns an error response, or null to proceed. */
export async function requireWriter(req: NextRequest): Promise<{ admin: Admin } | { error: NextResponse }> {
  const admin = await requireAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  if (!canWrite(admin)) {
    return { error: NextResponse.json({ error: "Read-only access — changes are not permitted." }, { status: 403 }) };
  }
  return { admin };
}

export async function requireOwner(req: NextRequest): Promise<{ admin: Admin } | { error: NextResponse }> {
  const admin = await requireAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  if (!canAdminister(admin)) {
    return { error: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  }
  return { admin };
}

/* Stamp the login. Deliberately not an upsert with a role in the payload:
 * PostgREST's merge-duplicates updates every column it is given, so sending a
 * role here would reset a deliberately-set `readonly` back to owner on that
 * person's next sign-in. The row is created once, then only touched. */
export async function noteLogin(email: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await sb<{ email: string }[]>(
    `bilabs_admins?email=eq.${encodeURIComponent(email)}&select=email&limit=1`,
  );
  if (existing?.[0]) {
    await sb(`bilabs_admins?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_login_at: now }),
    });
    return;
  }
  // First sign-in for an allowlisted address: seed as owner, matching the
  // fallback in roleFor so behaviour does not change the moment a row exists.
  await sb("bilabs_admins", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({ email, role: "owner", last_login_at: now }),
  });
}
