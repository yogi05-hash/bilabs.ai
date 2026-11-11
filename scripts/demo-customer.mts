/* Demo customer: a dashboard to look at without paying.
 *
 *   npx tsx --env-file=.env.local scripts/demo-customer.mts create  [email]
 *   npx tsx --env-file=.env.local scripts/demo-customer.mts delete  [email]
 *   npx tsx --env-file=.env.local scripts/demo-customer.mts status  [email]
 *
 * Everything it writes is marked is_test, so it stays out of every admin
 * figure: no bilabs_payments or bilabs_subscriptions rows are created (revenue
 * and MRR are computed only from those and from Stripe), the business and
 * checks are filtered by is_test in the admin, and the profile is noindex and
 * left out of the sitemap. next_check_at is null so the monthly cron never runs
 * a real (paid-for) check on it. `delete` removes the contact, which cascades
 * to the business, its checks and results, and then sweeps the events and
 * email log rows it produced. `create` is idempotent: it deletes first. */

const DEFAULT_EMAIL = "yogivr+bilabs-demo@gmail.com";
const [cmd = "status", emailArg] = process.argv.slice(2);
const EMAIL = (emailArg ?? DEFAULT_EMAIL).trim().toLowerCase();

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!BASE || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");

async function db<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}
const rep = { Prefer: "return=representation" };
const enc = encodeURIComponent;

async function findLead() {
  const rows = await db<{ id: string; is_test: boolean }[]>(`bilabs_leads?email=eq.${enc(EMAIL)}&select=id,is_test`);
  return rows[0] ?? null;
}

async function remove(): Promise<boolean> {
  const lead = await findLead();
  if (!lead) return false;
  if (!lead.is_test) throw new Error(`${EMAIL} exists and is NOT a test contact — refusing to delete it`);
  await db(`bilabs_events?contact_id=eq.${lead.id}`, { method: "DELETE" });
  await db(`bilabs_email_log?or=(contact_id.eq.${lead.id},email.eq.${enc(EMAIL)})`, { method: "DELETE" });
  await db(`bilabs_leads?id=eq.${lead.id}`, { method: "DELETE" }); // cascades business → checks → results
  return true;
}

const PROVIDERS = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  xai: "grok-4-fast",
} as const;
type P = keyof typeof PROVIDERS;

const NAME = "Harbour Lane Dental (Demo)";
const TYPE = "dentist";
const AREA = "Bristol";
const POSTCODE = "BS1 4QA";
const RIVALS = ["Quayside Smiles", "Brunel Street Dental", "Avon Bridge Dentistry", "Kingsdown Tooth Co", "Floating Harbour Dental"];

const QUESTIONS = [
  { id: "direct", label: "Straight recommendation", question: `Recommend a ${TYPE} in ${AREA}. Name up to 6 specific businesses with a one-line reason for each.` },
  { id: "near-me", label: "“Near me” phrasing", question: `I'm in ${AREA} and looking for a good ${TYPE} near me. Which specific ones would you suggest? List up to 6 by name.` },
  { id: "urgent", label: "Urgent need", question: `I need a ${TYPE} in ${AREA} urgently today. Which specific businesses should I contact? List up to 6 by name.` },
  { id: "value", label: "Best / affordable", question: `Who is the best value ${TYPE} in ${AREA}? Name up to 6 specific businesses and say briefly why.` },
  { id: "postcode", label: `Postcode (${POSTCODE})`, question: `Which ${TYPE} businesses serve ${POSTCODE}, ${AREA}? List up to 6 by name.` },
];

/** found[provider] = the question ids where the business is named */
function results(found: Record<P, string[]>) {
  const rows = [];
  for (const p of Object.keys(PROVIDERS) as P[]) {
    for (const [i, q] of QUESTIONS.entries()) {
      const hit = found[p].includes(q.id);
      const names = [RIVALS[i % 5], RIVALS[(i + 1) % 5], RIVALS[(i + 2) % 5]];
      if (hit) names.splice(1, 0, "Harbour Lane Dental");
      rows.push({
        provider: p,
        model: PROVIDERS[p],
        question_id: q.id,
        question: q.question,
        available: true,
        found: hit,
        answer_text:
          `[Sample answer for the demo]\n\nHere are some ${TYPE}s in ${AREA} worth contacting:\n\n` +
          names.map((n, k) => `${k + 1}. **${n}** — ${["well reviewed, central location", "evening and weekend appointments", "emergency slots most days", "clear NHS and private price list"][k % 4]}`).join("\n"),
        competitors: names.filter((n) => n !== "Harbour Lane Dental"),
        searches: 1,
        est_cost_pence: 0,
      });
    }
  }
  return rows;
}

function totals(rows: ReturnType<typeof results>) {
  const t: Record<string, unknown> = {};
  for (const p of Object.keys(PROVIDERS) as P[]) {
    const mine = rows.filter((r) => r.provider === p);
    t[p] = { found: mine.filter((r) => r.found).length, available: mine.length, total: mine.length, model: PROVIDERS[p] };
  }
  return t;
}

async function addCheck(businessId: string, at: Date, trigger: string, found: Record<P, string[]>) {
  const rows = results(found);
  const iso = at.toISOString();
  const [check] = await db<{ id: string }[]>("bilabs_checks", {
    method: "POST", headers: rep,
    body: JSON.stringify({
      business_id: businessId, trigger, status: "completed", requested_by: "demo-script",
      started_at: iso, completed_at: new Date(at.getTime() + 41_000).toISOString(), runtime_ms: 41_000,
      providers: Object.keys(PROVIDERS), questions: QUESTIONS, totals: totals(rows),
      found_total: rows.filter((r) => r.found).length, answers_total: rows.length,
      competitors: RIVALS, est_cost_pence: 0, is_test: true, created_at: iso,
    }),
  });
  await db("bilabs_check_results", {
    method: "POST",
    body: JSON.stringify(rows.map((r) => ({ ...r, check_id: check.id, business_id: businessId, created_at: iso }))),
  });
  return check.id;
}

async function create() {
  if (await remove()) console.log("removed the previous demo first");

  const [lead] = await db<{ id: string }[]>("bilabs_leads", {
    method: "POST", headers: rep,
    body: JSON.stringify({
      email: EMAIL, name: "Demo Customer", company: NAME, source: "demo",
      // not "paid" and no subscription: the business row alone grants dashboard access,
      // and nothing here can be counted as a paying customer
      status: "unsubscribed", pipeline_status: "new", marketing_consent: false, is_test: true,
    }),
  });

  const day = 86_400_000;
  const now = Date.now();
  const [biz] = await db<{ id: string; slug: string }[]>("bilabs_businesses", {
    method: "POST", headers: rep,
    body: JSON.stringify({
      contact_id: lead.id, plan: "get-found", slug: "harbour-lane-dental-demo", name: NAME,
      website: "https://harbour-lane-dental.example", business_type: TYPE, area: AREA, postcode: POSTCODE,
      address: "12 Harbour Lane, Bristol BS1 4QA", phone: "0117 496 0000", email: "hello@harbour-lane-dental.example",
      description:
        "Independent family dental practice on Bristol's harbourside. NHS and private check-ups, hygiene, white fillings, " +
        "Invisalign and same-day emergency appointments. Step-free access and evening clinics on Tuesdays and Thursdays.",
      services: [
        { name: "Check-up and clean", description: "Exam, X-rays if needed, scale and polish", price: "£65" },
        { name: "Emergency appointment", description: "Same-day pain relief, most weekdays", price: "£85" },
        { name: "White fillings", description: "Tooth-coloured composite", price: "from £120" },
        { name: "Invisalign", description: "Clear aligners with free consultation", price: "from £2,800" },
      ],
      hours: [
        { day: "Mon", open: "08:30", close: "17:30", closed: false },
        { day: "Tue", open: "08:30", close: "20:00", closed: false },
        { day: "Wed", open: "08:30", close: "17:30", closed: false },
        { day: "Thu", open: "08:30", close: "20:00", closed: false },
        { day: "Fri", open: "08:30", close: "16:00", closed: false },
        { day: "Sat", open: "09:00", close: "13:00", closed: false },
        { day: "Sun", open: "", close: "", closed: true },
      ],
      faqs: [
        { q: "Do you take new NHS patients?", a: "Yes, for children, and for adults when places open — ask to join the list." },
        { q: "Can I get an emergency appointment today?", a: "Usually. Call from 8:30 and we hold emergency slots every weekday." },
        { q: "Is there parking?", a: "No on-site parking; the Harbourside multi-storey is a two-minute walk." },
      ],
      areas: ["Bristol city centre", "Redcliffe", "Spike Island", "Bedminster"],
      socials: [],
      photos: [],
      target_models: Object.keys(PROVIDERS),
      status: "live", onboarding_step: 3,
      confirmed_at: new Date(now - 35 * day).toISOString(),
      details_completed_at: new Date(now - 35 * day).toISOString(),
      published_at: new Date(now - 35 * day).toISOString(),
      next_check_at: null,
      is_test: true,
      created_at: new Date(now - 35 * day).toISOString(),
    }),
  });

  // first check right after publishing: barely visible
  await addCheck(biz.id, new Date(now - 35 * day), "first", {
    anthropic: ["postcode"], openai: [], gemini: ["direct"], xai: [],
  });
  // a month later: named more often
  const latest = await addCheck(biz.id, new Date(now - 4 * day), "scheduled", {
    anthropic: ["direct", "near-me", "postcode"], openai: ["postcode", "value"], gemini: ["direct", "near-me", "urgent"], xai: ["postcode"],
  });

  await db(`bilabs_businesses?id=eq.${biz.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_check_id: latest, last_check_at: new Date(now - 4 * day).toISOString() }),
  });

  console.log(`created demo customer ${EMAIL}`);
  console.log(`  business ${biz.id}  profile /b/${biz.slug}  (noindex, not in sitemap)`);
  console.log("  2 sample checks × 4 assistants × 5 questions");
}

async function status() {
  const lead = await findLead();
  if (!lead) return console.log(`no demo customer for ${EMAIL}`);
  const biz = await db<{ id: string; slug: string; status: string; is_test: boolean }[]>(
    `bilabs_businesses?contact_id=eq.${lead.id}&select=id,slug,status,is_test`,
  );
  const checks = biz[0] ? await db<{ id: string }[]>(`bilabs_checks?business_id=eq.${biz[0].id}&select=id`) : [];
  const pays = await db<{ id: string }[]>(`bilabs_payments?contact_id=eq.${lead.id}&select=id`);
  console.log({ email: EMAIL, leadIsTest: lead.is_test, business: biz[0] ?? null, checks: checks.length, payments: pays.length });
}

if (cmd === "create") await create();
else if (cmd === "delete") console.log((await remove()) ? `deleted demo customer ${EMAIL}` : `nothing to delete for ${EMAIL}`);
else if (cmd === "status") await status();
else throw new Error(`unknown command "${cmd}" — use create | delete | status`);
