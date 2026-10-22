import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { alertNewLead, upsertLead } from "@/lib/leads";
import { scanSite, type Check } from "@/lib/scan";
import { sendReport, type Payload } from "@/lib/report";
import { contextFrom, identifyVisitor, recordEvent, touchVisitor } from "@/lib/analytics";
import { getSettings } from "@/lib/admin";
import {
  attachContact,
  completeEvaluation,
  failEvaluation,
  findRunningDuplicate,
  markReportEmailed,
  startEvaluation,
} from "@/lib/evaluations";

export const maxDuration = 60;

/* The free AI check.
 *
 * Two halves, both real:
 *   1. Five differently-phrased questions put to an assistant with live web
 *      search, recording for each whether the business came back and who did.
 *   2. A fetch-based scan of the visitor's own site.
 *
 * Results are never adjusted. If a query fails we mark it unavailable instead
 * of counting it as a miss, and a site we cannot reach reports as unreachable
 * rather than scoring zero as though it had failed every check. The honest
 * limit is stated on the page and in the email: five samples from one
 * assistant at one moment are not a ranking.
 *
 * Each run costs five live web searches, so the per-IP window stays tight. */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
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

const ACCOLADE = /\b(award|winner|rated|reviews?|crowned|best .* in|voted)\b/i;
function namesFrom(answer: string): string[] {
  const listed = Array.from(answer.matchAll(/^\s*(?:\d+[.)]|[-*])\s*\*\*(.+?)\*\*/gm) as Iterable<RegExpMatchArray>)
    .map((m: RegExpMatchArray) => m[1].trim());
  return Array.from(new Set(listed))
    .map((n) => n.replace(/\s*[-–—:]\s*$/, "").trim())
    .filter((n) => n.length > 2 && n.length < 70 && /^[A-Z0-9]/.test(n) && !ACCOLADE.test(n));
}

type Variation = { id: string; label: string; question: string };

/** "a dentist" but "an AI consultant" — the naive template produced "a ai".
 *  Acronyms take the article of their spoken first letter, so it is "an MOT
 *  centre" and "an SEO agency" even though M and S are consonants. */
function article(noun: string): string {
  const first = noun.trim().split(/\s+/)[0] ?? "";
  if (!first) return "a";
  const letters = first.replace(/[^A-Za-z]/g, "");
  if (!letters) return "a";

  // Read as an acronym when the opening run is capitals: AI, MOT, SEO, HR.
  const isAcronym = /^[A-Z]{2,}$/.test(letters) || /^[A-Z]\.?[A-Z]/.test(first);
  if (isAcronym) return /^[AEFHILMNORSX]/.test(letters) ? "an" : "a";

  return /^[aeiou]/i.test(letters) ? "an" : "a";
}

/** Per-domain overrides, so we can test our own site with the questions our
 *  own customers would actually ask. Set CUSTOM_QUERIES as JSON:
 *  {"bilabs.ai":["question one","question two"]} */
function customFor(website: string): string[] | null {
  const raw = env("CUSTOM_QUERIES");
  if (!raw || !website) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string[]>;
    const host = website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
    const hit = map[host];
    return Array.isArray(hit) && hit.length ? hit.slice(0, 5) : null;
  } catch {
    return null;
  }
}

function variations(type: string, area: string, postcode: string, website: string): Variation[] {
  const custom = customFor(website);
  if (custom) {
    return custom.map((q, i) => ({ id: `custom-${i + 1}`, label: `Custom query ${i + 1}`, question: q }));
  }
  const a = article(type);
  const where = postcode || area;
  return [
    { id: "direct", label: "Straight recommendation", question: `Recommend ${a} ${type} in ${area}. Name up to 6 specific businesses with a one-line reason for each.` },
    { id: "near-me", label: "\u201CNear me\u201D phrasing", question: `I'm in ${area} and looking for a good ${type} near me. Which specific ones would you suggest? List up to 6 by name.` },
    { id: "urgent", label: "Urgent need", question: `I need ${a} ${type} in ${area} urgently today. Which specific businesses should I contact? List up to 6 by name.` },
    { id: "value", label: "Best / affordable", question: `Who is the best value ${type} in ${area}? Name up to 6 specific businesses and say briefly why.` },
    { id: "postcode", label: postcode ? `Postcode (${postcode})` : "Local area phrasing", question: `Which ${type} businesses serve ${where}? List up to 6 by name.` },
  ];
}

async function askOne(key: string, model: string, v: Variation, name: string, website: string) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
        messages: [{ role: "user", content: v.question }],
      }),
    });
    if (!res.ok) {
      console.error("[visibility]", v.id, res.status, (await res.text()).slice(0, 200));
      return { ...v, available: false, found: false, competitors: [] as string[], answer: "", searches: 0 };
    }
    const data = await res.json();
    const answer = (data.content ?? []).filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text).join("\n").trim();
    const found = (!!name && mentions(answer, name)) || (!!website && mentions(answer, website));
    // Billed searches as reported by the API, so the cost shown in the admin
    // is measured rather than assumed from max_uses.
    const searches = Number(data?.usage?.server_tool_use?.web_search_requests ?? 0) || 0;
    return { ...v, available: true, found, competitors: namesFrom(answer).slice(0, 6), answer: answer.slice(0, 1400), searches };
  } catch (e) {
    console.error("[visibility]", v.id, "threw:", e);
    return { ...v, available: false, found: false, competitors: [] as string[], answer: "", searches: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const body = await request.json().catch(() => null);

    const businessName = clean(body?.businessName, 120);
    const website = clean(body?.website, 160);
    const type = clean(body?.businessType, 80);
    const area = clean(body?.area, 80);
    const postcode = clean(body?.postcode, 12);
    const email = clean(body?.email, 160);
    const consent = body?.marketingConsent === true;

    if (!type || !area) {
      return NextResponse.json({ error: "Tell us what the business does and where it is." }, { status: 400 });
    }
    if (!allow(ip)) {
      return NextResponse.json({ error: "You've run a few checks already — try again in an hour." }, { status: 429 });
    }

    const key = env("ANTHROPIC_API_KEY");
    if (!key) return NextResponse.json({ error: "The check is unavailable just now." }, { status: 503 });
    const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001");

    /* Open a row before any work happens. A check that crashed, timed out or
     * lost its tab used to vanish without trace; now it always ends as
     * completed, failed with a reason, or swept to `abandoned`. */
    const settings = await getSettings();
    const ctx = contextFrom(request, settings.internalIpHashes);
    const { visitor } = await touchVisitor({ ctx, path: "/", countPageView: false });

    // A double-submit must not buy a second round of paid web searches.
    const dup = await findRunningDuplicate(visitor?.id ?? null, website || null);
    if (dup) {
      return NextResponse.json(
        { error: "That check is already running — give it a few seconds." },
        { status: 409 },
      );
    }

    const evaluation = await startEvaluation({
      visitorId: visitor?.id ?? null,
      website: website || null,
      businessName: businessName || null,
      businessType: type,
      area,
      postcode: postcode || null,
      isTest: ctx.isTest,
    });
    const startedAtMs = Date.now();

    let queries: Awaited<ReturnType<typeof askOne>>[];
    let scan: Awaited<ReturnType<typeof scanSite>> | null;
    try {
      const vs = variations(type, area, postcode, website);
      [queries, scan] = await Promise.all([
        Promise.all(vs.map((v) => askOne(key, model, v, businessName, website))),
        website ? scanSite(website) : Promise.resolve(null),
      ]);
    } catch (e) {
      if (evaluation) await failEvaluation(evaluation.id, e instanceof Error ? e.message : String(e), startedAtMs);
      throw e;
    }

    const ran = queries.filter((q) => q.available);
    const mentionCount = ran.filter((q) => q.found).length;

    // Every query failing is a failed job, not a business with no mentions.
    // Recording it as "0 of 5" would publish a result we never actually got.
    if (evaluation && ran.length === 0) {
      await failEvaluation(evaluation.id, "No query returned a usable answer from the model.", startedAtMs);
      return NextResponse.json({ error: "The check could not run just now." }, { status: 502 });
    }

    const competitors = Array.from(new Set(ran.flatMap((q) => q.competitors)))
      .filter((c) => !businessName || !mentions(c, businessName))
      .slice(0, 8);

    const checks: Check[] = scan?.reachable ? scan.checks : [];
    const score = scan?.reachable ? scan.score : null;

    if (evaluation) {
      await completeEvaluation(evaluation.id, {
        readinessScore: score,
        readinessMax: scan?.maxScore ?? null,
        siteReachable: scan ? scan.reachable : null,
        checks: scan?.reachable ? checks : null,
        mentions: mentionCount,
        mentionsTotal: ran.length,
        competitors,
        queries: queries.map((q) => ({ id: q.id, label: q.label, available: q.available, found: q.found })),
        model,
        webSearches: queries.reduce((n, q) => n + (q.searches ?? 0), 0),
        startedAtMs,
      });
    }

    if (email) {
      const lead = await upsertLead({
        email,
        name: clean(body?.name, 120) || null,
        company: businessName || null,
        website: website || null,
        business_type: type,
        area: postcode ? `${area} (${postcode})` : area,
        source: "check",
        mentions: mentionCount,
        mentions_total: ran.length,
        readiness_score: score,
        marketing_consent: consent,
        report: { queries, competitors, scan },
      });
      if (lead) {
        await alertNewLead(lead, "AI check");
        if (evaluation) await attachContact(evaluation.id, lead.id);
        // Joins this person's earlier anonymous activity to them — our own
        // first-party records, linked only once they volunteered the address.
        if (visitor) await identifyVisitor(visitor.id, lead.id);
        await recordEvent({
          name: "email_captured",
          origin: "server",
          visitorId: visitor?.id ?? null,
          contactId: lead.id,
          evaluationId: evaluation?.id ?? null,
          dedupeKey: `email_captured:${lead.id}:${evaluation?.id ?? "none"}`,
          props: { at: "evaluation", marketing_consent: consent },
          isTest: ctx.isTest,
        });
      }
    }

    const payload = {
      evaluationId: evaluation?.id ?? null,
      business: businessName || website || "your business",
      mentionCount,
      queriesRun: ran.length,
      queries: queries.map((q) => ({ id: q.id, label: q.label, question: q.question, available: q.available, found: q.found, competitors: q.competitors })),
      competitors,
      scan: scan
        ? { url: scan.url, reachable: scan.reachable, checks, score, maxScore: scan.maxScore, loadMs: scan.loadMs }
        : null,
      emailed: false as boolean,
    };

    if (email) {
      payload.emailed = await sendReport(email, payload as Payload, { type, area });
      if (payload.emailed && evaluation) await markReportEmailed(evaluation.id);
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[visibility] threw:", e);
    return NextResponse.json({ error: "The check could not run just now." }, { status: 500 });
  }
}

