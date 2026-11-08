import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { AI_AGENTS } from "@/lib/profile";

/* AI crawlers are explicitly welcomed — the whole product is about being
 * readable to them, so blocking them here would be self-defeating. */
export default function robots(): MetadataRoute.Robots {
  // /b/ (published business profiles) is deliberately NOT here — being read
  // by these crawlers is the whole point of it.
  const disallow = ["/api/", "/admin", "/dashboard", "/welcome", "/unsubscribed", "/indexnow/"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
