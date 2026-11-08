"use client";

import { useEffect, useState } from "react";
import { Loading } from "@/components/admin/ui";
import type { Call } from "@/components/dashboard/types";

/* Copy-paste blocks for the customer's own site. Same source as the hosted
 * profile, so they never disagree. */

type Snips = { profileUrl: string | null; jsonLd: string; llmsTxt: string; faqHtml: string; robotsTxt: string };

const BLOCKS: { key: keyof Omit<Snips, "profileUrl">; title: string; where: string }[] = [
  { key: "jsonLd", title: "Structured data (JSON-LD)", where: "Paste into the <head> of your homepage — or give it to whoever looks after your site. This is the single most useful thing on this page." },
  { key: "llmsTxt", title: "llms.txt", where: "Save as a file called llms.txt at the root of your site, so it is reachable at yoursite.co.uk/llms.txt." },
  { key: "faqHtml", title: "FAQ block", where: "Paste anywhere on your homepage or a services page. Real questions in real HTML, which assistants can quote." },
  { key: "robotsTxt", title: "robots.txt", where: "Add these lines to your robots.txt (or create one) so AI crawlers are allowed in. Many site builders have a setting for this." },
];

export default function Snippets({ call }: { call: Call }) {
  const [s, setS] = useState<Snips | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await call("/api/me/snippets");
      if (res && res.ok) setS(await res.json());
    })();
  }, [call]);

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* clipboard blocked */ }
  };

  if (!s) return <Loading />;

  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ad-ink-2)", margin: "0 0 16px" }}>
        Your hosted profile{s.profileUrl ? <> at <a href={s.profileUrl} target="_blank" rel="noopener" style={{ color: "var(--ad-amber-2)" }}>{s.profileUrl.replace(/^https?:\/\//, "")}</a></> : null} makes you readable today.
        The same facts on your own domain are what assistants trust most. Each block below is ready to paste; none of them changes how your site looks.
      </p>
      {BLOCKS.map((b) => (
        <div key={b.key} className="ad-card ad-card-pad" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <p className="ad-k" style={{ marginBottom: 2 }}>{b.title}</p>
              <p className="ad-note" style={{ margin: 0, maxWidth: 560 }}>{b.where}</p>
            </div>
            <button type="button" className="ad-btn" disabled={!s[b.key]} onClick={() => copy(b.key, s[b.key])}>{copied === b.key ? "Copied ✓" : "Copy"}</button>
          </div>
          <pre className="ad-code" style={{ marginTop: 10 }}>{s[b.key] || "(nothing to show yet — add details on the Profile tab)"}</pre>
        </div>
      ))}
    </div>
  );
}
