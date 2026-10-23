import { env } from "@/lib/env";

/* One lead per email address, however they arrived.
 *
 * Everything funnels through upsertLead so a person who runs the free check,
 * then fills in the contact form, then pays, is one row with a history —
 * rather than three rows and three different ideas of who they are.
 *
 * Two rules the rest of the system depends on:
 *   - Consent is never inferred. marketing_consent only becomes true when
 *     someone ticks the box, and it is never silently turned back on.
 *   - Status only moves forward into terminal states. A paid or unsubscribed
 *     lead is never dragged back into nurturing by a later form submission.
 */

export type LeadStatus = "new" | "nurturing" | "paid" | "unsubscribed" | "lost";

export type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  business_type: string | null;
  area: string | null;
  company: string | null;
  source: string | null;
  mentions: number | null;
  mentions_total: number | null;
  readiness_score: number | null;
  marketing_consent: boolean;
  consent_at: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  last_emailed_at: string | null;
  nurture_step: number;
  notes: string | null;
  report: unknown;
  stripe_customer_id: string | null;
  unsubscribe_token: string;
  message: string | null;
  /* Added by the dashboard migration. `pipeline_status` is the sales stage
   * and is a separate axis from `status`, which the nurture cron owns —
   * "unsubscribed" is a marketing preference, not a stage of a conversation. */
  pipeline_status: "new" | "contacted" | "interested" | "customer" | "closed";
  owner: string | null;
  next_follow_up_at: string | null;
  first_source: string | null;
  last_source: string | null;
  first_utm: Record<string, string> | null;
  last_utm: Record<string, string> | null;
  first_seen_at: string | null;
  visitor_id: string | null;
  /** set on the losing row of a merge; it is hidden, not deleted */
  merged_into: string | null;
  is_test: boolean;
};

const URL_BASE = () => env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const KEY = () => env("SUPABASE_SERVICE_ROLE_KEY");

function headers(extra: Record<string, string> = {}) {
  const k = KEY();
  return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra };
}

/* Every database call gets a deadline.
 *
 * Without one a stalled socket hangs the caller until the OS gives up: a
 * dropped connection held a request open for over half an hour in testing and
 * wedged the server's fetch pool with it. Fifteen seconds is far beyond a
 * healthy PostgREST response, and a timeout returns null — which every caller
 * already treats as "unknown" rather than "empty". */
const DB_TIMEOUT_MS = 15_000;

export async function sb<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const base = URL_BASE();
  if (!base || !KEY()) return null;
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers(), ...(init?.headers as Record<string, string>) },
      cache: "no-store",
      signal: AbortSignal.timeout(DB_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[leads]", path, res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ([] as unknown as T);
  } catch (e) {
    console.error("[leads] threw:", e);
    return null;
  }
}

/** Terminal states are never overwritten by a later touch. */
const TERMINAL: LeadStatus[] = ["paid", "unsubscribed", "lost"];

export async function getLeadByEmail(email: string): Promise<Lead | null> {
  const rows = await sb<Lead[]>(`bilabs_leads?email=ilike.${encodeURIComponent(email)}&limit=1`);
  return rows?.[0] ?? null;
}

export async function logEvent(leadId: string, kind: string, detail?: string) {
  await sb("bilabs_lead_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ lead_id: leadId, kind, detail: detail ?? null }),
  });
}

export type LeadInput = {
  email: string;
  name?: string | null;
  phone?: string | null;
  website?: string | null;
  business_type?: string | null;
  area?: string | null;
  company?: string | null;
  source: string;
  mentions?: number | null;
  mentions_total?: number | null;
  readiness_score?: number | null;
  marketing_consent?: boolean;
  report?: unknown;
  message?: string | null;
};

export async function upsertLead(input: LeadInput): Promise<Lead | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;

  const existing = await getLeadByEmail(email);
  const now = new Date().toISOString();

  // Only fill a field when we actually learned something — a later contact
  // form with no website must not wipe the website the check captured.
  const keep = <T>(next: T | null | undefined, prev: T | null | undefined) =>
    next === undefined || next === null || next === "" ? prev ?? null : next;

  const consentNow = input.marketing_consent === true;
  const consented = existing?.marketing_consent === true || consentNow;

  const body: Record<string, unknown> = {
    email,
    name: keep(input.name, existing?.name),
    phone: keep(input.phone, existing?.phone),
    website: keep(input.website, existing?.website),
    business_type: keep(input.business_type, existing?.business_type),
    area: keep(input.area, existing?.area),
    company: keep(input.company, existing?.company),
    source: existing?.source ?? input.source,
    mentions: keep(input.mentions, existing?.mentions),
    mentions_total: keep(input.mentions_total, existing?.mentions_total),
    readiness_score: keep(input.readiness_score, existing?.readiness_score),
    message: keep(input.message, existing?.message),
    report: input.report ?? existing?.report ?? null,
    marketing_consent: consented,
    updated_at: now,
  };

  if (consentNow && !existing?.marketing_consent) body.consent_at = now;

  // never resurrect a paid / unsubscribed / lost lead
  if (!existing) body.status = consented ? "nurturing" : "new";
  else if (!TERMINAL.includes(existing.status)) body.status = consented ? "nurturing" : existing.status;

  if (existing) {
    const rows = await sb<Lead[]>(`bilabs_leads?id=eq.${existing.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    const lead = rows?.[0] ?? null;
    if (lead) await logEvent(lead.id, "touch", `${input.source}${consentNow ? " · consent given" : ""}`);
    return lead;
  }

  const rows = await sb<Lead[]>("bilabs_leads", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const lead = rows?.[0] ?? null;
  if (lead) await logEvent(lead.id, "created", input.source);
  return lead;
}

export async function setStatus(id: string, status: LeadStatus, detail?: string) {
  await sb(`bilabs_leads?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  await logEvent(id, `status:${status}`, detail);
}

export function unsubscribeUrl(lead: { id: string; unsubscribe_token: string }) {
  const site = env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
  return `${site}/api/unsubscribe?id=${lead.id}&t=${lead.unsubscribe_token}`;
}

/* ------------------------- the instant alert ------------------------ */

export async function alertNewLead(lead: Lead, kind: string) {
  const key = env("RESEND_API_KEY");
  if (!key) return;
  const to = env("LEAD_NOTIFY_TO", "hello@bilabs.ai");
  const from = env("LEAD_FROM", "BiLabs <no-reply@yourbotchat.com>");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (k: string, v: unknown) =>
    v === null || v === undefined || v === ""
      ? ""
      : `<tr><td style="padding:6px 16px 6px 0;color:#888">${k}</td><td style="font-weight:600">${esc(String(v))}</td></tr>`;

  const score = lead.readiness_score;
  const mentions = lead.mentions !== null && lead.mentions_total !== null ? `${lead.mentions}/${lead.mentions_total}` : null;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: lead.email ?? undefined,
        subject: `New ${kind} lead — ${lead.company || lead.name || lead.email}${score !== null ? ` (${score}/100)` : ""}`,
        html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
          <h2 style="margin:0 0 14px">New ${esc(kind)} lead</h2>
          <table style="font-size:15px;border-collapse:collapse">
            ${row("Name", lead.name)}
            ${row("Email", lead.email)}
            ${row("Website", lead.website)}
            ${row("Business", lead.company)}
            ${row("Type", lead.business_type)}
            ${row("Area", lead.area)}
            ${row("AI readiness", score !== null ? `${score}/100` : null)}
            ${row("Mentioned", mentions)}
            ${row("Marketing consent", lead.marketing_consent ? "yes" : "no")}
            ${row("Status", lead.status)}
          </table>
          <p style="margin:18px 0 0;font-size:14px">
            <a href="${env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai")}/admin" style="color:#B8841A;font-weight:600">Open in admin →</a>
          </p>
        </div>`,
      }),
    });
    await logEvent(lead.id, "alert", kind);
  } catch (e) {
    console.warn("[leads] alert failed:", e);
  }
}
