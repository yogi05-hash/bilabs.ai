import { NextRequest, NextResponse } from "next/server";
import {
  EVENTS,
  VISITOR_COOKIE,
  contextFrom,
  newVisitorKey,
  recordEvent,
  touchVisitor,
} from "@/lib/analytics";
import { getSettings } from "@/lib/admin";
import { markReportViewed } from "@/lib/evaluations";

export const runtime = "nodejs";

/* Browser event ingestion.
 *
 * Everything arriving here is a signal, not a fact: it is whatever a page
 * chose to send, so it is accepted cheaply, marked with its origin, and never
 * used for a financial figure. Completed evaluations and payments are written
 * by server code elsewhere.
 *
 * The visitor id is minted here rather than in the page so it cannot be read
 * or set by script on the client, and so a blocked analytics script simply
 * means no row — never a wrong one.
 */

const ALLOWED = new Set<string>([...EVENTS]);

/* Generous, because a real session legitimately fires a handful of events, but
 * finite so a loop in someone's console cannot fill the table. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, { n: number; resetAt: number }>();
function allow(key: string): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.resetAt) { hits.set(key, { n: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.n >= MAX_PER_WINDOW) return false;
  e.n++; return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.resetAt) hits.delete(k); }, 300_000).unref?.();

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};

export async function POST(req: NextRequest) {
  // A 204 whatever happens: this endpoint must never surface an error into a
  // visitor's console or hold up a page, and an analytics failure is not the
  // visitor's problem.
  const ok = () => new NextResponse(null, { status: 204 });

  try {
    const settings = await getSettings();

    // Honour Do Not Track and Global Privacy Control before anything is stored.
    const dnt = req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1";
    if (settings.respectDnt && dnt) return ok();

    const body = await req.json().catch(() => null);
    const name = str(body?.name, 60);
    if (!name || !ALLOWED.has(name)) return ok();

    const ctx = contextFrom(req, settings.internalIpHashes);
    // Declared crawlers are dropped outright rather than stored and filtered —
    // there is nothing to learn from them and they are most of the noise.
    if (ctx.isBot) return ok();

    if (!allow(ctx.visitorKey ?? ctx.ip ?? "anon")) return ok();

    const path = str(body?.path, 300);
    const referrer = str(body?.referrer, 500);
    const utm = {
      utm_source: str(body?.utm?.utm_source, 80),
      utm_medium: str(body?.utm?.utm_medium, 80),
      utm_campaign: str(body?.utm?.utm_campaign, 120),
      utm_term: str(body?.utm?.utm_term, 120),
      utm_content: str(body?.utm?.utm_content, 120),
    };

    // Mint the id on first contact so the cookie is set by the server.
    let visitorKey = ctx.visitorKey;
    let minted = false;
    if (!visitorKey) {
      visitorKey = newVisitorKey();
      minted = true;
    }

    const { visitor } = await touchVisitor({
      ctx: { ...ctx, visitorKey },
      path,
      referrer,
      utm,
      countPageView: name === "page_view",
    });

    await recordEvent({
      name,
      origin: "browser",
      visitorId: visitor?.id ?? null,
      contactId: visitor?.contact_id ?? null,
      path,
      referrer,
      utm,
      props: typeof body?.props === "object" && body.props ? body.props : {},
      // The client supplies a per-event id so a retried beacon collapses onto
      // the row it already wrote.
      dedupeKey: str(body?.id, 80) ? `b:${str(body?.id, 80)}` : null,
      isInternal: ctx.isInternal,
      isTest: ctx.isTest,
    });

    /* A report view is a browser signal, but it is also a fact about a
     * specific evaluation, so it is mirrored onto that row. Guarded by a uuid
     * test so a crafted body cannot patch arbitrary ids. */
    const evalId = str(body?.props?.evaluationId, 40);
    if (name === "report_viewed" && evalId && /^[0-9a-f-]{36}$/i.test(evalId) && !ctx.isInternal && !ctx.isTest) {
      await markReportViewed(evalId);
    }

    const res = ok();
    if (minted) {
      res.cookies.set(VISITOR_COOKIE, visitorKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (e) {
    console.warn("[track] threw:", e);
    return ok();
  }
}
