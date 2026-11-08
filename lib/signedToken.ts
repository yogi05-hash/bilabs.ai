import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

/* Signed, expiring tokens carrying an email address.
 *
 * Shared by the admin and the customer sign-in: both are a magic link we send
 * ourselves and a session cookie we verify ourselves. Format:
 *
 *   <kind>.<base64url email>.<expiresAt ms>.<nonce>.<HMAC-SHA256>
 *
 * The kind is part of the signed body, so a customer token can never be read
 * as an admin one even if both were signed with the same secret. The format
 * must not change: the flow tests mint cookies by hand in exactly this shape. */

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeToken(secret: string, kind: string, email: string, ttlMs: number): string {
  // nonce makes two tokens for the same email differ, so one cannot be
  // recognised or replayed from a previously seen string
  const body = `${kind}.${Buffer.from(email.toLowerCase()).toString("base64url")}.${Date.now() + ttlMs}.${randomUUID()}`;
  return `${body}.${sign(secret, body)}`;
}

/** The email inside a valid, unexpired token of this kind — else null. */
export function readToken(secret: string, kind: string, token: string): string | null {
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [k, emailB64, expStr, nonce, mac] = parts;
  if (k !== kind) return null;

  const body = `${k}.${emailB64}.${expStr}.${nonce}`;
  const expected = sign(secret, body);
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
