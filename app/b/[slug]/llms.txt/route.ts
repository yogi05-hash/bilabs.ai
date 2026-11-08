import { NextRequest } from "next/server";
import { getBusinessBySlug, PUBLISHABLE } from "@/lib/businesses";
import { businessLlmsTxt } from "@/lib/profile";

export const revalidate = 600;

/* The profile as plain text, in the llms.txt convention. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const b = await getBusinessBySlug(slug);
  if (!b || !PUBLISHABLE.includes(b.status)) return new Response("Not found", { status: 404 });
  return new Response(businessLlmsTxt(b), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      ...(b.is_test ? { "X-Robots-Tag": "noindex" } : {}),
    },
  });
}
