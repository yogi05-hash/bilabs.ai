import { sb } from "@/lib/leads";
import { recordEvent } from "@/lib/analytics";

/* The free AI check, as a tracked job.
 *
 * Before this, a check existed only as a side effect: if the visitor typed an
 * email we wrote a lead, and if they did not, nothing survived the request. So
 * "how many checks ran?" had no answer, and a check that crashed left no trace
 * at all. Every run now opens a row first and closes it either way.
 *
 * The two halves of a check are stored as two separate things and must stay
 * that way on screen:
 *   - readiness_score: a fetch-based scan of the visitor's own website. Ours,
 *     deterministic, repeatable.
 *   - mentions / mentions_total: how many of N differently-phrased questions
 *     an assistant answered with this business in it. A sample from one model
 *     at one moment, not a ranking, and not a property of their website.
 * Averaging or adding them would be meaningless, so nothing here does.
 */

export type EvalStatus = "queued" | "running" | "completed" | "failed" | "abandoned";

/* A run makes five live web searches and normally finishes well inside a
 * minute; the route's own ceiling is 60s (maxDuration). Ten minutes is
 * therefore far past any legitimate run, and a row still open after it means
 * the process died without reporting — the visitor closed the tab mid-run, or
 * the function was killed. Those are marked `abandoned`, which is a different
 * fact from `failed`: failed means the job ran and told us why it could not
 * finish. */
export const ABANDON_AFTER_MS = 10 * 60 * 1000;

/* Two identical checks in quick succession are a double-submit, not demand.
 * Within this window the existing run is returned instead of starting a second
 * one — five paid web searches per run makes that worth preventing. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export type Evaluation = {
  id: string;
  visitor_id: string | null;
  contact_id: string | null;
  website: string | null;
  business_name: string | null;
  business_type: string | null;
  area: string | null;
  postcode: string | null;
  status: EvalStatus;
  started_at: string;
  completed_at: string | null;
  runtime_ms: number | null;
  readiness_score: number | null;
  readiness_max: number | null;
  site_reachable: boolean | null;
  checks: unknown;
  mentions: number | null;
  mentions_total: number | null;
  competitors: unknown;
  queries: unknown;
  model: string | null;
  web_searches: number | null;
  est_cost_pence: string | number | null;
  report_emailed_at: string | null;
  report_viewed_at: string | null;
  report_views: number;
  failure_reason: string | null;
  attempt: number;
  retry_of: string | null;
  requested_by: string | null;
  is_test: boolean;
  created_at: string;
};

/* Anthropic bills server-side web search at $10 per 1,000 searches, plus
 * normal token cost. Only the search count is reported back per request, so
 * that is the part we can state as measured; the token cost is small beside it
 * and is deliberately left out rather than guessed at. USD→GBP is a fixed
 * declared rate, not a live FX lookup — it is labelled as an estimate
 * everywhere it appears. */
export const USD_PER_SEARCH = 0.01;
export const USD_TO_GBP = 0.79;

export function estimateCostPence(webSearches: number): number {
  return Math.round(webSearches * USD_PER_SEARCH * USD_TO_GBP * 100 * 10_000) / 10_000;
}

export async function startEvaluation(input: {
  visitorId?: string | null;
  contactId?: string | null;
  website?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  area?: string | null;
  postcode?: string | null;
  isTest?: boolean;
  requestedBy?: string | null;
  retryOf?: string | null;
  attempt?: number;
}): Promise<Evaluation | null> {
  const rows = await sb<Evaluation[]>("bilabs_evaluations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      visitor_id: input.visitorId ?? null,
      contact_id: input.contactId ?? null,
      website: input.website ?? null,
      business_name: input.businessName ?? null,
      business_type: input.businessType ?? null,
      area: input.area ?? null,
      postcode: input.postcode ?? null,
      status: "running",
      started_at: new Date().toISOString(),
      requested_by: input.requestedBy ?? "visitor",
      retry_of: input.retryOf ?? null,
      attempt: input.attempt ?? 1,
      is_test: input.isTest ?? false,
    }),
  });
  const ev = rows?.[0] ?? null;
  if (ev) {
    await recordEvent({
      name: "evaluation_started",
      origin: "server",
      visitorId: ev.visitor_id,
      contactId: ev.contact_id,
      evaluationId: ev.id,
      dedupeKey: `eval_started:${ev.id}`,
      props: { website: ev.website, business_type: ev.business_type, attempt: ev.attempt },
      isTest: ev.is_test,
    });
  }
  return ev;
}

/** An in-flight run for the same website from the same visitor, if one exists.
 *  Used to collapse double-submits onto a single job. */
export async function findRunningDuplicate(
  visitorId: string | null,
  website: string | null,
): Promise<Evaluation | null> {
  if (!visitorId || !website) return null;
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const rows = await sb<Evaluation[]>(
    `bilabs_evaluations?visitor_id=eq.${visitorId}&website=eq.${encodeURIComponent(website)}` +
      `&status=eq.running&started_at=gte.${since}&order=started_at.desc&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function completeEvaluation(
  id: string,
  result: {
    readinessScore: number | null;
    readinessMax: number | null;
    siteReachable: boolean | null;
    checks: unknown;
    mentions: number | null;
    mentionsTotal: number | null;
    competitors: unknown;
    queries: unknown;
    model: string | null;
    webSearches: number | null;
    startedAtMs: number;
  },
): Promise<void> {
  const runtime = Date.now() - result.startedAtMs;
  const rows = await sb<Evaluation[]>(`bilabs_evaluations?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "completed",
      completed_at: new Date().toISOString(),
      runtime_ms: runtime,
      readiness_score: result.readinessScore,
      readiness_max: result.readinessMax,
      site_reachable: result.siteReachable,
      checks: result.checks ?? null,
      mentions: result.mentions,
      mentions_total: result.mentionsTotal,
      competitors: result.competitors ?? null,
      queries: result.queries ?? null,
      model: result.model,
      web_searches: result.webSearches,
      est_cost_pence: result.webSearches !== null ? estimateCostPence(result.webSearches) : null,
    }),
  });
  const ev = rows?.[0];
  await recordEvent({
    name: "evaluation_completed",
    origin: "server",
    visitorId: ev?.visitor_id ?? null,
    contactId: ev?.contact_id ?? null,
    evaluationId: id,
    dedupeKey: `eval_completed:${id}`,
    props: {
      readiness_score: result.readinessScore,
      mentions: result.mentions,
      mentions_total: result.mentionsTotal,
      runtime_ms: runtime,
    },
    isTest: ev?.is_test ?? false,
  });
}

export async function failEvaluation(id: string, reason: string, startedAtMs?: number): Promise<void> {
  const rows = await sb<Evaluation[]>(`bilabs_evaluations?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "failed",
      completed_at: new Date().toISOString(),
      runtime_ms: startedAtMs ? Date.now() - startedAtMs : null,
      failure_reason: reason.slice(0, 500),
    }),
  });
  const ev = rows?.[0];
  await recordEvent({
    name: "evaluation_failed",
    origin: "server",
    visitorId: ev?.visitor_id ?? null,
    contactId: ev?.contact_id ?? null,
    evaluationId: id,
    dedupeKey: `eval_failed:${id}`,
    props: { reason: reason.slice(0, 200) },
    isTest: ev?.is_test ?? false,
  });
}

export async function attachContact(evaluationId: string, contactId: string): Promise<void> {
  await sb(`bilabs_evaluations?id=eq.${evaluationId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ contact_id: contactId }),
  });
}

/** Counts a view of the full report. The first one stamps report_viewed_at;
 *  later ones only increment, so "time to first view" stays meaningful. */
export async function markReportViewed(evaluationId: string): Promise<void> {
  const rows = await sb<{ report_views: number; report_viewed_at: string | null }[]>(
    `bilabs_evaluations?id=eq.${evaluationId}&select=report_views,report_viewed_at&limit=1`,
  );
  const prev = rows?.[0];
  if (!prev) return;
  await sb(`bilabs_evaluations?id=eq.${evaluationId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      report_views: (prev.report_views ?? 0) + 1,
      report_viewed_at: prev.report_viewed_at ?? new Date().toISOString(),
    }),
  });
}

export async function markReportEmailed(evaluationId: string): Promise<void> {
  await sb(`bilabs_evaluations?id=eq.${evaluationId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ report_emailed_at: new Date().toISOString() }),
  });
}

/** Close out runs that never reported back. Returns how many were swept.
 *  Called from the dashboard and the daily cron, so the figure is current
 *  without needing a worker process. */
export async function sweepAbandoned(): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS).toISOString();
  const rows = await sb<{ id: string }[]>(
    `bilabs_evaluations?status=eq.running&started_at=lt.${cutoff}&select=id`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "abandoned",
        failure_reason: "No result reported within 10 minutes — the run did not finish.",
      }),
    },
  );
  return rows?.length ?? 0;
}
