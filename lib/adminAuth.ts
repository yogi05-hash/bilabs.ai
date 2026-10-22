import { NextRequest } from "next/server";
import { env } from "@/lib/env";

/* Admin access.
 *
 * The browser holds a Supabase session; every admin API call sends its access
 * token. We verify that token against Supabase itself rather than trusting
 * anything the client claims, then check the verified email against an
 * explicit allowlist. A valid Supabase account for some other product on the
 * shared project is therefore still not an admin here. */

export type Admin = { email: string };

export async function requireAdmin(req: NextRequest): Promise<Admin | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const base = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!base || !anon) return null;

  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = await res.json();
    const email = String(user?.email ?? "").toLowerCase();
    if (!email) return null;

    const allowed = env("ADMIN_EMAILS", "hello@bilabs.ai")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    return allowed.includes(email) ? { email } : null;
  } catch {
    return null;
  }
}
