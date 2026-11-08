import { env } from "@/lib/env";
import { siteUrl } from "@/lib/profile";

/* IndexNow: tell Bing (and everything that reads Bing's index — ChatGPT
 * search, Copilot, Perplexity, DuckDuckGo) that a page exists or changed.
 * Without this a new profile waits for a crawl; with it the index hears
 * within minutes. The key file is served by app/indexnow/[file]/route.ts.
 *
 * Returns false rather than throwing: a failed ping is retried next publish
 * and must never fail the publish itself. */

export async function pingIndexNow(urls: string[]): Promise<boolean> {
  const key = env("INDEXNOW_KEY");
  if (!key || !urls.length) return false;
  const site = siteUrl();
  let host: string;
  try {
    host = new URL(site).hostname;
  } catch {
    return false;
  }
  // IndexNow is for the public site; localhost or a preview host would be rejected anyway
  if (host === "localhost" || host.endsWith(".vercel.app")) return false;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation: `${site}/indexnow/${key}.txt`, urlList: urls.slice(0, 100) }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    // 200 and 202 both mean accepted
    if (res.status === 200 || res.status === 202) return true;
    console.warn("[indexnow]", res.status, (await res.text()).slice(0, 200));
    return false;
  } catch (e) {
    console.warn("[indexnow] threw:", e);
    return false;
  }
}
