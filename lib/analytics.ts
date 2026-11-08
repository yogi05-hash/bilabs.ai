import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { sb } from "@/lib/leads";

/* First-party analytics.
 *
 * What this is: a random id in a first-party cookie, plus the things the
 * browser sends anyway (path, referrer, UTM tags, a coarse device class, and
 * the country the CDN already put in a header).
 *
 * What this deliberately is not: fingerprinting. Nothing here reads canvas,
 * fonts, screen metrics, audio or any other device characteristic, and no
 * attempt is made to recognise someone across browsers or after they clear
 * the cookie. A visitor stays anonymous until they type an address into a
 * form themselves — we never "discover" an email.
 *
 * Measurement limits, stated plainly because they affect every number on the
 * Visitors page:
 *   - Cookie cleared, private window, or a different browser reads as a new
 *     visitor. Unique-visitor counts are therefore an upper bound.
 *   - Anyone blocking first-party scripts is invisible to this entirely, so
 *     page views undercount. Server-side events (evaluations, payments) do
 *     not have this problem and are counted separately.
 *   - Country comes from the edge's IP geolocation. It is approximate and
 *     absent on local runs.
 *   - Bot filtering is user-agent based. It catches the declared crawlers and
 *     will not catch anything pretending to be Chrome.
 */

export const EVENTS = [
  "page_view",
  "evaluation_started",
  "email_captured",
  "evaluation_completed",
  "evaluation_failed",
  "report_viewed",
  "checkout_started",
  "payment_succeeded",
  "subscription_updated",
  "refund_recorded",
  /* the paid product */
  "dashboard_login",
  "business_onboarded",
  "profile_published",
  "check_completed",
] as const;
export type EventName = (typeof EVENTS)[number];

/* Events only server code may record. A browser beacon claiming a payment
 * succeeded is a signal from a page, not a fact, and /api/track refuses it. */
export const SERVER_ONLY_EVENTS: ReadonlySet<EventName> = new Set<EventName>([
  "evaluation_started",
  "email_captured",
  "evaluation_completed",
  "evaluation_failed",
  "payment_succeeded",
  "subscription_updated",
  "refund_recorded",
  "dashboard_login",
  "business_onboarded",
  "profile_published",
  "check_completed",
]);

export const VISITOR_COOKIE = "bl_vid";

/* Declared crawlers. Honest about its reach: this is a user-agent list, so it
 * removes the well-behaved bots that identify themselves and nothing else. */
const BOT_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegram|discord|preview|headless|lighthouse|pagespeed|gtmetrix|monitor|uptime|curl|wget|python-requests|node-fetch|axios|go-http-client|java\/|okhttp|postman|scrapy|phantomjs|puppeteer|playwright|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|perplexitybot|ccbot|applebot|amazonbot|anthropic/i;

export function isBotUA(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

export function deviceFrom(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Coarse channel from referrer + UTM, used by the Campaigns page. Returns
 *  "direct / unknown" rather than guessing when there is nothing to go on. */
export function channelOf(utmSource: string | null, utmMedium: string | null, referrerHost: string | null): string {
  const s = (utmSource ?? "").toLowerCase();
  const m = (utmMedium ?? "").toLowerCase();
  if (s || m) return `${s || "unknown"} / ${m || "unknown"}`;

  const h = (referrerHost ?? "").toLowerCase();
  if (!h) return "direct / none";
  // Name the engine from the matched label, not the first one: splitting on
  // "." turns news.google.com and www.google.com into "news" and "www".
  const engine = /(?:^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\./.exec(h);
  if (engine) return `${engine[1]} / organic`;
  if (/linkedin/.test(h)) return "linkedin / referral";
  if (/instagram/.test(h)) return "instagram / referral";
  if (/(^|\.)(x|twitter)\.com$/.test(h) || /t\.co$/.test(h)) return "x / referral";
  if (/facebook|fb\.com/.test(h)) return "facebook / referral";
  if (/reddit/.test(h)) return "reddit / referral";
  if (/youtube/.test(h)) return "youtube / referral";
  if (/mail\.|gmail|outlook/.test(h)) return "email / referral";
  return `${h} / referral`;
}

/** IPs are never stored. This is only used to rate-limit and to recognise our
 *  own traffic, so a salted hash is enough and the address itself is not kept. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`bilabs:${ip}`).digest("hex").slice(0, 32);
}

export type Ctx = {
  visitorKey: string | null;
  ua: string;
  ip: string;
  country: string | null;
  isBot: boolean;
  isInternal: boolean;
  isTest: boolean;
};

/** Internal traffic: anyone holding a valid-looking admin cookie, anything on
 *  a non-production host, and any explicitly excluded IP hash. Marked rather
 *  than dropped, so it can still be inspected but never reaches a metric. */
export function contextFrom(req: NextRequest, internalIpHashes: string[] = []): Ctx {
  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const host = req.headers.get("host") ?? "";

  const isPreview = /\.vercel\.app$/i.test(host) || /^localhost|^127\.|^\[::1\]/.test(host);
  const hasAdminCookie = Boolean(req.cookies.get("bl_admin")?.value);

  return {
    visitorKey: req.cookies.get(VISITOR_COOKIE)?.value ?? null,
    ua,
    ip,
    country: req.headers.get("x-vercel-ip-country") ?? null,
    isBot: isBotUA(ua),
    isInternal: hasAdminCookie || (ip ? internalIpHashes.includes(hashIp(ip)) : false),
    isTest: isPreview,
  };
}

export function newVisitorKey(): string {
  return randomUUID();
}

export type VisitorRow = {
  id: string;
  visitor_key: string;
  first_seen_at: string;
  last_seen_at: string;
  visit_count: number;
  page_views: number;
  contact_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
  referrer_host: string | null;
  device: string | null;
  country: string | null;
  is_bot: boolean;
  is_internal: boolean;
  is_test: boolean;
  identified_at: string | null;
  last_path: string | null;
};

/** A visit is "returning" when the gap since we last saw this key exceeds the
 *  session window — the same convention GA uses, stated here so the number on
 *  the dashboard has a definition rather than a vibe. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export async function touchVisitor(input: {
  ctx: Ctx;
  path?: string | null;
  referrer?: string | null;
  utm?: Record<string, string | null>;
  countPageView?: boolean;
}): Promise<{ visitor: VisitorRow | null; isNewVisitor: boolean; isNewSession: boolean }> {
  const { ctx } = input;
  if (!ctx.visitorKey) return { visitor: null, isNewVisitor: false, isNewSession: false };

  const existing = await sb<VisitorRow[]>(
    `bilabs_visitors?visitor_key=eq.${encodeURIComponent(ctx.visitorKey)}&limit=1`,
  );
  const now = new Date();
  const nowIso = now.toISOString();
  const prev = existing?.[0] ?? null;

  if (!prev) {
    const rows = await sb<VisitorRow[]>("bilabs_visitors", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        visitor_key: ctx.visitorKey,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        visit_count: 1,
        page_views: input.countPageView ? 1 : 0,
        landing_path: input.path ?? null,
        landing_referrer: input.referrer ?? null,
        referrer_host: hostOf(input.referrer),
        utm_source: input.utm?.utm_source ?? null,
        utm_medium: input.utm?.utm_medium ?? null,
        utm_campaign: input.utm?.utm_campaign ?? null,
        utm_term: input.utm?.utm_term ?? null,
        utm_content: input.utm?.utm_content ?? null,
        device: deviceFrom(ctx.ua),
        country: ctx.country,
        last_path: input.path ?? null,
        is_bot: ctx.isBot,
        is_internal: ctx.isInternal,
        is_test: ctx.isTest,
      }),
    });
    return { visitor: rows?.[0] ?? null, isNewVisitor: true, isNewSession: true };
  }

  const gap = now.getTime() - new Date(prev.last_seen_at).getTime();
  const isNewSession = gap > SESSION_GAP_MS;

  const patch: Record<string, unknown> = {
    last_seen_at: nowIso,
    last_path: input.path ?? prev.last_path,
  };
  if (input.countPageView) patch.page_views = (prev.page_views ?? 0) + 1;
  if (isNewSession) patch.visit_count = (prev.visit_count ?? 1) + 1;
  // First-touch attribution is written once and never overwritten; a later
  // visit with different UTM tags updates last-touch only (on the contact).
  if (!prev.utm_source && input.utm?.utm_source) {
    patch.utm_source = input.utm.utm_source;
    patch.utm_medium = input.utm.utm_medium ?? null;
    patch.utm_campaign = input.utm.utm_campaign ?? null;
  }

  const rows = await sb<VisitorRow[]>(`bilabs_visitors?id=eq.${prev.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  return { visitor: rows?.[0] ?? prev, isNewVisitor: false, isNewSession };
}

export type EventInput = {
  name: EventName | string;
  visitorId?: string | null;
  contactId?: string | null;
  evaluationId?: string | null;
  origin?: "browser" | "server" | "stripe";
  path?: string | null;
  referrer?: string | null;
  utm?: Record<string, string | null>;
  props?: Record<string, unknown>;
  dedupeKey?: string | null;
  occurredAt?: string;
  isBot?: boolean;
  isInternal?: boolean;
  isTest?: boolean;
};

/** Insert an event. A repeated dedupe_key is a no-op rather than an error, so
 *  a retried beacon or a redelivered webhook cannot inflate a count. */
export async function recordEvent(e: EventInput): Promise<void> {
  const body = {
    name: e.name,
    occurred_at: e.occurredAt ?? new Date().toISOString(),
    visitor_id: e.visitorId ?? null,
    contact_id: e.contactId ?? null,
    evaluation_id: e.evaluationId ?? null,
    origin: e.origin ?? "browser",
    path: e.path ?? null,
    referrer: e.referrer ?? null,
    utm_source: e.utm?.utm_source ?? null,
    utm_medium: e.utm?.utm_medium ?? null,
    utm_campaign: e.utm?.utm_campaign ?? null,
    props: e.props ?? {},
    dedupe_key: e.dedupeKey ?? null,
    is_bot: e.isBot ?? false,
    is_internal: e.isInternal ?? false,
    is_test: e.isTest ?? false,
  };
  /* on_conflict must name the column explicitly: PostgREST resolves conflicts
   * against the PRIMARY KEY unless told otherwise, so without it a repeated
   * dedupe_key raised a 409 and the event was dropped instead of collapsing
   * onto the row it already wrote. ignore-duplicates keeps the first write —
   * the original occurred_at is the true one. Rows with a null dedupe_key are
   * unaffected, since Postgres treats nulls as distinct. */
  await sb("bilabs_events?on_conflict=dedupe_key", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify(body),
  });
}

/** Link a visitor's past and future activity to a contact, once they have
 *  volunteered an address. Prior anonymous events get the contact id too, so
 *  the journey reads end to end — this is backfilling our own first-party
 *  records, not looking anyone up. */
export async function identifyVisitor(visitorId: string, contactId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await sb(`bilabs_visitors?id=eq.${visitorId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ contact_id: contactId, identified_at: nowIso }),
  });
  await sb(`bilabs_events?visitor_id=eq.${visitorId}&contact_id=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ contact_id: contactId }),
  });
  await sb(`bilabs_evaluations?visitor_id=eq.${visitorId}&contact_id=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ contact_id: contactId }),
  });
}

/** Rows excluded from every production metric. */
export const CLEAN = "is_bot=is.false&is_internal=is.false&is_test=is.false";
export const CLEAN_EVAL = "is_test=is.false&is_internal=is.false";
