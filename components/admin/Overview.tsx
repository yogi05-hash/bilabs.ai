"use client";

import { Badge, Delta, Empty, ErrorBox, Loading, Spark, Stat, fmtDate, fmtMoney, fmtNum, ago } from "./ui";

/* The Overview.
 *
 * Two bands, labelled differently on purpose: everything under "In <period>"
 * respects the date filter, and everything under "Right now" is a current
 * fact that ignores it. Active subscribers and MRR belong in the second — a
 * subscription that started last year is still active today, and filtering it
 * by a seven-day window would report zero. */

type Metric = { value: number; prev: number; delta: number | null };

export type OverviewData = {
  period: { label: string; from: string; to: string; days: number; prevFrom: string; prevTo: string };
  visitors: { unique: Metric; new: Metric; returning: Metric };
  contacts: { captured: Metric; total: number };
  evaluations: { started: Metric; completed: Metric; failed: Metric; abandoned: Metric; running: number; reportsViewed: Metric };
  checkouts: { started: Metric; completed: Metric };
  customers: { new: Metric; activeNow: number; trialingNow: number };
  money: {
    receivedPence: Metric; refundedPence: Metric; netPence: Metric;
    currency: string; mixedCurrency: boolean; oneOffPence: number; recurringPence: number;
  };
  mrr: { byCurrency: Record<string, number>; activeCount: number; trialingCount: number; gbpOnly: number | null; currencies: string[] } | null;
  conversion: {
    visitorToLead: { rate: number | null; numerator: number; denominator: number; definition: string; maturing: boolean };
    evaluationToPaid: { rate: number | null; numerator: number; denominator: number; definition: string; maturing: boolean };
    windowDays: number;
  };
  funnel: Array<{ id: string; label: string; count: number; ofPrev: number | null; dropped: number }>;
  series: Array<{ day: string; visitors: number; checks: number; leads: number; revenuePence: number }>;
  sources: Array<{ channel: string; visitors: number; leads: number; evaluations: number; customers: number; revenuePence: number }>;
  dataHealth: { stripeConnected: boolean; trackingRows: number; firstEventAt: string | null };
  actionNeeded: {
    failedEvaluations: Array<{ id: string; website: string | null; failure_reason: string | null; started_at: string }>;
    overdueFollowUps: Array<{ id: string; title: string; due_at: string }>;
    failedPayments: Array<{ id: string; email: string | null; occurred_at: string; amount_pence: number }>;
    failedEmails: Array<{ id: string; email: string | null; kind: string; error: string | null; created_at: string }>;
    webhookErrors: Array<{ stripe_event_id: string; type: string; reason: string | null; received_at: string }>;
  };
  recent: Array<{ name: string; occurred_at: string; path: string | null; contact_id: string | null }>;
};

export default function Overview({
  data, loading, error, onRetry, onGo,
}: {
  data: OverviewData | null; loading: boolean; error: string | null;
  onRetry: () => void; onGo: (tab: string) => void;
}) {
  if (error) return <ErrorBox message={error} onRetry={onRetry} />;
  if (loading && !data) {
    return (
      <div className="ad-grid">
        {Array.from({ length: 8 }).map((_, i) => <Loading key={i} rows={2} />)}
      </div>
    );
  }
  if (!data) return null;

  const d = data;
  const days = d.series.map((s) => s.day.slice(5));
  const noTracking = d.dataHealth.trackingRows === 0;

  const actions = [
    ...d.actionNeeded.failedEvaluations.map((f) => ({
      k: `fe-${f.id}`, tone: "bad" as const, what: "Check failed",
      detail: `${f.website ?? "unknown site"} — ${f.failure_reason ?? "no reason recorded"}`,
      when: f.started_at, go: "evaluations",
    })),
    ...d.actionNeeded.overdueFollowUps.map((f) => ({
      k: `fu-${f.id}`, tone: "bad" as const, what: "Follow-up overdue", detail: f.title, when: f.due_at, go: "followups",
    })),
    ...d.actionNeeded.failedPayments.map((p) => ({
      k: `fp-${p.id}`, tone: "bad" as const, what: "Payment failed",
      detail: `${p.email ?? "unknown"} — ${fmtMoney(p.amount_pence)}`, when: p.occurred_at, go: "customers",
    })),
    ...d.actionNeeded.failedEmails.map((e) => ({
      k: `fm-${e.id}`, tone: "bad" as const, what: "Email not delivered",
      detail: `${e.kind} to ${e.email ?? "unknown"} — ${e.error ?? "no error recorded"}`, when: e.created_at, go: "followups",
    })),
    ...d.actionNeeded.webhookErrors.map((w) => ({
      k: `wh-${w.stripe_event_id}`, tone: "bad" as const, what: "Webhook could not be processed",
      detail: `${w.type} — ${w.reason ?? "no reason recorded"}`, when: w.received_at, go: "customers",
    })),
  ];

  return (
    <>
      {noTracking ? (
        <div className="ad-card" style={{ marginBottom: 14, borderColor: "rgba(245,183,49,.5)", background: "rgba(245,183,49,.07)" }}>
          <p className="ad-k" style={{ color: "var(--ad-amber-2)" }}>No visitor data yet</p>
          <p className="ad-note" style={{ fontSize: 12.5 }}>
            Visitor tracking went live with this dashboard, so it has nothing to report before today. Evaluations,
            contacts and payments made before then are still here — they were recorded by other parts of the system —
            but visits, sources and the funnel only start from now.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------ period band */}
      <div className="ad-sect">
        <h2 className="ad-sect-h">
          In {d.period.label.toLowerCase()}
          <span className="ad-note" style={{ margin: 0, fontWeight: 400 }}>
            {fmtDate(d.period.from)} → {fmtDate(new Date(+new Date(d.period.to) - 1).toISOString())}
            {" · vs "}{fmtDate(d.period.prevFrom)} → {fmtDate(new Date(+new Date(d.period.prevTo) - 1).toISOString())}
          </span>
        </h2>
        <div className="ad-grid">
          <Stat
            label="Unique visitors" value={fmtNum(d.visitors.unique.value)} metric={d.visitors.unique}
            note={<>{fmtNum(d.visitors.new.value)} new · {fmtNum(d.visitors.returning.value)} returning</>}
            hint="People active in the period, counted by a first-party cookie. New = first ever seen in this window."
          />
          <Stat
            label="Emails captured" value={fmtNum(d.contacts.captured.value)} metric={d.contacts.captured}
            note={<>{fmtNum(d.contacts.total)} contacts all time</>}
            hint="Addresses volunteered in a form during the period. We never discover an email."
          />
          <Stat
            label="Checks started" value={fmtNum(d.evaluations.started.value)} metric={d.evaluations.started}
            note={<>{fmtNum(d.evaluations.completed.value)} completed · {fmtNum(d.evaluations.failed.value)} failed · {fmtNum(d.evaluations.abandoned.value)} abandoned{d.evaluations.running ? ` · ${d.evaluations.running} running` : ""}</>}
            hint="Every run now opens a row before work starts, so crashes and closed tabs are counted too."
          />
          <Stat
            label="Reports viewed" value={fmtNum(d.evaluations.reportsViewed.value)} metric={d.evaluations.reportsViewed}
            note="Checks whose full report was opened"
          />
          <Stat
            label="Checkouts started" value={fmtNum(d.checkouts.started.value)} metric={d.checkouts.started}
            note={<>{fmtNum(d.checkouts.completed.value)} completed</>}
            hint="Started = Stripe returned a session URL. Completed = a verified webhook confirmed payment."
          />
          <Stat
            label="New paying customers" value={fmtNum(d.customers.new.value)} metric={d.customers.new}
            hint="Contacts whose first verified BiLabs payment landed in this period."
          />
          <Stat
            label="Payments received" value={d.money.mixedCurrency ? "mixed" : fmtMoney(d.money.receivedPence.value, d.money.currency)}
            metric={d.money.mixedCurrency ? undefined : d.money.receivedPence}
            note={d.money.mixedCurrency
              ? "More than one currency — shown separately under Customers & Billing"
              : <>{fmtMoney(d.money.recurringPence, d.money.currency)} recurring · {fmtMoney(d.money.oneOffPence, d.money.currency)} one-off</>}
          />
          <Stat
            label="Refunds / net" value={fmtMoney(d.money.netPence.value, d.money.currency)}
            note={<>{fmtMoney(d.money.refundedPence.value, d.money.currency)} refunded in period</>}
            hint="Net receipts = payments received minus refunds, live mode only."
          />
        </div>
      </div>

      {/* --------------------------------------------- current totals */}
      <div className="ad-sect">
        <h2 className="ad-sect-h">
          Right now
          <span className="ad-note" style={{ margin: 0, fontWeight: 400 }}>current totals — not affected by the date filter</span>
        </h2>
        <div className="ad-grid">
          {d.mrr === null ? (
            <>
              <div className="ad-card">
                <p className="ad-k">Monthly recurring revenue</p>
                <p className="ad-v ad-v-sm ad-muted">Not connected</p>
                <p className="ad-note">Stripe could not be reached, so this is unknown rather than zero.</p>
              </div>
              <div className="ad-card">
                <p className="ad-k">Active subscribers</p>
                <p className="ad-v ad-v-sm ad-muted">Not connected</p>
              </div>
            </>
          ) : (
            <>
              <Stat
                label="Monthly recurring revenue"
                value={d.mrr.gbpOnly !== null ? fmtMoney(d.mrr.gbpOnly, "gbp") : "mixed"}
                note={d.mrr.gbpOnly !== null
                  ? "Active + trialing BiLabs subscriptions, annual normalised to /12"
                  : Object.entries(d.mrr.byCurrency).map(([c, v]) => `${fmtMoney(v, c)}`).join(" + ") + " — not added together"}
                hint="BiLabs products only. This Stripe account also carries other products, which are excluded."
              />
              <Stat
                label="Active subscribers" value={fmtNum(d.mrr.activeCount)}
                note={d.mrr.trialingCount ? `${fmtNum(d.mrr.trialingCount)} trialing` : "Excludes past-due and cancelled"}
              />
            </>
          )}
          <Stat label="Contacts on record" value={fmtNum(d.contacts.total)} note="With an email address, excluding merged duplicates" />
          <Stat
            label="Checks in flight" value={fmtNum(d.evaluations.running)}
            note="Marked abandoned after 10 minutes without a result"
          />
        </div>
      </div>

      {/* ------------------------------------------------- conversion */}
      <div className="ad-sect">
        <h2 className="ad-sect-h">Conversion</h2>
        <div className="ad-two">
          {([
            ["Visitor → lead", d.conversion.visitorToLead],
            ["Completed check → paid", d.conversion.evaluationToPaid],
          ] as const).map(([label, c]) => (
            <div className="ad-card ad-card-pad" key={label}>
              <p className="ad-k">{label}</p>
              <p className="ad-v">
                {c.rate === null ? <span className="ad-muted" style={{ fontSize: 20 }}>No data</span> : `${c.rate}%`}
              </p>
              <p className="ad-note">
                <strong>{fmtNum(c.numerator)}</strong> of <strong>{fmtNum(c.denominator)}</strong>
              </p>
              <p className="ad-def">{c.definition}</p>
              {c.maturing ? (
                <p className="ad-def" style={{ color: "var(--ad-amber-2)" }}>
                  Still maturing — this cohort has not had the full {d.conversion.windowDays}-day window yet, so the
                  rate can only rise.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------- funnel */}
      <div className="ad-sect">
        <h2 className="ad-sect-h">
          Funnel
          <span className="ad-note" style={{ margin: 0, fontWeight: 400 }}>
            one cohort of visitors, followed through their own journey
          </span>
        </h2>
        <div className="ad-card ad-card-pad">
          {d.funnel[0].count === 0 ? (
            <p className="ad-state" style={{ padding: "18px 0" }}>
              <strong>No visitors in this period yet</strong>
              The funnel follows people who arrived in the window, so it fills as traffic comes in.
            </p>
          ) : (
            <div className="ad-funnel">
              {d.funnel.map((s) => {
                const pct = d.funnel[0].count ? (s.count / d.funnel[0].count) * 100 : 0;
                return (
                  <div className="ad-fstage" key={s.id}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.label}</span>
                    <div className="ad-fbar"><i style={{ width: `${Math.max(pct, s.count ? 1.5 : 0)}%` }} /></div>
                    <span className="ad-fmeta">
                      {fmtNum(s.count)}
                      {s.ofPrev !== null ? ` · ${s.ofPrev}% of previous` : ""}
                      {s.dropped ? ` · −${fmtNum(s.dropped)}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="ad-def">
            Each stage counts only people who reached the stage above it, so the drop-offs are real rather than a
            comparison of unrelated totals. Giving an email counts whether it happened before the check or after it,
            when unlocking the report. Conversions landing up to {d.conversion.windowDays} days after the period are
            still credited to the visitor who started the journey.
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------- trends */}
      <div className="ad-sect">
        <h2 className="ad-sect-h">Trends</h2>
        <div className="ad-grid">
          {([
            ["Visitors", d.series.map((s) => s.visitors)],
            ["Checks started", d.series.map((s) => s.checks)],
            ["Emails captured", d.series.map((s) => s.leads)],
            ["Revenue", d.series.map((s) => Math.round(s.revenuePence / 100))],
          ] as const).map(([label, vals]) => (
            <div className="ad-card" key={label}>
              <p className="ad-k">{label}</p>
              <Spark data={vals as number[]} labels={days} />
              <p className="ad-note">
                {label === "Revenue"
                  ? fmtMoney(d.series.reduce((n, s) => n + s.revenuePence, 0), d.money.currency)
                  : fmtNum((vals as number[]).reduce((n, v) => n + v, 0))}
                {" over "}{d.period.days} day{d.period.days === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------- actions + sources + feed */}
      <div className="ad-sect ad-two">
        <div>
          <h2 className="ad-sect-h">Needs attention</h2>
          {actions.length === 0 ? (
            <Empty title="Nothing needs attention">No failed checks, overdue follow-ups, payment problems or undelivered email.</Empty>
          ) : (
            <div className="ad-tablewrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <tbody>
                  {actions.slice(0, 12).map((a) => (
                    <tr key={a.k} className="clickable" onClick={() => onGo(a.go)}>
                      <td style={{ width: 8 }}><span className="ad-dot bad" /></td>
                      <td>
                        <div style={{ fontWeight: 650, fontSize: 12.5 }}>{a.what}</div>
                        <div className="ad-muted" style={{ fontSize: 12 }}>{a.detail}</div>
                      </td>
                      <td className="ad-muted ad-num" style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: 11.5 }}>{ago(a.when)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="ad-sect-h">Best acquisition sources</h2>
          {d.sources.length === 0 ? (
            <Empty title="No source data yet">Sources appear once visitors arrive with the tracking cookie set.</Empty>
          ) : (
            <div className="ad-tablewrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Source / medium</th>
                    <th style={{ textAlign: "right" }}>Visitors</th>
                    <th style={{ textAlign: "right" }}>Leads</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {d.sources.slice(0, 8).map((s) => (
                    <tr key={s.channel} className="clickable" onClick={() => onGo("campaigns")}>
                      <td>{s.channel}</td>
                      <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(s.visitors)}</td>
                      <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(s.leads)}</td>
                      <td className="ad-num" style={{ textAlign: "right" }}>{s.revenuePence ? fmtMoney(s.revenuePence) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="ad-sect">
        <h2 className="ad-sect-h">Recent activity</h2>
        {d.recent.length === 0 ? (
          <Empty title="No activity recorded yet">Events appear here as visitors use the site.</Empty>
        ) : (
          <div className="ad-tablewrap">
            <table className="ad-table">
              <tbody>
                {d.recent.map((r, i) => (
                  <tr key={i}>
                    <td style={{ width: 150 }}><Badge value={r.name} /></td>
                    <td className="ad-muted">{r.path ?? "—"}</td>
                    <td style={{ width: 90 }}>{r.contact_id ? <span className="ad-badge">identified</span> : <span className="ad-muted" style={{ fontSize: 12 }}>anonymous</span>}</td>
                    <td className="ad-muted ad-num" style={{ textAlign: "right", width: 130, whiteSpace: "nowrap" }}>{fmtDate(r.occurred_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
