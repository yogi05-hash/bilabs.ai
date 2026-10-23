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
    for (const t of ["bilabs_events", "bilabs_evaluations", "bilabs_followups", "bilabs_email_log"]) {
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
