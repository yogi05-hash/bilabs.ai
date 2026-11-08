import { env } from "@/lib/env";
import type { Lead } from "@/lib/leads";
import { logEmail } from "@/lib/admin";
import type { Business } from "@/lib/businesses";
import type { Check, CheckResult } from "@/lib/checks";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

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
${button(`${site}/dashboard`, "See the full answers")}
<p style="color:#555;font-size:13.5px">Five questions per assistant, one moment in time — not a ranking. Answers shift as sources change, which is why we ask every month rather than once.</p>`,
      ),
    },
    "visibility_report",
    lead.id,
  );
}
