import { env } from "@/lib/env";
import type { Lead } from "@/lib/leads";
import { logEmail } from "@/lib/admin";
import type { Business } from "@/lib/businesses";
import type { Check, CheckResult } from "@/lib/checks";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { customerLoginUrl } from "@/lib/customerAuth";

/* Email to paying customers.
 *
 * These are transactional — a sign-in link, "you're live", the monthly report
 * — so they carry no marketing unsubscribe. Someone who no longer wants them
 * manages that in their dashboard, which is where the subscription lives. */

const SITE = () => env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Reserved domains the flow tests use. Never actually sent to. */
export const isTestAddress = (email: string) => /@(example\.(com|org|net)|shared-test\.com)$/i.test(email.trim());

export function wrapTransactional(body: string): string {
  const site = SITE();
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;font-size:15px;line-height:1.65;color:#111">
${body}
<p style="margin:22px 0 0">Yogi<br><span style="color:#777;font-size:13px">BiLabs · bilabs.ai</span></p>
<p style="margin:26px 0 0;font-size:12px;color:#999">
  You're receiving this because you have a BiLabs subscription. Manage it, or pause these reports, in
  <a href="${site}/dashboard" style="color:#999">your dashboard</a>.
</p>
</div>`;
}

export async function sendCustomerMail(
  to: string,
  mail: { subject: string; html: string },
  kind: string,
  contactId: string | null,
): Promise<boolean> {
  if (isTestAddress(to)) {
    console.log(`[customerMail] skipped ${kind} to reserved test address`);
    return true;
  }
  const key = env("RESEND_API_KEY");
  if (!key) return false;
  let ok = false;
  let error: string | null = null;
  let resendId: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("CUSTOMER_FROM") || env("NURTURE_FROM", "Yogi at BiLabs <no-reply@yourbotchat.com>"),
        to: [to],
        reply_to: env("LEAD_NOTIFY_TO", "hello@bilabs.ai"),
        subject: mail.subject,
        html: mail.html,
      }),
    });
    ok = res.ok;
    if (ok) {
      const j = (await res.json().catch(() => null)) as { id?: string } | null;
      resendId = j?.id ?? null;
    } else {
      error = `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
      console.warn("[customerMail] resend", error);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn("[customerMail] send threw:", error);
  }
  await logEmail({ contactId, email: to, kind, subject: mail.subject, resendId, ok, error });
  return ok;
}

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#F5B731;color:#1a1205;padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none">${label}</a></p>`;

const hi = (lead: Lead | null) => `<p>Hi${lead?.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>`;

export async function sendDashboardLink(email: string, url: string, contactId: string | null): Promise<boolean> {
  return sendCustomerMail(
    email,
    {
      subject: "Your BiLabs dashboard sign-in link",
      html: wrapTransactional(
        `<h2 style="margin:0 0 12px">Sign in to your dashboard</h2>
<p style="margin:0 0 6px">This link works for 15 minutes.</p>
${button(url, "Open my dashboard")}
<p style="margin:20px 0 0;font-size:12.5px;color:#888">If you did not ask for this, ignore it — nothing happens until the link is opened.</p>`,
      ),
    },
    "customer_link",
    contactId,
  );
}

export async function sendLive(lead: Lead, business: Business): Promise<boolean> {
  if (!lead.email) return false;
  const site = SITE();
  const profile = `${site}/b/${business.slug}`;
  return sendCustomerMail(
    lead.email,
    {
      subject: `${business.name ?? "Your business"} is live for AI search`,
      html: wrapTransactional(
        `${hi(lead)}
<p>${esc(business.name ?? "Your business")} is published. Your profile, with your services, hours, prices and FAQ, is now at a stable address that AI web search can read, and we've told the search index it's there.</p>
<p><a href="${profile}" style="color:#B8841A">${esc(profile.replace(/^https?:\/\//, ""))}</a></p>
<p><strong>What happens next</strong></p>
<ol style="padding-left:18px">
  <li style="margin-bottom:8px">Your first check is running now — ${business.target_models.map((p) => PROVIDERS[p].label).join(", ")} are each being asked the five questions. The result lands in your dashboard and your inbox within a few minutes.</li>
  <li style="margin-bottom:8px">Add the snippets from your dashboard to your own website — the same facts, on your own domain, where assistants look first.</li>
  <li style="margin-bottom:8px">Every month we ask again and send you what changed.</li>
</ol>
${button(`${site}/dashboard`, "Open my dashboard")}
<p style="color:#555;font-size:13.5px">Assistants pick up new pages on their own schedule — days to a few weeks is normal. The monthly checks are how you'll see it happen.</p>`,
      ),
    },
    "live",
    lead.id,
  );
}

const month = (iso: string | null) =>
  new Date(iso ?? Date.now()).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });

export async function sendVisibilityReport(lead: Lead, business: Business, check: Check, results: CheckResult[]): Promise<boolean> {
  if (!lead.email) return false;
  const site = SITE();
  const name = business.name ?? "your business";
  const providers = (check.providers ?? []) as ProviderId[];
  const totals = check.totals ?? {};
  const questions = check.questions ?? [];

  const providerLines = (Object.keys(totals) as ProviderId[])
    .map((p) => {
      const t = totals[p]!;
      if (t.skipped) return `<li style="margin-bottom:6px"><strong>${esc(PROVIDERS[p].label)}</strong> · not checked — ${esc(t.reason ?? "not available")}</li>`;
      if (t.available === 0) return `<li style="margin-bottom:6px"><strong>${esc(PROVIDERS[p].label)}</strong> · could not be reached this time</li>`;
      return `<li style="margin-bottom:6px"><strong>${esc(PROVIDERS[p].label)}</strong> · named you in <strong>${t.found} of ${t.available}</strong>${t.available < t.total ? ` (${t.total - t.available} could not run)` : ""}</li>`;
    })
    .join("");

  const cell = (p: ProviderId, qid: string) => {
    const r = results.find((x) => x.provider === p && x.question_id === qid);
    if (!r || !r.available) return "—";
    return r.found ? "✅" : "❌";
  };
  const table = questions.length && providers.length
    ? `<table style="border-collapse:collapse;font-size:13.5px;margin:12px 0">
<tr><th style="text-align:left;padding:6px 10px 6px 0;color:#777;font-weight:600">Question</th>${providers.map((p) => `<th style="padding:6px 8px;color:#777;font-weight:600">${esc(PROVIDERS[p].label)}</th>`).join("")}</tr>
${questions.map((q) => `<tr><td style="padding:5px 10px 5px 0;border-top:1px solid #eee">${esc(q.label)}</td>${providers.map((p) => `<td style="padding:5px 8px;border-top:1px solid #eee;text-align:center">${cell(p, q.id)}</td>`).join("")}</tr>`).join("")}
</table>`
    : "";

  const competitors = (check.competitors ?? []).slice(0, 8);

  /* The report is not just a score; it says what to do about it. Each line
   * is a fact we checked — not advice padded in. */
  const next: string[] = [];
  const host = (business.website ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (business.website && !business.snippets_seen_at) {
    next.push(`Add the snippets to <strong>${esc(host)}</strong>. We looked at your site this time and could not find them yet. They are in your dashboard under “For your site”, ready to paste — your own domain is where assistants look first.`);
  }
  if (!(business.photos?.length)) next.push("Add a photo or two to your profile. A page with images is picked up and shown more readily.");
  if ((business.faqs?.length ?? 0) < 3) next.push("Add at least three FAQs — the exact questions customers ask are what assistants match on.");
  if ((check.found_total ?? 0) === 0 && check.trigger !== "scheduled") {
    next.push("Early days: assistants pick up a new page over days to a few weeks. Next month's check is the first real reading.");
  }
  const nextHtml = next.length
    ? `<p style="margin:18px 0 6px"><strong>Do this next</strong></p><ol style="padding-left:18px;margin:0">${next.slice(0, 3).map((t) => `<li style="margin-bottom:8px">${t}</li>`).join("")}</ol>`
    : `<p style="margin:18px 0 0"><strong>Nothing to do this month.</strong> Your profile, snippets, photos and FAQ are all in place; the rest is the assistants' schedule, which is what the monthly check watches.</p>`;

  return sendCustomerMail(
    lead.email,
    {
      subject: `${name} — AI visibility, ${month(check.completed_at)}`,
      html: wrapTransactional(
        `${hi(lead)}
<p>Here is what the assistants said about ${esc(name)} this ${check.trigger === "scheduled" ? "month" : "time"}. Across every answer we got, you were named in <strong>${check.found_total ?? 0} of ${check.answers_total ?? 0}</strong>.</p>
<ul style="padding-left:18px">${providerLines}</ul>
${table}
${competitors.length ? `<p><strong>Named instead or alongside you:</strong> ${competitors.map(esc).join(" · ")}</p>` : ""}
${nextHtml}
${button(`${site}/dashboard`, "See the full answers")}
<p style="color:#555;font-size:13.5px">Five questions per assistant, one moment in time — not a ranking. Answers shift as sources change, which is why we ask every month rather than once.</p>`,
      ),
    },
    "visibility_report",
    lead.id,
  );
}

/* ----------------------------------------------- the platform chasing */

const STEP_NAMES = [
  "confirm your business details",
  "choose which assistants to monitor",
  "add your services, hours, prices and FAQ, then press Publish",
];

/** Paid but not published. Four of these, days 1/3/7/14, each with a fresh
 *  sign-in link and the exact step they stopped at. */
export async function sendSetupReminder(lead: Lead, business: Business, n: number): Promise<boolean> {
  if (!lead.email) return false;
  const name = business.name ?? "your business";
  const step = Math.min(Math.max(business.onboarding_step ?? 0, 0), 2);
  const left = 3 - step;
  const nextStep = STEP_NAMES[step];
  const link = customerLoginUrl(lead.email);
  const i = Math.min(Math.max(n, 1), 4) - 1;
  const subjects = [
    `${name} isn't live yet — ${left} short step${left === 1 ? "" : "s"} to go`,
    `AI search still can't read ${name}`,
    `Five minutes and ${name} is published`,
    `Last reminder: ${name} is still unpublished`,
  ];
  const intros = [
    `You started setting up ${esc(name)} and stopped at “${nextStep}”. Nothing is published until you press Publish, and nothing is checked — so right now your subscription is buying you nothing.`,
    `Quick nudge. Your subscription is running but ${esc(name)} still isn't published, so the assistants have nothing new to read about you.`,
    `Your profile is ${left} step${left === 1 ? "" : "s"} from live. The free check that brought you here already filled in most of it.`,
    `This is the last reminder we'll send. ${esc(name)} is still unpublished, and you're paying for a profile that isn't up yet. If you've changed your mind, Billing in your dashboard cancels in one click — no questions.`,
  ];
  return sendCustomerMail(
    lead.email,
    {
      subject: subjects[i],
      html: wrapTransactional(
        `${hi(lead)}
<p>${intros[i]}</p>
<p><strong>Next step:</strong> ${nextStep}. About ${left === 3 ? "five" : "two or three"} minutes.</p>
${button(link, "Finish setting up →")}
<p style="color:#555;font-size:13px">That button signs you in and is good for 15 minutes. After that, enter your email at <a href="${SITE()}/dashboard" style="color:#B8841A">${SITE().replace(/^https?:\/\//, "")}/dashboard</a> and we'll send a fresh one.</p>
<p style="color:#555;font-size:13.5px">The moment you press Publish: your profile goes up, the search index is told, and the first check across your chosen assistants runs straight away. Everything after that is automatic.</p>`,
      ),
    },
    "setup_reminder",
    lead.id,
  );
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;

/** A renewal was declined. Stripe retries on its own; this tells them why
 *  the profile may pause and how to stop that in one minute. */
export async function sendPaymentFailed(lead: Lead, business: Business | null, amountPence: number): Promise<boolean> {
  if (!lead.email) return false;
  const name = business?.name ?? "your business";
  return sendCustomerMail(
    lead.email,
    {
      subject: `Your BiLabs payment didn't go through`,
      html: wrapTransactional(
        `${hi(lead)}
<p>We tried to take this month's ${amountPence ? pounds(amountPence) : "payment"} for ${esc(name)} and the card was declined. That happens — expired cards, a new one issued, a limit.</p>
<p>Stripe will retry automatically over the next few days. To keep ${esc(name)} live without a gap, update the card now — it takes a minute in Billing.</p>
${button(`${SITE()}/dashboard`, "Update my card")}
<p style="color:#555;font-size:13.5px">If payment keeps failing, your profile is paused — not deleted — and the monthly checks stop. It all comes straight back the moment a payment succeeds.</p>`,
      ),
    },
    "payment_failed",
    lead.id,
  );
}

/** Billing lapsed and the profile has been paused. */
export async function sendPaused(lead: Lead, business: Business): Promise<boolean> {
  if (!lead.email) return false;
  const name = business.name ?? "your business";
  const profile = business.slug ? `${SITE()}/b/${business.slug}` : null;
  return sendCustomerMail(
    lead.email,
    {
      subject: `${name} has been paused`,
      html: wrapTransactional(
        `${hi(lead)}
<p>We couldn't collect payment for ${esc(name)}, so the monthly checks have stopped${profile ? ` and your profile at <a href="${profile}" style="color:#B8841A">${esc(profile.replace(/^https?:\/\//, ""))}</a> is paused` : ""}.</p>
<p>Nothing has been deleted. Update your card and everything resumes on its own — profile, checks, reports.</p>
${button(`${SITE()}/dashboard`, "Update my card")}
<p style="color:#555;font-size:13.5px">If you meant to stop, you don't need to do anything else.</p>`,
      ),
    },
    "paused",
    lead.id,
  );
}

/** Payment succeeded after a pause; the profile is live again. */
export async function sendRestored(lead: Lead, business: Business): Promise<boolean> {
  if (!lead.email) return false;
  const name = business.name ?? "your business";
  return sendCustomerMail(
    lead.email,
    {
      subject: `${name} is back`,
      html: wrapTransactional(
        `${hi(lead)}
<p>Payment received — thank you. ${esc(name)} is ${business.published_at ? "live again and the monthly checks resume on schedule" : "active again; finish the setup and we'll publish it"}.</p>
${button(`${SITE()}/dashboard`, "Open my dashboard")}`,
      ),
    },
    "restored",
    lead.id,
  );
}

/** Two scheduled checks in a row returned nothing usable. We keep retrying
 *  daily; this just says so, so a quiet month is never a mystery. */
export async function sendCheckTrouble(lead: Lead, business: Business): Promise<boolean> {
  if (!lead.email) return false;
  const name = business.name ?? "your business";
  return sendCustomerMail(
    lead.email,
    {
      subject: `We couldn't complete ${name}'s check — retrying`,
      html: wrapTransactional(
        `${hi(lead)}
<p>This month's check for ${esc(name)} hasn't completed: twice running, the assistants returned nothing we could use. That is almost always an outage or a limit on their side, not anything about your profile.</p>
<p>We retry automatically every day until it goes through, and the report lands in your inbox and dashboard as usual when it does. There is nothing for you to do. If it is still stuck after a week, a person looks at it.</p>
${button(`${SITE()}/dashboard`, "Open my dashboard")}`,
      ),
    },
    "check_trouble",
    lead.id,
  );
}
