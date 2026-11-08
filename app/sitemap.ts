import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { sb } from "@/lib/leads";

export const revalidate = 3600;

/* Static pages plus every live business profile. A database that cannot be
 * reached degrades to the static list rather than a broken sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/ai-visibility-london", priority: 0.9 },
    { path: "/ai-receptionist-small-business", priority: 0.9 },
    { path: "/about", priority: 0.7 },
    { path: "/work", priority: 0.6 },
    { path: "/contact", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
  ];
  const out: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${SITE.url}${p.path}`,
    changeFrequency: "weekly" as const,
    priority: p.priority,
  }));

  const rows = await sb<{ slug: string; republished_at: string | null; updated_at: string }[]>(
    "bilabs_businesses?status=in.(processing,live)&is_test=is.false&slug=not.is.null&select=slug,republished_at,updated_at&order=published_at.desc&limit=5000",
  );
  for (const b of rows ?? []) {
    out.push({
      url: `${SITE.url}/b/${b.slug}`,
      lastModified: new Date(b.republished_at ?? b.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    });
  }
  return out;
}
