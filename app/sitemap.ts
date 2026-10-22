import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/ai-visibility-london", priority: 0.9 },
    { path: "/ai-receptionist-small-business", priority: 0.9 },
    { path: "/about", priority: 0.7 },
    { path: "/work", priority: 0.6 },
    { path: "/contact", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
  ];
  return pages.map((p) => ({
    url: `${SITE.url}${p.path}`,
    changeFrequency: "weekly" as const,
    priority: p.priority,
  }));
}
