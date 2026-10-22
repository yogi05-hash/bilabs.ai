import { env } from "@/lib/env";
import type { Check } from "@/lib/scan";

/* The emailed report. Shared by the check itself and by the unlock route, so
 * asking for the full checklist never re-runs five paid web searches. */

export type Payload = {
  business: string;
  mentionCount: number;
  queriesRun: number;
  queries?: { label: string; question: string; available: boolean; found: boolean }[];
  competitors?: string[];
  scan: { url: string | null; reachable: boolean; checks: Check[]; score: number | null; maxScore: number } | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendReport(to: string, p: Payload, ctx: { type: string; area: string }): Promise<boolean> {
  const RESEND = env("RESEND_API_KEY");
  const FROM = env("LEAD_FROM", "BiLabs <no-reply@yourbotchat.com>");
  if (!RESEND) return false;

  /* The unlock route takes this payload from the client, so the shape cannot
   * be assumed. A stale cached page or a trimmed body used to throw here and
   * take the whole capture down with it. Missing arrays degrade to an empty
   * section rather than a 500. */
  const queries = Array.isArray(p.queries) ? p.queries : [];
  const competitors = Array.isArray(p.competitors) ? p.competitors : [];

  const rows = queries
    .map((q) => `<tr><td style="padding:7px 14px 7px 0;color:#666">${esc(q.label)}</td><td style="font-weight:600">${q.available ? (q.found ? "Mentioned" : "Not mentioned") : "Could not run"}</td></tr>`)
    .join("");

  const checkRows = (Array.isArray(p.scan?.checks) ? p.scan.checks : [])
    .map((c) => `<tr><td style="padding:7px 14px 7px 0">${c.pass ? "✅" : "❌"}</td><td style="padding:7px 0"><strong>${esc(c.label)}</strong><br><span style="color:#666;font-size:13px">${esc(c.detail)}</span></td><td style="color:#999;white-space:nowrap">${c.weight} pts</td></tr>`)
    .join("");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:620px;color:#111">
    <h2 style="margin:0 0 4px">Your AI visibility report</h2>
    <p style="margin:0 0 18px;color:#666;font-size:14px">${esc(p.business)} · ${esc(ctx.type)} in ${esc(ctx.area)}</p>

    <h3 style="margin:22px 0 6px">Mentioned in ${p.mentionCount} of ${p.queriesRun} questions</h3>
    <table style="font-size:14px;border-collapse:collapse">${rows}</table>

    ${competitors.length ? `<h3 style="margin:22px 0 6px">Named instead</h3><p style="font-size:14px;color:#444;margin:0">${competitors.map(esc).join(" · ")}</p>` : ""}

    ${p.scan?.reachable
      ? `<h3 style="margin:24px 0 6px">AI readiness: ${p.scan.score}/${p.scan.maxScore}</h3>
         <table style="font-size:14px;border-collapse:collapse;width:100%">${checkRows}</table>`
      : p.scan
        ? `<p style="font-size:14px;color:#666;margin:22px 0 0">We could not reach ${esc(p.scan.url ?? "your website")}, so the readiness checks were not run.</p>`
        : ""}

    <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#666">
      Five questions, one AI assistant, one moment in time — not a ranking, and not a measurement of ChatGPT
      specifically. Ask again tomorrow and the answers can differ. The readiness checks are live fetches of your
      own site and will be stable until you change it.
    </p>
    <p style="margin:18px 0 0;font-size:14px">
      <a href="https://bilabs.ai/#packages" style="color:#B8841A;font-weight:600">See what fixing this costs →</a>
    </p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        bcc: [env("LEAD_NOTIFY_TO", "hello@bilabs.ai")],
        subject: `AI visibility report — ${p.business}`,
        html,
      }),
    });
    if (!res.ok) console.warn("[visibility] resend", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.warn("[visibility] resend threw:", e);
    return false;
  }
}
