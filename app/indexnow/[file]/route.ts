import { NextRequest } from "next/server";
import { env } from "@/lib/env";

/* IndexNow key verification: /indexnow/<key>.txt must serve the key itself.
 * The key is public by design (it only proves we own this host). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const key = env("INDEXNOW_KEY");
  if (!key || file !== `${key}.txt`) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
