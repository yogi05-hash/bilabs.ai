import type { Business } from "@/lib/businesses";
import { AI_AGENTS, businessFaqJsonLd, businessJsonLd, businessLlmsTxt, profileUrl, safeJsonLd } from "@/lib/profile";

/* What a customer pastes into their own website.
 *
 * The hosted profile makes the business readable today; the same facts on
 * their own domain are what assistants weight most. These are generated from
 * the same source as the profile, so the two can never disagree. */

export type Snippets = {
  profileUrl: string | null;
  jsonLd: string;
  llmsTxt: string;
  faqHtml: string;
  robotsTxt: string;
};

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildSnippets(b: Business): Snippets {
  const profile = b.slug ? profileUrl(b) : null;
  const canonical = b.website ?? profile ?? "";

  const ld = [businessJsonLd(b, { canonicalUrl: canonical }), businessFaqJsonLd(b, canonical)].filter(Boolean);
  const jsonLd = ld.map((o) => `<script type="application/ld+json">\n${safeJsonLd(o)}\n</script>`).join("\n");

  const faqHtml = (b.faqs ?? []).length
    ? `<section id="faq">\n  <h2>Frequently asked questions</h2>\n${(b.faqs ?? [])
        .map((f) => `  <details>\n    <summary>${escHtml(f.q)}</summary>\n    <p>${escHtml(f.a).replace(/\n/g, "<br>")}</p>\n  </details>`)
        .join("\n")}\n</section>`
    : "";

  let sitemap = "";
  try {
    if (b.website) sitemap = `\nSitemap: ${new URL(b.website).origin}/sitemap.xml`;
  } catch { /* no website */ }
  const robotsTxt =
    `# Let AI assistants read this site\n` +
    AI_AGENTS.map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n") +
    `\n${sitemap}`;

  return { profileUrl: profile, jsonLd, llmsTxt: businessLlmsTxt(b), faqHtml, robotsTxt };
}
