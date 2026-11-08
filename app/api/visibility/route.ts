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
import { variations, type Variation } from "@/lib/questions";
import { mentions, namesFrom } from "@/lib/match";
import { ask, providerEnabled, providerModel } from "@/lib/providers";

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
 * The free check asks one assistant (Claude). The paid monthly check in
 * lib/checks.ts asks every assistant the customer chose, with the same
 * questions and the same matcher, so the two are comparable.
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

async function askOne(v: Variation, name: string, website: string) {
  const a = await ask("anthropic", v.question);
  if (!a.ok) {
    console.error("[visibility]", v.id, a.error);
    return { ...v, available: false, found: false, competitors: [] as string[], answer: "", searches: 0 };
  }
  const answer = a.text;
  const found = (!!name && mentions(answer, name)) || (!!website && mentions(answer, website));
  // Billed searches as reported by the API, so the cost shown in the admin
  // is measured rather than assumed from max_uses.
  return { ...v, available: true, found, competitors: namesFrom(answer).slice(0, 6), answer: answer.slice(0, 1400), searches: a.searches };
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
    // where the check came from: a ?site= link in a nurture email, etc.
    const entrySource = clean(body?.entrySource, 60) || null;

    /* The nurture cron re-runs a lead's check on day 16. It arrives from our
     * own server, so it must not share the visitor's per-IP window or be
     * collapsed as a double-submit. The header must match CRON_SECRET. */
    const cronSecret = env("CRON_SECRET");
    const internal = Boolean(cronSecret) && request.headers.get("x-internal-recheck") === cronSecret;

    if (!type || !area) {
      return NextResponse.json({ error: "Tell us what the business does and where it is." }, { status: 400 });
    }
    if (!internal && !allow(ip)) {
      return NextResponse.json({ error: "You've run a few checks already — try again in an hour." }, { status: 429 });
    }

    if (!providerEnabled("anthropic")) return NextResponse.json({ error: "The check is unavailable just now." }, { status: 503 });
    const model = providerModel("anthropic");

    /* Open a row before any work happens. A check that crashed, timed out or
     * lost its tab used to vanish without trace; now it always ends as
     * completed, failed with a reason, or swept to `abandoned`. */
    const settings = await getSettings();
    const ctx = contextFrom(request, settings.internalIpHashes);
    const { visitor } = await touchVisitor({ ctx, path: "/", countPageView: false });

    // A double-submit must not buy a second round of paid web searches.
    const dup = internal ? null : await findRunningDuplicate(visitor?.id ?? null, website || null);
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
      // our own runs (admin cookie or excluded IP) never reach the lists
      isInternal: ctx.isInternal,
      entrySource: entrySource ?? (internal ? "nurture-recheck" : null),
      requestedBy: internal ? "nurture" : undefined,
    });
    const startedAtMs = Date.now();

    let queries: Awaited<ReturnType<typeof askOne>>[];
    let scan: Awaited<ReturnType<typeof scanSite>> | null;
    try {
      const vs = variations(type, area, postcode, website);
      [queries, scan] = await Promise.all([
        Promise.all(vs.map((v) => askOne(v, businessName, website))),
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
        // the scan already fetched this page; enrichment reuses it
        homepageHtml: scan?.html ?? null,
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
        // scan.html is the raw homepage — useful for enrichment, far too big
        // and pointless to store on every lead row
        report: { queries, competitors, scan: scan ? { ...scan, html: undefined } : null },
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
