import { NextRequest } from "next/server";
import { env } from "@/lib/env";

/* Who may trigger a scheduled job.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron request
 * when that variable is set, so the bearer check alone covers both Vercel
 * and a manual run with curl. The old fallback that accepted any request
 * carrying an `x-vercel-cron` header is gone — anyone could set a header. */
export function cronAuthorised(req: NextRequest): boolean {
  const secret = env("CRON_SECRET");
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
