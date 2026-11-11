import { env } from "@/lib/env";
import { sb, type Lead } from "@/lib/leads";
import { recordEvent } from "@/lib/analytics";
import { logEmail } from "@/lib/admin";
import { getBusiness, updateBusiness, type Business } from "@/lib/businesses";
import { variations, type Variation } from "@/lib/questions";
import { mentions, namesFrom } from "@/lib/match";
import { ask, enabledProviders, estimateProviderCostPence, PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/providers";
import { sendCheckTrouble, sendVisibilityReport } from "@/lib/customerMail";

/* The paid check: every assistant the customer chose, the same five questions
 * as the free check, once a month and on demand.
 *
 * A check is a queued job. Whoever runs it — the hourly cron, the customer's
 * "run now" button via after(), an admin — first claims it with a
 * compare-and-set on status, so two overlapping runners cannot spend the
 * same twenty web searches twice.
 *
 * Same honesty rules as lib/evaluations.ts: a provider we could not ask is
 * recorded as skipped, a question that failed is unavailable, and a run in
 * which nothing answered is a failed job — never "0 of 20". */

export type CheckTrigger = "first" | "scheduled" | "manual" | "admin";
export type CheckStatus = "queued" | "running" | "completed" | "failed" | "abandoned";

export type ProviderTotal = {
  found: number;
  available: number;
  total: number;
  model: string | null;
  skipped?: boolean;
  reason?: string;
};

export type Check = {
  id: string;
  business_id: string;
  trigger: CheckTrigger;
  status: CheckStatus;
  requested_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  runtime_ms: number | null;
  providers: ProviderId[];
  questions: Variation[] | null;
  totals: Partial<Record<ProviderId, ProviderTotal>> | null;
  found_total: number | null;
  answers_total: number | null;
  competitors: string[] | null;
  est_cost_pence: string | number | null;
  failure_reason: string | null;
  report_emailed_at: string | null;
  is_test: boolean;
  created_at: string;
};

export type CheckResult = {
  id: string;
  check_id: string;
  business_id: string;
  provider: ProviderId;
  model: string | null;
  question_id: string;
  question: string | null;
  available: boolean;
  found: boolean;
  answer_text: string | null;
  competitors: string[] | null;
  searches: number | null;
  est_cost_pence: string | number | null;
  error: string | null;
  created_at: string;
};

export const ABANDON_CHECK_AFTER_MS = 10 * 60 * 1000;
export const checkIntervalDays = () => Number(env("CHECK_INTERVAL_DAYS", "30")) || 30;

/* --------------------------------------------------------- queries */

export async function getCheck(id: string): Promise<Check | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sb<Check[]>(`bilabs_checks?id=eq.${id}&limit=1`);
  return rows?.[0] ?? null;
}

export async function getCheckResults(checkId: string): Promise<CheckResult[]> {
  const rows = await sb<CheckResult[]>(`bilabs_check_results?check_id=eq.${checkId}&order=provider.asc,created_at.asc`);
  return rows ?? [];
}

export async function listChecks(businessId: string, limit = 24): Promise<Check[]> {
  const rows = await sb<Check[]>(`bilabs_checks?business_id=eq.${businessId}&order=created_at.desc&limit=${limit}`);
  return rows ?? [];
}

/** A check that is queued or running for this business, if any. */
export async function openCheckFor(businessId: string): Promise<Check | null> {
  const rows = await sb<Check[]>(`bilabs_checks?business_id=eq.${businessId}&status=in.(queued,running)&limit=1`);
  return rows?.[0] ?? null;
}

/* ------------------------------------------------------------ queue */

/** Queue a run. Returns null if one is already queued or running — a second
 *  press of "run now" must not buy a second round of searches. */
export async function enqueueCheck(businessId: string, trigger: CheckTrigger, requestedBy: string | null): Promise<Check | null> {
  const open = await openCheckFor(businessId);
  if (open) return null;
  const business = await getBusiness(businessId);
  if (!business) return null;
  const rows = await sb<Check[]>("bilabs_checks", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ business_id: businessId, trigger, status: "queued", requested_by: requestedBy, is_test: business.is_test }),
  });
  return rows?.[0] ?? null;
}

/** Take ownership of a queued check (the oldest, or a specific one). Only the
 *  caller whose PATCH actually flipped queued→running gets a row back. */
export async function claimQueuedCheck(id?: string): Promise<Check | null> {
  let target = id ?? null;
  if (!target) {
    const next = await sb<{ id: string }[]>("bilabs_checks?status=eq.queued&order=created_at.asc&limit=1&select=id");
    target = next?.[0]?.id ?? null;
  }
  if (!target) return null;
  const rows = await sb<Check[]>(`bilabs_checks?id=eq.${target}&status=eq.queued`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "running", started_at: new Date().toISOString() }),
  });
  return rows?.[0] ?? null;
}

export async function sweepAbandonedChecks(): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDON_CHECK_AFTER_MS).toISOString();
  const rows = await sb<{ id: string }[]>(`bilabs_checks?status=eq.running&started_at=lt.${cutoff}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "abandoned",
      completed_at: new Date().toISOString(),
      failure_reason: "No result reported within 10 minutes — the run did not finish.",
    }),
  });
  return rows?.length ?? 0;
}

/** Queue the monthly run for every live business whose date has come, and
 *  move its date on — even when a run is already open, so a stuck business
 *  is not re-queued on every cron tick. */
export async function scheduleDueBusinesses(): Promise<number> {
  const now = new Date().toISOString();
  const due = await sb<Business[]>(
    `bilabs_businesses?status=in.(live,processing)&next_check_at=lte.${now}&order=next_check_at.asc&limit=50&select=id`,
  );
  let n = 0;
  for (const b of due ?? []) {
    const c = await enqueueCheck(b.id, "scheduled", "cron");
    await updateBusiness(b.id, { next_check_at: nextCheckDate() });
    if (c) n++;
  }
  return n;
}

export function nextCheckDate(from = Date.now()): string {
  return new Date(from + checkIntervalDays() * 24 * 60 * 60 * 1000).toISOString();
}

/* -------------------------------------------------------------- run */

type Row = Omit<CheckResult, "id" | "check_id" | "business_id" | "created_at">;

async function askAll(providers: ProviderId[], questions: Variation[], name: string, website: string): Promise<Row[]> {
  const perProvider = await Promise.all(
    providers.map((p) =>
      Promise.all(
        questions.map(async (q): Promise<Row> => {
          const a = await ask(p, q.question);
          const found = a.ok && ((!!name && mentions(a.text, name)) || (!!website && mentions(a.text, website)));
          return {
            provider: p,
            model: a.model,
            question_id: q.id,
            question: q.question,
            available: a.ok,
            found,
            answer_text: a.ok ? a.text.slice(0, 1400) : null,
            competitors: a.ok ? namesFrom(a.text).slice(0, 6) : [],
            searches: a.searches,
            est_cost_pence: estimateProviderCostPence(p, a.searches),
            error: a.error ?? null,
          };
        }),
      ),
    ),
  );
  return perProvider.flat();
}

async function failCheck(check: Check, reason: string, startedAt: number, patch: Partial<Check> = {}) {
  await sb(`bilabs_checks?id=eq.${check.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ...patch,
      status: "failed",
      completed_at: new Date().toISOString(),
      runtime_ms: Date.now() - startedAt,
      failure_reason: reason.slice(0, 500),
    }),
  });
  /* A failed scheduled run is retried tomorrow, not next month. After two
   * misses in a row the customer is told once, and we keep retrying; the
   * admin is alerted every time. A manual run is the customer's own click
   * and is not rescheduled. */
  const business = await getBusiness(check.business_id);
  const failures = (business?.check_failures ?? 0) + 1;
  const scheduled = check.trigger === "scheduled" || check.trigger === "first";
  const retry = scheduled && business && (business.status === "live" || business.status === "processing");
  await updateBusiness(check.business_id, {
    last_error: reason.slice(0, 300),
    check_failures: failures,
    ...(retry ? { next_check_at: new Date(Date.now() + 86_400_000).toISOString() } : {}),
  });
  if (!check.is_test) await alertCheckFailed(check, reason);

  const notifiedRecently = business?.trouble_notified_at && Date.now() - Date.parse(business.trouble_notified_at) < 7 * 86_400_000;
  if (business && scheduled && failures >= 2 && !check.is_test && !notifiedRecently) {
    const leads = await sb<Lead[]>(`bilabs_leads?id=eq.${business.contact_id}&limit=1`);
    const lead = leads?.[0];
    if (lead?.email && (await sendCheckTrouble(lead, business))) {
      await updateBusiness(business.id, { trouble_notified_at: new Date().toISOString() });
    }
  }
}

/* Did they put our snippets on their own site? A monthly fetch of the
 * homepage, looking for a JSON-LD block with a schema.org local business or
 * our profile URL. It only ever sets the "seen" stamp; a fetch that fails
 * proves nothing and changes nothing. */
export async function detectSnippets(business: Pick<Business, "website" | "slug">): Promise<boolean> {
  const site = (business.website ?? "").trim();
  if (!/^https?:\/\//i.test(site)) return false;
  try {
    const res = await fetch(site, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; BiLabsBot/1.0; +https://bilabs.ai)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const html = (await res.text()).slice(0, 1_500_000);
    if (business.slug && html.includes(`/b/${business.slug}`)) return true;
    const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    return blocks.some((b) => /schema\.org/i.test(b) && /LocalBusiness|openingHoursSpecification|FAQPage|"Dentist"|"Plumber"|"Electrician"|"HairSalon"|"Restaurant"/i.test(b));
  } catch {
    return false;
  }
}

/** Run a check to completion. Idempotent on status: a queued check is claimed
 *  first; a completed one is left alone. Never throws. */
export async function runCheck(checkId: string): Promise<{ ok: boolean; reason?: string }> {
  let check = await getCheck(checkId);
  if (!check) return { ok: false, reason: "not found" };
  if (check.status === "queued") {
    check = await claimQueuedCheck(checkId);
    if (!check) return { ok: false, reason: "claimed by another runner" };
  } else if (check.status !== "running") {
    return { ok: false, reason: `already ${check.status}` };
  }
  const startedAt = check.started_at ? Date.parse(check.started_at) : Date.now();

  try {
    const business = await getBusiness(check.business_id);
    if (!business) {
      await failCheck(check, "Business no longer exists.", startedAt);
      return { ok: false, reason: "no business" };
    }

    const enabled = enabledProviders();
    const targets = business.target_models?.length ? business.target_models : PROVIDER_IDS;
    const providers = targets.filter((p) => enabled.includes(p));
    const skipped = targets.filter((p) => !enabled.includes(p));
    const questions = variations(business.business_type ?? "", business.area ?? "", business.postcode ?? "", business.website ?? "");
    const name = business.name ?? "";
    const website = business.website ?? "";

    const rows = providers.length ? await askAll(providers, questions, name, website) : [];

    if (rows.length) {
      await sb("bilabs_check_results", {
        method: "POST",
        headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
        body: JSON.stringify(rows.map((r) => ({ ...r, check_id: check!.id, business_id: business.id }))),
      });
    }

    const totals: Partial<Record<ProviderId, ProviderTotal>> = {};
    for (const p of providers) {
      const mine = rows.filter((r) => r.provider === p);
      totals[p] = {
        found: mine.filter((r) => r.found).length,
        available: mine.filter((r) => r.available).length,
        total: mine.length,
        model: mine[0]?.model ?? null,
      };
    }
    for (const p of skipped) totals[p] = { found: 0, available: 0, total: 0, model: null, skipped: true, reason: `${PROVIDERS[p].label} is not configured yet` };

    const answersTotal = rows.filter((r) => r.available).length;
    const foundTotal = rows.filter((r) => r.found).length;
    const competitors = Array.from(new Set(rows.flatMap((r) => r.competitors ?? [])))
      .filter((c) => !name || !mentions(c, name))
      .slice(0, 10);
    const cost = Math.round(rows.reduce((n, r) => n + Number(r.est_cost_pence ?? 0), 0) * 10_000) / 10_000;
    const base = { providers, questions, totals, est_cost_pence: cost };

    if (answersTotal === 0) {
      await failCheck(
        check,
        providers.length ? "No assistant returned a usable answer." : "None of the chosen assistants is configured.",
        startedAt,
        base,
      );
      return { ok: false, reason: "no answers" };
    }

    const done = await sb<Check[]>(`bilabs_checks?id=eq.${check.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...base,
        status: "completed",
        completed_at: new Date().toISOString(),
        runtime_ms: Date.now() - startedAt,
        found_total: foundTotal,
        answers_total: answersTotal,
        competitors,
      }),
    });
    const completed = done?.[0] ?? { ...check, ...base, status: "completed" as const, found_total: foundTotal, answers_total: answersTotal, competitors };

    // while we are here: are the snippets on their own site yet?
    const snippetsSeen = business.snippets_seen_at ? true : await detectSnippets(business);
    const now = new Date().toISOString();
    const updatedBusiness =
      (await updateBusiness(business.id, {
        last_check_at: now,
        last_check_id: check.id,
        last_error: null,
        check_failures: 0,
        ...(snippetsSeen && !business.snippets_seen_at ? { snippets_seen_at: now } : {}),
        ...(business.status === "processing" ? { status: "live" } : {}),
      })) ?? business;

    await recordEvent({
      name: "check_completed",
      origin: "server",
      contactId: business.contact_id,
      dedupeKey: `check_completed:${check.id}`,
      props: { trigger: check.trigger, found_total: foundTotal, answers_total: answersTotal, providers },
      isTest: check.is_test,
    });

    /* Everything after the results are safely written is best-effort. */
    try {
      const leads = await sb<Lead[]>(`bilabs_leads?id=eq.${business.contact_id}&limit=1`);
      const lead = leads?.[0];
      if (lead?.email) {
        const sent = await sendVisibilityReport(lead, updatedBusiness, completed, rows.map((r) => ({ ...r, id: "", check_id: check!.id, business_id: business.id, created_at: "" })));
        if (sent) {
          await sb(`bilabs_checks?id=eq.${check.id}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ report_emailed_at: new Date().toISOString() }),
          });
        }
      }
    } catch (e) {
      console.warn("[checks] report email failed:", e);
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[checks] run threw:", msg);
    await failCheck(check, msg, startedAt);
    return { ok: false, reason: msg };
  }
}

/* --------------------------------------------------- admin alert */

async function alertCheckFailed(check: Check, reason: string): Promise<void> {
  const key = env("RESEND_API_KEY");
  if (!key) return;
  const to = env("LEAD_NOTIFY_TO", "hello@bilabs.ai");
  const from = env("LEAD_FROM", "BiLabs <no-reply@yourbotchat.com>");
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Check failed — business ${check.business_id.slice(0, 8)}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px"><h2>A paid check failed</h2><p>${esc(reason)}</p><p>Trigger: ${esc(check.trigger)} · requested by ${esc(check.requested_by ?? "—")}</p><p><a href="${site}/admin" style="color:#B8841A;font-weight:600">Open in admin →</a></p></div>`,
      }),
    });
    await logEmail({ email: to, kind: "check_failed_alert", subject: "Check failed", ok: res.ok, error: res.ok ? null : `HTTP ${res.status}` });
  } catch (e) {
    console.warn("[checks] alert failed:", e);
  }
}
