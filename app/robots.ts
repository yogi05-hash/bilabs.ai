import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/* AI crawlers are explicitly welcomed — the whole product is about being
 * readable to them, so blocking them here would be self-defeating. */
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/"];
  const agents = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "Bingbot", "CCBot", "Applebot-Extended"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...agents.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
