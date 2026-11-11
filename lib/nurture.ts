import { env } from "@/lib/env";
import { startUrl } from "@/lib/checkout";
import { logEvent, sb, unsubscribeUrl, type Lead } from "@/lib/leads";
import { logEmail } from "@/lib/admin";

/* The nurture sequence.
 *
 * Six emails over thirty days, each written from what that lead's own check
 * actually found. Nothing is invented: if we have no failed checks for them,
 * the "three fixes" email is skipped rather than padded with generic advice,
 * and the day-16 re-check reports whatever the re-run says, including when
 * the news is that nothing has changed.
 *
 * Hard conditions on every send: marketing_consent is true, status is
 * "nurturing", and the step is due. Paid, unsubscribed and lost are never
 * emailed again. */

export const STEPS = [
  { step: 1, day: 2, id: "fixes" },
  { step: 2, day: 5, id: "competitors" },
  { step: 3, day: 9, id: "offer" },
  { step: 4, day: 16, id: "recheck" },
  { step: 5, day: 30, id: "last" },
] as const;

const SITE = () => env("NEXT_PUBLIC_SITE_URL", "https://bilabs.ai").replace(/\/+$/, "");

/** A link back to the free check, prefilled with their site and attributed to
 *  the email that sent them — so an email-driven re-check shows up as one. */
function checkUrl(lead: Lead, src: string): string {
  const p = new URLSearchParams({ src: `nurture-${src}` });
  if (lead.website) p.set("site", lead.website.slice(0, 160));
  return `${SITE()}/?${p.toString()}#check`;
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One click to Stripe with this contact attached — never a trip via the
 *  pricing section. The step name travels as src so attribution per email
 *  survives the round trip. */
const payUrl = (lead: Lead, src: string) => startUrl({ contactId: lead.id, src: `nurture-${src}` });

type Check = { id: string; label: string; weight: number; pass: boolean; detail: string };
type Report = {
  business?: string;
  mentionCount?: number;
  queriesRun?: number;
  competitors?: string[];
  scan?: { url?: string | null; score?: number | null; maxScore?: number; checks?: Check[] } | null;
};

function who(lead: Lead): string {
  return lead.company || lead.name || lead.website || "your business";
}

function failedChecks(lead: Lead): Check[] {
  const r = (lead.report ?? {}) as Report;
  const checks = r.scan?.checks ?? [];
  return checks.filter((c) => !c.pass).sort((a, b) => b.weight - a.weight);
}

/** Plain, personal, signed by a person. No marketing voice. */
function wrap(lead: Lead, body: string): string {
  const u = unsubscribeUrl(lead);
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;font-size:15px;line-height:1.65;color:#111">
${body}
<p style="margin:22px 0 0">Yogi<br><span style="color:#777;font-size:13px">BiLabs · bilabs.ai</span></p>
<p style="margin:26px 0 0;font-size:12px;color:#999">
  You asked us to email you tips and offers when you ran your free AI check.
  <a href="${u}" style="color:#999">Unsubscribe</a> — one click, no questions.
</p>
</div>`;
}

export type Mail = { subject: string; html: string } | null;

export function buildEmail(lead: Lead, stepId: string): Mail {
  const r = (lead.report ?? {}) as Report;
  const name = who(lead);
  const failed = failedChecks(lead);
  const score = r.scan?.score ?? lead.readiness_score;
  const competitors = (r.competitors ?? []).slice(0, 5);

  if (stepId === "fixes") {
    // Nothing honest to say without their own failed checks.
    if (!failed.length) return null;
    const top = failed.slice(0, 3);
    return {
      subject: `The ${top.length === 1 ? "fix" : `${top.length} fixes`} that matter most for ${name}`,
      html: wrap(
        lead,
        `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>When you ran the free check on ${esc(name)}, your site scored ${score ?? "—"}/100 for how readable it is to AI assistants. These are the things costing you the most, in order:</p>
<ol style="padding-left:18px">
${top.map((c) => `<li style="margin-bottom:10px"><strong>${esc(c.label)}</strong> — worth ${c.weight} points.<br><span style="color:#555">${esc(c.detail)}</span></li>`).join("")}
</ol>
<p>None of these need a rebuild. They are things your existing site should already be saying out loud, in text a machine can read.</p>
<p>If you want them done for you, that is what <a href="${payUrl(lead, "fixes")}" style="color:#B8841A">Get Found by AI</a> is — £49 a month, cancel anytime.</p>`,
      ),
    };
  }

  if (stepId === "competitors") {
    if (!competitors.length) return null;
    const mention = r.mentionCount ?? lead.mentions ?? 0;
    const total = r.queriesRun ?? lead.mentions_total ?? 5;
    return {
      subject: `Who AI recommends instead of ${name}`,
      html: wrap(
        lead,
        `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>When we asked an AI assistant five different ways, ${esc(name)} came up in ${mention} of ${total}. These are the businesses it named:</p>
<ul style="padding-left:18px">${competitors.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<p>They are not necessarily better than you. They are easier to read — their details are published where these systems look, and yours are not yet.</p>
<p>That gap is the whole job. <a href="${payUrl(lead, "competitors")}" style="color:#B8841A">Close it for £49/month, cancel anytime →</a></p>`,
      ),
    };
  }

  if (stepId === "offer") {
    return {
      subject: `Get ${name} found by AI — here's how it works`,
      html: wrap(
        lead,
        `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>Quick one. You confirm your business and add your services, hours, prices and FAQ — five minutes. We publish a profile with structured data where AI web search reads it, give you snippets for your own site, and every month ask ChatGPT, Claude, Gemini and Grok whether they name you — with every answer in your dashboard and your inbox.</p>
<p>It is £49 a month, and you can cancel any time — if it is not earning its keep, stop.</p>
<p><a href="${payUrl(lead, "offer")}" style="display:inline-block;background:#F5B731;color:#1a1205;padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none">Start for £49/month</a></p>
<p style="color:#555">Everything is automatic from the moment you pay: the setup takes five minutes, and if you stop halfway we remind you.</p>`,
      ),
    };
  }

  if (stepId === "last") {
    return {
      subject: `Last one from me about ${name}`,
      html: wrap(
        lead,
        `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>This is the last email I will send about this — I would rather stop than keep nagging.</p>
<p>Your check results are still yours, and <a href="${checkUrl(lead, "last")}" style="color:#B8841A">the free check is always there</a> if you want to see whether anything has shifted. If the timing is wrong, that is completely fine.</p>
<p>If you ever do want it done for you, reply to this and I will pick it up personally.</p>`,
      ),
    };
  }

  return null;
}

/** Day-16 re-check: real results only, including "nothing changed". */
export async function buildRecheck(lead: Lead): Promise<Mail> {
  const site = SITE();
  const name = who(lead);
  if (!lead.website || !lead.business_type || !lead.area) return null;

  let fresh: { mentionCount: number; queriesRun: number; scan?: { score?: number | null } | null } | null = null;
  try {
    const res = await fetch(`${site}/api/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-recheck": env("CRON_SECRET") },
      body: JSON.stringify({
        businessName: lead.company || lead.website,
        website: lead.website,
        businessType: lead.business_type,
        area: lead.area,
      }),
    });
    if (res.ok) fresh = await res.json();
  } catch (e) {
    console.warn("[nurture] recheck failed:", e);
  }
  if (!fresh) return null; // never invent a re-check

  const before = lead.mentions ?? 0;
  const beforeScore = lead.readiness_score;
  const now = fresh.mentionCount;
  const nowScore = fresh.scan?.score ?? null;

  const moved = now !== before || (nowScore !== null && beforeScore !== null && nowScore !== beforeScore);
  const direction = now > before ? "better" : now < before ? "worse" : "the same";

  return {
    subject: `Re-checked ${name} — here's what AI says now`,
    html: wrap(
      lead,
      `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>I re-ran the same five questions for ${esc(name)} today, two weeks on.</p>
<table style="font-size:15px;border-collapse:collapse;margin:14px 0">
  <tr><td style="padding:5px 18px 5px 0;color:#777">Mentioned then</td><td><strong>${before}/${lead.mentions_total ?? 5}</strong></td></tr>
  <tr><td style="padding:5px 18px 5px 0;color:#777">Mentioned now</td><td><strong>${now}/${fresh.queriesRun}</strong></td></tr>
  ${beforeScore !== null && nowScore !== null ? `<tr><td style="padding:5px 18px 5px 0;color:#777">Readiness</td><td><strong>${beforeScore} → ${nowScore}</strong>/100</td></tr>` : ""}
</table>
<p>${
        moved
          ? `So it has moved ${direction}. These answers do shift on their own as sources change — which is exactly why it is worth having your own details published rather than leaving it to chance.`
          : `No change — which is the usual answer when nothing has been published in between. These systems can only repeat what they can read.`
      }</p>
<p><a href="${payUrl(lead, "recheck")}" style="color:#B8841A">Fix it for £49/month, cancel anytime →</a></p>`,
    ),
  };
}

export async function sendMail(lead: Lead, mail: { subject: string; html: string }): Promise<boolean> {
  const key = env("RESEND_API_KEY");
  if (!key || !lead.email) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("NURTURE_FROM", "Yogi at BiLabs <no-reply@yourbotchat.com>"),
        to: [lead.email],
        reply_to: env("LEAD_NOTIFY_TO", "hello@bilabs.ai"),
        subject: mail.subject,
        html: mail.html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl(lead)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      console.warn("[nurture] resend", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[nurture] send threw:", e);
    return false;
  }
}

export async function advance(lead: Lead, step: number, id: string, sent: boolean) {
  await sb(`bilabs_leads?id=eq.${lead.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      nurture_step: step,
      last_emailed_at: sent ? new Date().toISOString() : lead.last_emailed_at,
      updated_at: new Date().toISOString(),
    }),
  });
  await logEvent(lead.id, sent ? `nurture:${id}` : `nurture:${id}:skipped`);
}

/** The email after payment. With a dashboard link it is the hand-over to the
 *  self-serve setup; without one (no business row could be made) it falls back
 *  to the personal note so nobody who has just paid hears nothing. */
export async function sendWelcome(lead: Lead, opts: { dashboardUrl?: string | null } = {}): Promise<boolean> {
  const site = SITE();
  if (opts.dashboardUrl) {
    const ok = await sendMail(lead, {
      subject: `You're in — set up your profile (5 minutes)`,
      html: wrap(
        lead,
        `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>Thanks — you're in. ${esc(who(lead))} now has a profile waiting to be set up, and it takes about five minutes.</p>
<p><a href="${opts.dashboardUrl}" style="display:inline-block;background:#F5B731;color:#1a1205;padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none">Set up my profile →</a></p>
<ol style="padding-left:18px">
  <li style="margin-bottom:8px">Confirm it's your business — we've pre-filled what your free check found.</li>
  <li style="margin-bottom:8px">Choose which assistants to monitor: ChatGPT, Claude, Gemini and Grok.</li>
  <li style="margin-bottom:8px">Add your services, hours, prices and the questions customers ask you.</li>
</ol>
<p>The moment you finish, your profile is published where AI web search can read it, the first check runs straight away, and then every month. Each result lands in your dashboard and in your inbox.</p>
<p style="color:#555">One honest note while we start: we make your business discoverable to AI web search and measure whether assistants name you. We do not — and cannot — put anything inside a model. Anyone who promises you a guaranteed AI ranking is guessing.</p>
<p style="color:#555;font-size:13px">That button signs you in and is good for 15 minutes. After that, enter your email at <a href="${site}/dashboard" style="color:#B8841A">${site.replace(/^https?:\/\//, "")}/dashboard</a> and we'll send a fresh link.</p>`,
      ),
    });
    await logEmail({ contactId: lead.id, email: lead.email, kind: "welcome_dashboard", subject: "You're in — set up your profile", ok });
    return ok;
  }
  return sendMail(lead, {
    subject: `You're in — what happens next`,
    html: wrap(
      lead,
      `<p>Hi${lead.name ? ` ${esc(lead.name.split(" ")[0])}` : ""},</p>
<p>Thanks — your payment for ${esc(who(lead))} went through.</p>
<p><strong>What happens now:</strong></p>
<ol style="padding-left:18px">
  <li style="margin-bottom:8px">Go to <a href="${SITE()}/dashboard" style="color:#B8841A">${SITE().replace(/^https?:\/\//, "")}/dashboard</a>, enter this email address, and open the sign-in link we send. That takes you to the five-minute setup: confirm your business, choose assistants, add services, hours, prices and FAQ.</li>
  <li style="margin-bottom:8px">Press Publish and your profile goes live immediately; the first check runs straight away.</li>
  <li style="margin-bottom:8px">Every month after that, the report arrives in your inbox.</li>
</ol>
<p>If the sign-in link doesn't arrive, reply to this email and a person sorts it.</p>
<p style="color:#555">One honest note while we start: I can make your business readable, and I will keep it current. What any assistant chooses to quote is still its own decision. Anyone who promises you a guaranteed AI ranking is guessing.</p>
<p><a href="${checkUrl(lead, "welcome")}" style="color:#B8841A">Your free check is always here →</a></p>`,
    ),
  });
}
