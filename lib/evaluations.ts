import { env } from "@/lib/env";
import { sb } from "@/lib/leads";
import { recordEvent } from "@/lib/analytics";
import { enrichSite, type Contact } from "@/lib/enrich";
import { logEmail } from "@/lib/admin";

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
  /* capture upgrade */
  site_title: string | null;
  phone: string | null;
  /** outreach state for THIS run — not the contact's pipeline_status */
  lead_status: "new" | "called" | "interested" | "paid" | "not_interested";
  lead_notes: string | null;
  is_internal: boolean;
  entry_source: string | null;
  enrichment: Contact | null;
  enriched_at: string | null;
};

export const LEAD_STATUSES = ["new", "called", "interested", "paid", "not_interested"] as const;

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
  isInternal?: boolean;
  entrySource?: string | null;
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
      is_internal: input.isInternal ?? false,
      entry_source: input.entrySource ?? null,
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
    /** the homepage HTML the scan already fetched, for enrichment */
    homepageHtml?: string | null;
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

  /* Enrichment and the instant alert, best-effort: a scrape or mail failure
   * must never fail a check the visitor is still waiting on. */
  if (ev) {
    let contact: Contact | null = null;
    if (ev.website && result.homepageHtml) {
      try {
        contact = await enrichSite(ev.website, result.homepageHtml);
        await sb(`bilabs_evaluations?id=eq.${id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            enrichment: contact,
            enriched_at: new Date().toISOString(),
            site_title: contact.title,
          }),
        });
      } catch (e) {
        console.warn("[evaluations] enrichment failed:", e);
      }
    }
    try {
      await alertCheck({ ...ev, enrichment: contact ?? ev.enrichment });
    } catch (e) {
      console.warn("[evaluations] alert failed:", e);
    }
  }
}

/* The instant "someone just ran a check" email.
 *
 * Fires for every real completed check, including fully anonymous ones —
 * those are exactly the ones where the published business details are the
 * only way to follow up. Internal and test runs stay silent. */
export async function alertCheck(ev: Evaluation): Promise<void> {
  if (ev.is_test || ev.is_internal) return;
  const key = env("RESEND_API_KEY");
  if (!key) return;

  const to = env("LEAD_NOTIFY_TO", "hello@bilabs.ai");
  const from = env("LEAD_FROM", "BiLabs <no-reply@yourbotchat.com>");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (k: string, v: unknown) =>
    v === null || v === undefined || v === ""
      ? ""
      : `<tr><td style="padding:6px 16px 6px 0;color:#888;vertical-align:top">${k}</td><td style="font-weight:600">${v}</td></tr>`;

  const e = ev.enrichment;
  // the visitor's own number first; a published one second
  const phone = ev.phone ?? e?.phones?.[0] ?? null;
  const email = e?.emails?.[0] ?? null;
  const domain = ev.website ? ev.website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") : null;

  const telLink = phone
    ? `<p style="margin:18px 0 0"><a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}" style="display:inline-block;background:#167C45;color:#fff;padding:11px 20px;border-radius:999px;font-weight:700;text-decoration:none">Call now · ${esc(phone)}</a></p>`
    : "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Check run — ${domain ?? ev.business_name ?? "unknown"}${ev.readiness_score !== null ? ` (${ev.readiness_score}/100)` : ""}${ev.mentions !== null ? ` · mentioned ${ev.mentions}/${ev.mentions_total}` : ""}`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
        <h2 style="margin:0 0 14px">Someone just checked ${esc(ev.site_title ?? e?.title ?? domain ?? "a business")}</h2>
        <table style="font-size:15px;border-collapse:collapse">
          ${row("Website", domain ? esc(domain) : null)}
          ${row("Business", esc(ev.business_name ?? e?.title ?? ""))}
          ${row("Type · area", esc([ev.business_type, ev.area].filter(Boolean).join(" · ")))}
          ${row("AI readiness", ev.readiness_score !== null ? `${ev.readiness_score}/${ev.readiness_max ?? 100}` : "site not scanned")}
          ${row("Mentioned", ev.mentions !== null ? `${ev.mentions}/${ev.mentions_total}` : null)}
          ${row("They gave a phone", ev.phone ? esc(ev.phone) : null)}
          ${row("Published phone", !ev.phone && e?.phones?.length ? esc(e.phones.join(" · ")) : null)}
          ${row("Published email", email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : null)}
          ${row("Published address", e?.address ? esc(e.address) : null)}
          ${row("Arrived via", ev.entry_source ? esc(ev.entry_source) : null)}
        </table>
        ${telLink}
        <p style="margin:18px 0 0;font-size:14px">
          <a href="${env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai")}/admin" style="color:#B8841A;font-weight:600">Open in admin →</a>
        </p>
        <p style="margin:14px 0 0;font-size:12px;color:#999">
          Published details were copied from the business's own pages for a one-off personal follow-up — they carry no marketing consent.
        </p>
      </div>`,
    }),
  });
  await logEmail({
    contactId: ev.contact_id,
    email: to,
    kind: "check_alert",
    subject: `Check run — ${domain ?? "unknown"}`,
    ok: res.ok,
    error: res.ok ? null : `HTTP ${res.status}`,
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
