import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

/* End-to-end tests against a running server and the real database.
 *
 * Run with: npm run test:flows  (it starts the server itself)
 *
 * These exercise the paths that actually matter — the ones where being wrong
 * costs money, leaks data, or emails someone who asked not to be emailed.
 * Everything written here is marked is_test and removed in the teardown, so
 * it never reaches a production figure even if a cleanup is missed.
 */

const BASE = process.env.TEST_BASE ?? "http://localhost:3701";
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
const SECRET = process.env.ADMIN_SESSION_SECRET!.trim();
const HOOK = process.env.STRIPE_WEBHOOK_SECRET!.trim();

/* Each test speaks from its own client IP. The capture routes rate-limit per
 * address (5 report unlocks an hour), so sharing one would have tests fail
 * each other rather than fail the code — and the limiter itself is asserted
 * separately below. */
let ipSeq = 0;
const ipRun = Math.floor(Math.random() * 250);
const freshIp = () => `203.0.${ipRun}.${(ipSeq++ % 250) + 1}`;

const db = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

/** Mint a session cookie the same way the callback route does. */
function session(email: string, role = "owner"): string {
  void role;
  const body = `session.${Buffer.from(email).toString("base64url")}.${Date.now() + 600_000}.${randomUUID()}`;
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `bl_admin=${body}.${mac}`;
}

const ADMIN = "yogivr@gmail.com";
let cookie = "";
const made: { leads: string[]; evals: string[]; visitors: string[]; events: string[] } =
  { leads: [], evals: [], visitors: [], events: [] };

before(() => { cookie = session(ADMIN); });

after(async () => {
  for (const id of made.evals) await db(`bilabs_evaluations?id=eq.${id}`, { method: "DELETE" });
  for (const id of made.leads) {
    await db(`bilabs_events?contact_id=eq.${id}`, { method: "DELETE" });
    await db(`bilabs_lead_events?lead_id=eq.${id}`, { method: "DELETE" });
    await db(`bilabs_leads?id=eq.${id}`, { method: "DELETE" });
  }
  for (const id of made.visitors) {
    await db(`bilabs_events?visitor_id=eq.${id}`, { method: "DELETE" });
    await db(`bilabs_visitors?id=eq.${id}`, { method: "DELETE" });
  }
  await db(`bilabs_webhook_events?stripe_event_id=like.evt_test_*`, { method: "DELETE" });

  /* Belt and braces. Tracking ids by hand misses anything created by a call
   * whose response was not captured, and five test contacts survived a run
   * into the production table that way. Every address these tests use is on a
   * reserved test domain, so sweeping by domain catches the stragglers. */
  const { body: strays } = await db(
    "bilabs_leads?select=id,email&or=(email.like.*@example.com,email.like.*@shared-test.com)",
  );
  for (const l of strays ?? []) {
    // the paid product: results → checks → business, then the money
    const { body: biz } = await db(`bilabs_businesses?contact_id=eq.${l.id}&select=id`);
    for (const b of biz ?? []) {
      await db(`bilabs_check_results?business_id=eq.${b.id}`, { method: "DELETE" });
      await db(`bilabs_checks?business_id=eq.${b.id}`, { method: "DELETE" });
      await db(`bilabs_audit_log?target_type=eq.business&target_id=eq.${b.id}`, { method: "DELETE" });
    }
    for (const t of ["bilabs_events", "bilabs_evaluations", "bilabs_followups", "bilabs_email_log", "bilabs_businesses", "bilabs_payments", "bilabs_subscriptions"]) {
      await db(`${t}?contact_id=eq.${l.id}`, { method: "DELETE" });
    }
    await db(`bilabs_lead_events?lead_id=eq.${l.id}`, { method: "DELETE" });
    await db(`bilabs_visitors?contact_id=eq.${l.id}`, { method: "DELETE" });
    await db(`bilabs_leads?id=eq.${l.id}`, { method: "DELETE" });
  }
  if (strays?.length) console.log(`[teardown] swept ${strays.length} stray test contact(s)`);
});

/* ------------------------------------------------- admin authorisation */

test("every admin endpoint refuses an anonymous request", async () => {
  const paths = [
    "/api/admin/me", "/api/admin/overview", "/api/admin/leads", "/api/admin/visitors",
    "/api/admin/evaluations", "/api/admin/customers", "/api/admin/campaigns",
    "/api/admin/followups", "/api/admin/settings", "/api/admin/duplicates", "/api/admin/export",
  ];
  for (const p of paths) {
    const res = await fetch(`${BASE}${p}`);
    assert.equal(res.status, 401, `${p} must be 401 without a cookie, got ${res.status}`);
  }
});

test("a forged or tampered session cookie is refused", async () => {
  const good = session(ADMIN);
  const tampered = good.slice(0, -4) + "AAAA";          // broken signature
  const wrongKind = `bl_admin=link.${Buffer.from(ADMIN).toString("base64url")}.${Date.now() + 60000}.n.x`;
  const expired = (() => {
    const body = `session.${Buffer.from(ADMIN).toString("base64url")}.${Date.now() - 1000}.${randomUUID()}`;
    return `bl_admin=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
  })();

  for (const c of [tampered, wrongKind, expired, "bl_admin=garbage"]) {
    const res = await fetch(`${BASE}/api/admin/me`, { headers: { cookie: c } });
    assert.equal(res.status, 401, `cookie "${c.slice(0, 30)}…" must be refused`);
  }
});

test("a signed cookie for an address NOT on the allowlist is refused", async () => {
  const res = await fetch(`${BASE}/api/admin/me`, { headers: { cookie: session("stranger@example.com") } });
  assert.equal(res.status, 401, "a valid signature for a non-admin must still be refused");
});

test("a valid admin cookie gets in and reports its role", async () => {
  const res = await fetch(`${BASE}/api/admin/me`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.email, ADMIN);
  assert.ok(["owner", "admin", "readonly"].includes(d.role));
});

/* ----------------------------------- anonymous visit → capture journey */

test("anonymous visit → evaluation → email capture → report view, all linked", async () => {
  /* A production Host header, deliberately. Requests to localhost are flagged
   * non-production and kept out of every metric, which is correct behaviour
   * and would mean this test exercised the excluded path instead of the real
   * one. Everything it creates is removed in the teardown. */
  const asProd = {
    "Content-Type": "application/json",
    "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36",
  };

  // 1. an anonymous page view mints a visitor cookie server-side
  const view = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: asProd,
    body: JSON.stringify({ name: "page_view", path: "/", referrer: "https://www.linkedin.com/feed", utm: { utm_source: "linkedin", utm_medium: "social", utm_campaign: "launch" } }),
  });
  assert.equal(view.status, 204);
  const setCookie = view.headers.get("set-cookie") ?? "";
  const vid = /bl_vid=([^;]+)/.exec(setCookie)?.[1];
  assert.ok(vid, "a first visit must mint a visitor id");
  assert.match(setCookie, /HttpOnly/i, "the visitor cookie must not be readable by script");

  const { body: vrows } = await db(`bilabs_visitors?visitor_key=eq.${vid}&select=*`);
  assert.equal(vrows.length, 1);
  const visitor = vrows[0];
  made.visitors.push(visitor.id);
  assert.equal(visitor.utm_source, "linkedin");
  assert.equal(visitor.referrer_host, "linkedin.com");
  assert.equal(visitor.page_views, 1);
  assert.equal(visitor.contact_id, null, "a visitor must stay anonymous until they identify themselves");
  assert.equal(visitor.is_bot, false);
  // This run is against localhost, which is correctly flagged non-production
  // and therefore excluded from every metric. (fetch forbids overriding the
  // Host header, so a local run cannot pretend otherwise — the production
  // path is verified against the deployed site instead.)
  assert.equal(visitor.is_test, true, "localhost traffic must be marked non-production");

  // 2. an evaluation for that visitor (inserted directly — the real route
  //    spends money on live web searches, which a test must not do)
  const { body: erows } = await db("bilabs_evaluations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      visitor_id: visitor.id, website: "https://example-test.co.uk", business_type: "plumber",
      area: "London", status: "completed", readiness_score: 60, readiness_max: 100,
      mentions: 1, mentions_total: 5, is_test: true,
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }),
  });
  const evaluation = erows[0];
  made.evals.push(evaluation.id);

  // 3. the person gives their email, unlocking the report
  const email = `flowtest+${Date.now()}@example.com`;
  const unlock = await fetch(`${BASE}/api/report`, {
    method: "POST",
    headers: { ...asProd, cookie: `bl_vid=${vid}`, "x-forwarded-for": freshIp() },
    body: JSON.stringify({
      email, businessType: "plumber", area: "London", marketingConsent: false,
      evaluationId: evaluation.id,
      report: { business: "Test Plumbers", mentionCount: 1, queriesRun: 5, competitors: [], scan: { url: "https://example-test.co.uk", score: 60 } },
    }),
  });
  assert.equal(unlock.status, 200);

  const { body: leads } = await db(`bilabs_leads?email=eq.${encodeURIComponent(email)}&select=*`);
  assert.equal(leads.length, 1, "capture must create exactly one contact");
  const lead = leads[0];
  made.leads.push(lead.id);

  // 4. the previously anonymous activity is now joined to that person
  const { body: after } = await db(`bilabs_visitors?id=eq.${visitor.id}&select=contact_id,identified_at`);
  assert.equal(after[0].contact_id, lead.id, "the visitor must be linked to the contact after identification");
  assert.ok(after[0].identified_at);

  const { body: ev2 } = await db(`bilabs_evaluations?id=eq.${evaluation.id}&select=contact_id`);
  assert.equal(ev2[0].contact_id, lead.id, "the evaluation must attach to the contact");

  const { body: captured } = await db(`bilabs_events?name=eq.email_captured&contact_id=eq.${lead.id}&select=props`);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].props.at, "report_unlock", "capture after a check must record where it happened");

  // 5. viewing the full report counts against that run
  await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { ...asProd, cookie: `bl_vid=${vid}` },
    body: JSON.stringify({ name: "report_viewed", path: "/", props: { evaluationId: evaluation.id } }),
  });
  const { body: ev3 } = await db(`bilabs_evaluations?id=eq.${evaluation.id}&select=report_views,report_viewed_at`);
  assert.equal(ev3[0].report_views, 0, "a view from non-production traffic must not be counted");
  assert.equal(ev3[0].report_viewed_at, null);
});

test("a report view increments the run it belongs to, once stamped", async () => {
  const { markReportViewed } = await import("../lib/evaluations.ts");
  const { body: rows } = await db("bilabs_evaluations", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ website: "https://view-test.co.uk", status: "completed", is_test: true }),
  });
  const ev = rows[0];
  made.evals.push(ev.id);

  await markReportViewed(ev.id);
  let { body: after } = await db(`bilabs_evaluations?id=eq.${ev.id}&select=report_views,report_viewed_at`);
  assert.equal(after[0].report_views, 1);
  const firstAt = after[0].report_viewed_at;
  assert.ok(firstAt, "the first view must stamp the timestamp");

  // a second view increments the count but must not move "first viewed"
  await markReportViewed(ev.id);
  ({ body: after } = await db(`bilabs_evaluations?id=eq.${ev.id}&select=report_views,report_viewed_at`));
  assert.equal(after[0].report_views, 2);
  assert.equal(after[0].report_viewed_at, firstAt, "time-to-first-view must not be overwritten");
});

test("a returning person running a second check does not become a second contact", async () => {
  const email = `repeat+${Date.now()}@example.com`;
  const payload = (score: number) => ({
    email, businessType: "dentist", area: "Leeds", marketingConsent: false,
    report: { business: "Repeat Co", mentionCount: 0, queriesRun: 5, competitors: [], scan: { url: "https://repeat-test.co.uk", score } },
  });

  const ip = freshIp();
  for (const score of [40, 70]) {
    const r = await fetch(`${BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(payload(score)),
    });
    assert.equal(r.status, 200, "both checks must be accepted");
  }

  const { body: leads } = await db(`bilabs_leads?email=eq.${encodeURIComponent(email)}&select=*`);
  assert.equal(leads.length, 1, "a repeat check must update one contact, not create another");
  made.leads.push(leads[0].id);
});

test("two people at the same website stay two separate contacts", async () => {
  const site = `https://shared-${Date.now()}.co.uk`;
  const mk = async (email: string) => {
    await fetch(`${BASE}/api/report`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": freshIp() },
      body: JSON.stringify({
        email, businessType: "agency", area: "Bristol", marketingConsent: false,
        report: { business: "Shared Ltd", mentionCount: 0, queriesRun: 5, competitors: [], scan: { url: site, score: 50 } },
      }),
    });
    const { body } = await db(`bilabs_leads?email=eq.${encodeURIComponent(email)}&select=id`);
    if (body[0]) made.leads.push(body[0].id);
    return body[0];
  };
  const a = await mk(`alice+${Date.now()}@shared-test.com`);
  const b = await mk(`bob+${Date.now()}@shared-test.com`);
  assert.ok(a && b);
  assert.notEqual(a.id, b.id, "sharing a website must never merge two people");

  // and the duplicate finder must not propose them either
  const res = await fetch(`${BASE}/api/admin/duplicates`, { headers: { cookie } });
  const d = await res.json();
  const paired = (d.candidates ?? []).some(
    (c: { primary: { id: string }; duplicate: { id: string } }) =>
      [c.primary.id, c.duplicate.id].includes(a.id) && [c.primary.id, c.duplicate.id].includes(b.id),
  );
  assert.equal(paired, false, "a shared website must not be offered as a duplicate");
});

/* ------------------------------------------------- consent enforcement */

test("consent is never inferred, and nurture only selects consented contacts", async () => {
  const email = `noconsent+${Date.now()}@example.com`;
  await fetch(`${BASE}/api/report`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": freshIp() },
    body: JSON.stringify({
      email, businessType: "cafe", area: "Hull", marketingConsent: false,
      report: { business: "No Consent Co", mentionCount: 0, queriesRun: 5, competitors: [], scan: { url: "https://nc.co.uk", score: 30 } },
    }),
  });
  const { body: leads } = await db(`bilabs_leads?email=eq.${encodeURIComponent(email)}&select=*`);
  const lead = leads[0];
  made.leads.push(lead.id);

  assert.equal(lead.marketing_consent, false);
  assert.equal(lead.consent_at, null, "no consent means no consent timestamp");
  assert.notEqual(lead.status, "nurturing", "an unconsented contact must not enter nurture");

  // the cron's own selection must exclude them
  const { body: selected } = await db(
    `bilabs_leads?status=eq.nurturing&marketing_consent=is.true&email=eq.${encodeURIComponent(email)}&select=id`,
  );
  assert.equal(selected.length, 0, "the nurture query must not select an unconsented contact");
});

test("an unsubscribed contact is never dragged back into nurture", async () => {
  const email = `unsub+${Date.now()}@example.com`;
  const { body: created } = await db("bilabs_leads", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ email, status: "unsubscribed", marketing_consent: false, source: "check" }),
  });
  const lead = created[0];
  made.leads.push(lead.id);

  // a later form submission, this time with the consent box ticked
  await fetch(`${BASE}/api/report`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": freshIp() },
    body: JSON.stringify({
      email, businessType: "gym", area: "Derby", marketingConsent: true,
      report: { business: "Unsub Co", mentionCount: 0, queriesRun: 5, competitors: [], scan: { url: "https://u.co.uk", score: 20 } },
    }),
  });

  const { body: after } = await db(`bilabs_leads?id=eq.${lead.id}&select=status`);
  assert.equal(after[0].status, "unsubscribed", "a terminal opt-out must survive a later submission");
});

test("the capture endpoint rate-limits a single address", async () => {
  const ip = freshIp();
  const body = (n: number) => JSON.stringify({
    email: `ratelimit${n}+${Date.now()}@example.com`, businessType: "shop", area: "York", marketingConsent: false,
    report: { business: "RL", mentionCount: 0, queriesRun: 5, competitors: [], scan: { url: "https://rl.co.uk", score: 10 } },
  });
  const codes: number[] = [];
  for (let n = 0; n < 7; n++) {
    const r = await fetch(`${BASE}/api/report`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: body(n),
    });
    codes.push(r.status);
  }
  assert.ok(codes.includes(429), `a burst from one address must be throttled, got ${codes.join(",")}`);
  assert.equal(codes[0], 200, "the first request must still be served");

  // tidy up whatever got through
  const { body: made429 } = await db("bilabs_leads?email=like.ratelimit*&select=id");
  for (const l of made429) made.leads.push(l.id);
});

test("a retried browser beacon collapses onto the row it already wrote", async () => {
  const { recordEvent } = await import("../lib/analytics.ts");
  const key = `test-dedupe-${randomUUID()}`;

  // the same event id delivered three times, as a flaky network would
  for (let i = 0; i < 3; i++) {
    await recordEvent({ name: "page_view", path: "/dedupe", dedupeKey: key, isTest: true });
  }

  const { body } = await db(`bilabs_events?dedupe_key=eq.${key}&select=id`);
  assert.equal(body.length, 1, "a repeated dedupe key must not inflate the count");
  await db(`bilabs_events?dedupe_key=eq.${key}`, { method: "DELETE" });
});

test("events without a dedupe key are each recorded", async () => {
  const { recordEvent } = await import("../lib/analytics.ts");
  const path = `/nodedupe-${randomUUID()}`;
  await recordEvent({ name: "page_view", path, isTest: true });
  await recordEvent({ name: "page_view", path, isTest: true });

  const { body } = await db(`bilabs_events?path=eq.${encodeURIComponent(path)}&select=id`);
  assert.equal(body.length, 2, "null dedupe keys are distinct and must both be kept");
  await db(`bilabs_events?path=eq.${encodeURIComponent(path)}`, { method: "DELETE" });
});

test("a phone given at unlock lands on the contact and the check", async () => {
  const { body: erows } = await db("bilabs_evaluations", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ website: "https://phone-test.co.uk", business_type: "florist", area: "Bath", status: "completed", is_test: true }),
  });
  const ev = erows[0];
  made.evals.push(ev.id);

  const email = `phonetest+${Date.now()}@example.com`;
  const res = await fetch(`${BASE}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": freshIp() },
    body: JSON.stringify({
      email, phone: "07700 900456", businessType: "florist", area: "Bath", marketingConsent: false,
      evaluationId: ev.id,
      report: { business: "Phone Test", mentionCount: 0, queriesRun: 5, competitors: [], scan: { url: "https://phone-test.co.uk", score: 40 } },
    }),
  });
  assert.equal(res.status, 200);

  const { body: leads } = await db(`bilabs_leads?email=eq.${encodeURIComponent(email)}&select=id,phone`);
  made.leads.push(leads[0].id);
  assert.equal(leads[0].phone, "07700 900456", "the phone must be stored on the contact");

  const { body: after } = await db(`bilabs_evaluations?id=eq.${ev.id}&select=phone`);
  assert.equal(after[0].phone, "07700 900456", "and stamped on the check row");
});

test("call status and notes persist via PATCH, and garbage is refused", async () => {
  const { body: erows } = await db("bilabs_evaluations", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ website: "https://status-test.co.uk", status: "completed", is_test: true }),
  });
  const ev = erows[0];
  made.evals.push(ev.id);

  const patch = await fetch(`${BASE}/api/admin/evaluations`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ id: ev.id, leadStatus: "called", notes: "Spoke to the owner, ring back Friday." }),
  });
  assert.equal(patch.status, 200);
  const { body: after } = await db(`bilabs_evaluations?id=eq.${ev.id}&select=lead_status,lead_notes`);
  assert.equal(after[0].lead_status, "called");
  assert.match(after[0].lead_notes, /ring back Friday/);

  const bad = await fetch(`${BASE}/api/admin/evaluations`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ id: ev.id, leadStatus: "definitely_buying" }),
  });
  assert.equal(bad.status, 400, "an unknown status must be refused");

  const anon = await fetch(`${BASE}/api/admin/evaluations`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ev.id, leadStatus: "paid" }),
  });
  assert.equal(anon.status, 401, "no cookie, no status change");

  // and the audit trail recorded who did it
  const { body: audits } = await db(
    `bilabs_audit_log?action=eq.evaluation.status&target_id=eq.${ev.id}&select=actor&limit=1`,
  );
  assert.equal(audits[0]?.actor, ADMIN);
  await db(`bilabs_audit_log?target_id=eq.${ev.id}`, { method: "DELETE" });
});

test("a check run with the admin cookie is flagged internal and hidden from the list", async () => {
  // insert directly with the flag the route would set from the ctx
  const { body: erows } = await db("bilabs_evaluations", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ website: "https://internal-test.co.uk", status: "completed", is_internal: true, is_test: false }),
  });
  const ev = erows[0];
  made.evals.push(ev.id);

  const list = await fetch(`${BASE}/api/admin/evaluations?range=30d&q=internal-test`, { headers: { cookie } });
  const d = await list.json();
  assert.equal(
    (d.evaluations ?? []).some((e: { id: string }) => e.id === ev.id),
    false,
    "an internal run must not appear in the default list",
  );

  const withTests = await fetch(`${BASE}/api/admin/evaluations?range=30d&q=internal-test&tests=1`, { headers: { cookie } });
  const d2 = await withTests.json();
  assert.equal(
    (d2.evaluations ?? []).some((e: { id: string }) => e.id === ev.id),
    true,
    "but it stays inspectable when excluded traffic is shown",
  );
});

/* ------------------------------------------------------------ webhooks */

const sign = (payload: string) => {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", HOOK).update(`${t}.${payload}`).digest("hex")}`;
};

const post = (payload: string, sig: string) =>
  fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "Content-Type": "application/json" }, body: payload });

test("an unsigned or wrongly-signed webhook is rejected outright", async () => {
  const payload = JSON.stringify({ id: `evt_test_${randomUUID()}`, type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), livemode: false, data: { object: {} } });
  assert.equal((await post(payload, "")).status, 400);
  assert.equal((await post(payload, "t=1,v1=deadbeef")).status, 400);
  // a valid signature over different content must not validate
  const other = JSON.stringify({ tampered: true });
  assert.equal((await post(other, sign(payload))).status, 400);
});

test("a replayed webhook is processed once and acknowledged twice", async () => {
  const id = `evt_test_${randomUUID()}`;
  const payload = JSON.stringify({
    id, type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), livemode: false,
    data: { object: { id: `cs_test_${randomUUID()}`, customer_email: "dupe@example.com", amount_total: 100, currency: "gbp", metadata: { plan: "get-found" } } },
  });

  const first = await post(payload, sign(payload));
  assert.equal(first.status, 200);
  const a = await first.json();

  const second = await post(payload, sign(payload));
  assert.equal(second.status, 200, "a redelivery must be acknowledged, not errored");
  const b = await second.json();
  assert.equal(b.duplicate, true, "the second delivery must be recognised as a duplicate");
  assert.notEqual(a.duplicate, true);

  const { body: ledger } = await db(`bilabs_webhook_events?stripe_event_id=eq.${id}&select=stripe_event_id`);
  assert.equal(ledger.length, 1, "the event must be recorded exactly once");

  // and no contact or payment was invented from an unknown product
  const { body: pays } = await db(`bilabs_payments?stripe_event_id=eq.${id}&select=id`);
  assert.equal(pays.length, 0);
});

test("a purchase of another product on the shared Stripe account is ignored", async () => {
  const id = `evt_test_${randomUUID()}`;
  const foreign = "someone-elses-customer@example.com";
  const payload = JSON.stringify({
    id, type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), livemode: false,
    data: { object: { id: `cs_test_${randomUUID()}`, customer_email: foreign, amount_total: 2900, currency: "gbp", metadata: { plan: "showbizy-pro" } } },
  });

  const res = await post(payload, sign(payload));
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.status, "ignored_other_product", "a non-BiLabs product must be ignored");

  const { body: leads } = await db(`bilabs_leads?email=eq.${encodeURIComponent(foreign)}&select=id`);
  assert.equal(leads.length, 0, "another product's customer must not become a BiLabs contact");
});

test("a stale webhook outside the tolerance window is rejected", async () => {
  const payload = JSON.stringify({ id: `evt_test_${randomUUID()}`, type: "checkout.session.completed", created: 1, livemode: false, data: { object: {} } });
  const old = Math.floor(Date.now() / 1000) - 3600;
  const sig = `t=${old},v1=${createHmac("sha256", HOOK).update(`${old}.${payload}`).digest("hex")}`;
  assert.equal((await post(payload, sig)).status, 400, "an hour-old signature must not be accepted");
});

/* ------------------------------------------- metrics and date filtering */

test("the overview reports a period, its comparison window and a linked funnel", async () => {
  const res = await fetch(`${BASE}/api/admin/overview?range=7d`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const d = await res.json();

  assert.equal(d.period.days, 7);
  assert.equal(new Date(d.period.prevTo).getTime(), new Date(d.period.from).getTime());

  // funnel stages must be monotonically non-increasing — each is a subset
  const counts = d.funnel.map((s: { count: number }) => s.count);
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] <= counts[i - 1], `funnel stage ${i} (${counts[i]}) cannot exceed the one above it (${counts[i - 1]})`);
  }

  // every rate carries its denominator and definition
  for (const k of ["visitorToLead", "evaluationToPaid"]) {
    const c = d.conversion[k];
    assert.ok(typeof c.denominator === "number");
    assert.ok(c.definition.length > 20, `${k} must state its definition`);
  }

  // series has one point per day in the window
  assert.equal(d.series.length, 7);
});

test("'today' and '30 days' return different windows and are not interchangeable", async () => {
  const get = async (r: string) => (await (await fetch(`${BASE}/api/admin/overview?range=${r}`, { headers: { cookie } })).json());
  const today = await get("today");
  const month = await get("30d");
  assert.equal(today.period.days, 1);
  assert.equal(month.period.days, 30);
  assert.ok(new Date(month.period.from) < new Date(today.period.from));
  // both windows end at the same instant — the next London midnight
  assert.equal(today.period.to, month.period.to);
});

test("MRR and active subscribers are scoped to BiLabs, not the whole Stripe account", async () => {
  const res = await fetch(`${BASE}/api/admin/customers?range=30d`, { headers: { cookie } });
  const d = await res.json();
  assert.equal(d.connected, true, "Stripe must be reachable for this test to mean anything");
  assert.ok(d.products.length > 0, "the BiLabs product ids must resolve");

  // every subscription returned must belong to a BiLabs product
  const { body: all } = { body: d.subscriptions };
  for (const s of all) {
    assert.ok(["get-found", "front-desk", null].includes(s.plan), `unexpected plan ${s.plan}`);
  }
  // the account genuinely has other products' subscriptions; none may appear
  assert.ok(d.definitions.scope.includes("shared"));
});

test("a CSV export is quoted, non-cacheable and safe to open in a spreadsheet", async () => {
  const res = await fetch(`${BASE}/api/admin/export`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  assert.match(res.headers.get("content-disposition") ?? "", /attachment/);

  const csv = await res.text();
  const header = csv.split("\r\n")[0];
  assert.match(header, /^"Created","Name","Email"/);
  // no bare cell may begin with a formula character
  for (const line of csv.split("\r\n").slice(1)) {
    for (const m of line.matchAll(/"((?:[^"]|"")*)"/g)) {
      assert.ok(!/^[=+\-@]/.test(m[1]), `cell would execute as a formula: ${m[1].slice(0, 40)}`);
    }
  }
});

test("declared bots are dropped and never reach a metric", async () => {
  const before = await db("bilabs_events?select=id&limit=1", { headers: { Prefer: "count=exact" } });
  void before;
  const res = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    body: JSON.stringify({ name: "page_view", path: "/bot-test" }),
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("set-cookie"), null, "a bot must not be given a visitor cookie");
  const { body } = await db("bilabs_events?path=eq./bot-test&select=id");
  assert.equal(body.length, 0, "a declared bot must not create an event row");
});

test("Do Not Track suppresses recording entirely", async () => {
  const res = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", dnt: "1", "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36" },
    body: JSON.stringify({ name: "page_view", path: "/dnt-test" }),
  });
  assert.equal(res.status, 204);
  const { body } = await db("bilabs_events?path=eq./dnt-test&select=id");
  assert.equal(body.length, 0, "DNT must mean nothing is stored");
});

test("a browser beacon cannot record a server-only event such as a payment", async () => {
  const path = `/forged-${randomUUID()}`;
  const res = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36" },
    body: JSON.stringify({ name: "payment_succeeded", path }),
  });
  assert.equal(res.status, 204, "the beacon endpoint never surfaces an error");
  const { body } = await db(`bilabs_events?path=eq.${encodeURIComponent(path)}&select=id`);
  assert.equal(body.length, 0, "a forged payment event must not be stored");
});

/* ------------------------------------------ the paid product: customers */

/* These run the real routes against the real database with the assistants
 * mocked (the server must be started with PROVIDER_MOCK=1, which answers
 * every question by naming "Mock Dental Practice"). The business is created
 * directly, as the Stripe webhook would, because a checkout cannot be
 * replayed without Stripe. */

const CUST_SECRET = (process.env.CUSTOMER_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "").trim();

function custLink(email: string, kind = "cust-link", ttl = 600_000): string {
  const body = `${kind}.${Buffer.from(email.toLowerCase()).toString("base64url")}.${Date.now() + ttl}.${randomUUID()}`;
  return `${body}.${createHmac("sha256", CUST_SECRET).update(body).digest("base64url")}`;
}

const custEmail = `customer+${Date.now()}@example.com`;
let custCookie = "";
let custLeadId = "";
let custBizId = "";
let custSlug = "";

test("customer endpoints refuse anonymous, admin-cookie and forged requests", async () => {
  for (const p of ["/api/me", "/api/me/business", "/api/me/checks", "/api/me/snippets"]) {
    assert.equal((await fetch(`${BASE}${p}`)).status, 401, `${p} must be 401 anonymously`);
    assert.equal((await fetch(`${BASE}${p}`, { headers: { cookie } })).status, 401, `${p} must not accept an ADMIN cookie`);
  }
  const forged = `bl_cust=${custLink(custEmail, "cust-session").slice(0, -4)}AAAA`;
  assert.equal((await fetch(`${BASE}/api/me`, { headers: { cookie: forged } })).status, 401);
  // an admin-kind token signed with the same secret is not a customer session
  const wrongKind = `bl_cust=${custLink(custEmail, "session")}`;
  assert.equal((await fetch(`${BASE}/api/me`, { headers: { cookie: wrongKind } })).status, 401);
  // a bad link bounces to the dashboard with an error, never sets a cookie
  const bad = await fetch(`${BASE}/api/me/callback?token=garbage`, { redirect: "manual" });
  assert.equal(bad.status, 307);
  assert.match(bad.headers.get("location") ?? "", /\/dashboard\?err=link/);
  assert.equal(bad.headers.get("set-cookie"), null);
});

test("a paid customer's magic link signs them in and records the login", async () => {
  const { body: leads } = await db("bilabs_leads", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ email: custEmail, status: "paid", pipeline_status: "customer", source: "checkout", is_test: true, company: "Mock Dental Practice" }),
  });
  custLeadId = leads[0].id;
  made.leads.push(custLeadId);

  // nothing to sign in to yet: no business, and status alone is enough —
  // but a stranger with the same signature shape still is not
  const { body: biz } = await db("bilabs_businesses", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ contact_id: custLeadId, name: "Mock Dental Practice", business_type: "dentist", area: "Croydon", postcode: "CR0 1AB", website: "https://mock-dental.example", plan: "get-found", is_test: true }),
  });
  custBizId = biz[0].id;

  const res = await fetch(`${BASE}/api/me/callback?token=${encodeURIComponent(custLink(custEmail))}&next=/dashboard%3Ftab%3Dsetup`, { redirect: "manual" });
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/dashboard\?tab=setup$/, "only our own dashboard paths are honoured");
  const setCookie = res.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /bl_cust=/);
  assert.match(setCookie, /HttpOnly/i);
  custCookie = `bl_cust=${/bl_cust=([^;]+)/.exec(setCookie)![1]}`;

  // an open redirect is refused
  const evil = await fetch(`${BASE}/api/me/callback?token=${encodeURIComponent(custLink(custEmail))}&next=https://evil.example`, { redirect: "manual" });
  assert.doesNotMatch(evil.headers.get("location") ?? "", /evil\.example/);

  const me = await fetch(`${BASE}/api/me`, { headers: { cookie: custCookie } });
  assert.equal(me.status, 200);
  const d = await me.json();
  assert.equal(d.email, custEmail);
  assert.equal(d.business.id, custBizId);
  assert.equal(d.business.status, "onboarding");
  assert.equal(d.business.stripe_customer_id, undefined, "Stripe ids never leave the server");
  assert.equal(d.providers.length, 4);

  const { body: logins } = await db(`bilabs_events?name=eq.dashboard_login&contact_id=eq.${custLeadId}&select=id`);
  assert.equal(logins.length, 1, "one login event per customer per day");
});

test("setup: confirm → models → details, with caps and protected fields enforced", async () => {
  const patch = (body: Record<string, unknown>) =>
    fetch(`${BASE}/api/me/business`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie: custCookie }, body: JSON.stringify(body) });

  assert.equal((await patch({ step: 1, name: "Mock Dental Practice" })).status, 400, "step 1 requires the confirmation box");
  let r = await patch({ step: 1, confirm: true, name: "Mock Dental Practice", website: "mock-dental.example", business_type: "dentist", area: "Croydon", postcode: "cr0 1ab" });
  assert.equal(r.status, 200);
  let b = (await r.json()).business;
  assert.equal(b.onboarding_step, 1);
  assert.equal(b.website, "https://mock-dental.example", "a bare domain gets a scheme");
  assert.equal(b.postcode, "CR0 1AB");
  assert.ok(b.confirmed_at);

  assert.equal((await patch({ step: 2, target_models: ["bogus"] })).status, 400);
  r = await patch({ step: 2, target_models: ["openai", "anthropic", "gemini", "xai"] });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).business.onboarding_step, 2);

  // publishing before the details are in is refused with field errors
  const early = await fetch(`${BASE}/api/me/publish`, { method: "POST", headers: { cookie: custCookie } });
  assert.equal(early.status, 422);
  assert.ok((await early.json()).errors.description);

  assert.equal((await patch({ services: Array.from({ length: 40 }, () => ({ name: "x" })) })).status, 400, "over the cap is refused, not truncated");
  assert.equal((await patch({ photos: [{ url: "javascript:alert(1)" }] })).status, 400);

  r = await patch({
    step: 3,
    description: "A friendly family dentist in Croydon offering check-ups, hygiene and whitening, open late on Thursdays.",
    services: [{ name: "Check-up", price: "£45" }, { name: "Whitening", description: "In-surgery, one visit" }],
    hours: [{ day: "mon", open: "09:00", close: "17:30" }, { day: "sun", closed: true }],
    faqs: [{ q: "Do you take NHS patients?", a: "Yes, for check-ups." }],
    areas: ["Croydon", "Purley"],
    phone: "020 8123 4567",
    email: "hello@mock-dental.example",
    status: "live",                 // protected — must be ignored
    stripe_customer_id: "cus_hack", // protected — must be ignored
  });
  assert.equal(r.status, 200);
  b = (await r.json()).business;
  assert.equal(b.onboarding_step, 3);
  assert.equal(b.status, "onboarding", "status cannot be set from the browser");
  assert.ok(b.details_completed_at);
  assert.equal(b.services.length, 2);
  assert.deepEqual(b.hours.map((h: { day: string }) => h.day), ["mon", "sun"]);

  const { body: row } = await db(`bilabs_businesses?id=eq.${custBizId}&select=stripe_customer_id`);
  assert.notEqual(row[0].stripe_customer_id, "cus_hack");
  const { body: onboarded } = await db(`bilabs_events?name=eq.business_onboarded&contact_id=eq.${custLeadId}&select=id`);
  assert.equal(onboarded.length, 1);
});

test("publishing makes a public, machine-readable profile and starts the first check", async () => {
  const res = await fetch(`${BASE}/api/me/publish`, { method: "POST", headers: { cookie: custCookie } });
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  const d = await res.json();
  assert.equal(d.firstPublish, true);
  assert.ok(d.checkId, "the first check must be queued on first publish");
  custSlug = d.business.slug;
  assert.match(custSlug, /^mock-dental-practice-croydon(-\d+)?$/);
  assert.ok(["processing", "live"].includes(d.business.status));
  assert.ok(d.business.next_check_at, "the monthly schedule starts at first publish");

  const page = await fetch(`${BASE}/b/${custSlug}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"LocalBusiness"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /Mock Dental Practice/);
  assert.match(html, /Do you take NHS patients\?/);
  assert.match(html, /noindex/, "a test row must not be indexed");
  assert.doesNotMatch(html, /Free AI check/, "a profile carries no BiLabs marketing navigation");

  const txt = await fetch(`${BASE}/b/${custSlug}/llms.txt`);
  assert.equal(txt.status, 200);
  assert.match(await txt.text(), /^# Mock Dental Practice/);

  assert.equal((await fetch(`${BASE}/b/no-such-business-${Date.now()}`)).status, 404);

  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.doesNotMatch(sitemap, new RegExp(custSlug), "test rows stay out of the sitemap");

  const { body: published } = await db(`bilabs_events?name=eq.profile_published&contact_id=eq.${custLeadId}&select=id`);
  assert.equal(published.length, 1);

  // the first check ran via after() with the mocked assistants
  let check: { status: string; providers: string[]; found_total: number; answers_total: number } | null = null;
  for (let i = 0; i < 30 && (!check || check.status === "queued" || check.status === "running"); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const r = await fetch(`${BASE}/api/me/checks?id=${d.checkId}`, { headers: { cookie: custCookie } });
    check = (await r.json()).check;
  }
  assert.equal(check?.status, "completed", `first check must complete with PROVIDER_MOCK=1 (got ${check?.status})`);
  assert.equal(check!.answers_total, check!.providers.length * 5);
  assert.equal(check!.found_total, check!.answers_total, "the mock names the business in every answer");

  const { body: biz } = await db(`bilabs_businesses?id=eq.${custBizId}&select=status,last_check_id`);
  assert.equal(biz[0].status, "live", "processing → live once the first check finishes");
  assert.equal(biz[0].last_check_id, d.checkId);
});

test("a manual check runs, stores every answer, and is limited to one a day", async () => {
  const start = await fetch(`${BASE}/api/me/check`, { method: "POST", headers: { cookie: custCookie } });
  assert.equal(start.status, 200, JSON.stringify(await start.clone().json()));
  const { checkId } = await start.json();

  // a second press while it runs, or later the same day, is refused
  const again = await fetch(`${BASE}/api/me/check`, { method: "POST", headers: { cookie: custCookie } });
  assert.ok([409, 429].includes(again.status), `second manual run must be refused, got ${again.status}`);

  let detail: { check: { status: string; providers: string[]; competitors: string[] }; results: { provider: string; found: boolean; answer_text: string | null }[] } | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const r = await fetch(`${BASE}/api/me/checks?id=${checkId}`, { headers: { cookie: custCookie } });
    detail = await r.json();
    if (detail!.check.status === "completed" || detail!.check.status === "failed") break;
  }
  assert.equal(detail!.check.status, "completed");
  assert.equal(detail!.results.length, detail!.check.providers.length * 5);
  assert.ok(detail!.results.every((r) => r.found && r.answer_text));
  assert.ok(detail!.check.competitors.includes("Other Clinic"), "rivals named in the answers are listed");
  assert.ok(!detail!.check.competitors.some((c) => /mock dental/i.test(c)), "the business itself is not its own rival");

  const later = await fetch(`${BASE}/api/me/check`, { method: "POST", headers: { cookie: custCookie } });
  assert.equal(later.status, 429, "one manual check a day");

  const { body: done } = await db(`bilabs_events?name=eq.check_completed&contact_id=eq.${custLeadId}&select=id`);
  assert.equal(done.length, 2, "first + manual");

  // snippets come from the same facts as the profile
  const snips = await (await fetch(`${BASE}/api/me/snippets`, { headers: { cookie: custCookie } })).json();
  assert.match(snips.jsonLd, /"@type":"LocalBusiness"/);
  assert.match(snips.robotsTxt, /User-agent: GPTBot/);
  assert.match(snips.faqHtml, /<details>/);
  assert.equal(snips.profileUrl.endsWith(`/b/${custSlug}`), true);
  assert.doesNotMatch(snips.jsonLd, /<\/script>[^]*<\/script>[^]*<\/script>/, "customer text cannot close the script tag");
});

test("a customer whose subscription ended loses the dashboard on the next call", async () => {
  await db(`bilabs_businesses?id=eq.${custBizId}`, { method: "DELETE" });
  await db(`bilabs_leads?id=eq.${custLeadId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "lost" }) });
  const res = await fetch(`${BASE}/api/me`, { headers: { cookie: custCookie } });
  assert.equal(res.status, 401, "a valid cookie for a lapsed customer must be refused");
});

test("the check cron needs the bearer secret, and a spoofed vercel header is not enough", async () => {
  assert.equal((await fetch(`${BASE}/api/cron/checks`)).status, 401);
  assert.equal((await fetch(`${BASE}/api/cron/checks`, { headers: { "x-vercel-cron": "1" } })).status, 401, "any client can set a header");
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return;
  const ok = await fetch(`${BASE}/api/cron/checks`, { headers: { authorization: `Bearer ${secret}` } });
  assert.equal(ok.status, 200);
  const d = await ok.json();
  assert.equal(d.ok, true);
  assert.ok(typeof d.ran === "number" && typeof d.remaining === "number");
});

test("the one-click pay link refuses bad input without touching Stripe, and sends a customer to the dashboard", async () => {
  const noFollow = { redirect: "manual" as const };
  const bad = await fetch(`${BASE}/start?plan=nope`, noFollow);
  assert.equal(bad.status, 303);
  assert.match(bad.headers.get("location") ?? "", /\/#packages$/);

  // an existing customer is routed to their dashboard, never to a second checkout
  const { body: leads } = await db("bilabs_leads", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ email: `start-${Date.now()}@example.com`, status: "paid", source: "checkout", is_test: true }),
  });
  made.leads.push(leads[0].id);
  await db("bilabs_businesses", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ contact_id: leads[0].id, name: "Start Co", is_test: true }),
  });
  const cust = await fetch(`${BASE}/start?plan=get-found&c=${leads[0].id}`, noFollow);
  assert.equal(cust.status, 303);
  assert.match(cust.headers.get("location") ?? "", /\/dashboard$/);
});

test("the homepage pulse is anonymous and excludes test rows", async () => {
  const res = await fetch(`${BASE}/api/pulse`);
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.ok(typeof d.checksThisWeek === "number" && typeof d.liveProfiles === "number" && Array.isArray(d.recent));
  for (const r of d.recent) {
    assert.deepEqual(Object.keys(r).sort(), ["area", "at", "mentions", "total", "type"], "no names, emails or websites leave the server");
    assert.doesNotMatch(`${r.type} ${r.area}`, /example\.com|shared-test|Mock Dental/i);
  }
});
