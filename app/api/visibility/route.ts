import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { saveLead } from "@/lib/guide";

/* The free AI Visibility Report.
 *
 * Honestly: ONE live, web-searched answer from ONE assistant, right now. Not a
 * ranking, not a measurement of ChatGPT, and not stable — ask again tomorrow
 * and the list can differ. The page says exactly that, and we return the names
 * the assistant actually gave so a visitor judges evidence rather than a score
 * we invented.
 *
 * Each run costs a real web search plus ~11k input tokens and it is free and
 * unauthenticated, so the per-IP limit is deliberately tight. */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, { count: number; resetAt: number }>();
function allow(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.count >= MAX_PER_WINDOW) return false;
  e.count++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.resetAt) hits.delete(k); }, 600_000).unref?.();

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function mentions(hay: string, needle: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/https?:\/\//g, "").replace(/www\./g, "")
      .replace(/\.(co\.uk|com|net|org|uk)\b/g, "").replace(/\b(ltd|limited|the|and|&)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  const h = norm(hay); const n = norm(needle);
  if (!n) return false;
  if (h.includes(n)) return true;
  const words = n.split(" ").filter((w) => w.length > 3);
  return words.length > 0 && words.every((w) => h.includes(w));
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const body = await request.json().catch(() => null);

    const businessName = clean(body?.businessName, 120);
    const website = clean(body?.website, 160);
    const type = clean(body?.businessType, 80);
    const area = clean(body?.area, 80);

    if (!type || !area) return NextResponse.json({ error: "Tell us what the business does and where it is." }, { status: 400 });
    if (!allow(ip)) return NextResponse.json({ error: "You've run a few checks already — try again in an hour." }, { status: 429 });

    const key = env("ANTHROPIC_API_KEY");
    if (!key) return NextResponse.json({ error: "The check is unavailable just now." }, { status: 503 });

    const question = `Recommend a ${type} in ${area}. Name up to 6 specific businesses with a one-line reason for each.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        // Sonnet handles search-and-summarise more reliably than Haiku, and
        // this runs once per visitor rather than once per chat message.
        model: "claude-sonnet-5",
        max_tokens: 900,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!res.ok) {
      console.error("[visibility] anthropic", res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ error: "The check could not run just now." }, { status: 502 });
    }

    const data = await res.json();
    const answer = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
    const searched = (data.usage?.server_tool_use?.web_search_requests ?? 0) > 0;
    const found = (!!businessName && mentions(answer, businessName)) || (!!website && mentions(answer, website));

    // Only bold text that OPENS a list item counts as a business name —
    // taking every bold span swept up award blurbs and rating phrases.
    const ACCOLADE = /\b(award|winner|rated|reviews?|crowned|best .* in|voted)\b/i;
    const names = Array.from(answer.matchAll(/^\s*(?:\d+[.)]|[-*])\s*\*\*(.+?)\*\*/gm) as Iterable<RegExpMatchArray>).map((m: RegExpMatchArray) => m[1].trim());
    const competitors = Array.from(new Set(names))
      .map((n) => n.replace(/\s*[-–—:]\s*$/, "").trim())
      .filter((n) => n.length > 2 && n.length < 70 && /^[A-Z0-9]/.test(n) && !ACCOLADE.test(n))
      .slice(0, 6);

    if (businessName || website) {
      await saveLead({
        source: "visibility-report",
        business_type: type,
        area,
        website: website || null,
        company: businessName || null,
        message: `appeared: ${found ? "yes" : "no"}`,
        email: null,
      });
    }

    return NextResponse.json({ question, found, searched, competitors, answer: answer.slice(0, 1800) });
  } catch (e) {
    console.error("[visibility] threw:", e);
    return NextResponse.json({ error: "The check could not run just now." }, { status: 500 });
  }
}
