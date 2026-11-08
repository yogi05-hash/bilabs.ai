"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, Pager, Stat, Th, fmtDate, fmtMoney, fmtNum, ago } from "./ui";

/* Paying businesses: the product's state per customer.
 *
 * The list answers "who paid, how much, and is their profile working"; the
 * drawer answers "what exactly did each assistant say, and what did we send
 * them". Actions here change state and are audited; none of them touches the
 * contact's sales pipeline. */

type ProviderTotal = { found: number; available: number; total: number; model: string | null; skipped?: boolean; reason?: string };
type CheckRow = {
  id: string; business_id: string; status: string; trigger: string; requested_by: string | null;
  created_at: string; started_at: string | null; completed_at: string | null; runtime_ms: number | null;
  providers: string[]; questions: { id: string; label: string; question: string }[] | null;
  totals: Record<string, ProviderTotal> | null; found_total: number | null; answers_total: number | null;
  competitors: string[] | null; est_cost_pence: string | number | null; failure_reason: string | null; report_emailed_at: string | null;
  results?: { provider: string; model: string | null; question_id: string; available: boolean; found: boolean; answer_text: string | null; competitors: string[] | null; error: string | null }[];
};
type Biz = {
  id: string; contact_id: string; slug: string | null; name: string | null; website: string | null; business_type: string | null;
  area: string | null; postcode: string | null; address: string | null; description: string | null; plan: string | null;
  services: { name: string; description?: string; price?: string }[]; hours: { day: string; open: string; close: string; closed: boolean }[];
  prices: { item: string; price: string }[]; faqs: { q: string; a: string }[]; areas: string[]; photos: { url: string; alt?: string }[]; socials: string[];
  phone: string | null; email: string | null; target_models: string[]; status: string; onboarding_step: number;
  confirmed_at: string | null; details_completed_at: string | null; published_at: string | null; republished_at: string | null;
  indexnow_pinged_at: string | null; next_check_at: string | null; last_check_at: string | null; last_error: string | null;
  is_test: boolean; created_at: string; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  contact: { id: string; email: string | null; phone: string | null; name: string | null; company: string | null } | null;
  subscription: { status: string; plan: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
  paidPence: number; latestCheck: CheckRow | null; openCheck: string | null;
};
type Detail = {
  business: Biz; contact: { email: string | null; name: string | null; phone: string | null } | null;
  checks: CheckRow[]; emails: { kind: string; subject: string | null; status: string; error: string | null; created_at: string }[];
  payments: { kind: string; amount_pence: number; currency: string; plan: string | null; occurred_at: string; livemode: boolean }[];
  audit: { actor: string; action: string; detail: unknown; created_at: string }[];
};

const PROVIDERS = [["anthropic", "Claude"], ["openai", "ChatGPT"], ["gemini", "Gemini"], ["xai", "Grok"]] as const;
const STATUSES = ["", "onboarding", "processing", "live", "paused", "cancelled"];
const label = (p: string) => PROVIDERS.find(([id]) => id === p)?.[1] ?? p;

function ModelChips({ targets, totals }: { targets: string[]; totals?: Record<string, ProviderTotal> | null }) {
  return (
    <div className="ad-chips">
      {PROVIDERS.map(([id, name]) => {
        const on = targets.includes(id);
        const t = totals?.[id];
        const txt = t && !t.skipped && t.available > 0 ? `${name} ${t.found}/${t.available}` : name;
        return <span key={id} className={`ad-chip-sm ${on ? (t && !t.skipped && t.available > 0 ? "on" : "") : "off"}`} title={t?.skipped ? t.reason : t?.model ?? (on ? "monitored" : "not chosen")}>{txt}</span>;
      })}
    </div>
  );
}

export default function Businesses({ call, canWrite }: { call: (p: string, i?: RequestInit) => Promise<Response | null>; canWrite: boolean }) {
  const [rows, setRows] = useState<Biz[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<Record<string, string> | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const size = 25;
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [tests, setTests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [openCheck, setOpenCheck] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const p = new URLSearchParams({ page: String(page), size: String(size), sort, dir });
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (tests) p.set("tests", "1");
    const res = await call(`/api/admin/businesses?${p}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load businesses."); setLoading(false); return; }
    const d = await res.json();
    setRows(d.businesses ?? []); setTotal(d.total ?? 0); setCounts(d.counts ?? {}); setMethod(d.method ?? null); setLoading(false);
  }, [call, page, sort, dir, status, q, tests]);

  useEffect(() => { void load(); }, [load]);

  const openRow = async (id: string) => {
    setOpenCheck(null);
    const res = await call(`/api/admin/business?id=${id}`);
    if (res?.ok) setOpen(await res.json());
  };

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setMsg(null);
    const res = await call("/api/admin/businesses", { method: "PATCH", body: JSON.stringify({ id, action, ...extra }) });
    if (!res) return;
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? `${action}: done${d.url ? ` — ${d.url}` : ""}` : d.error ?? "That action was refused.");
    await load();
    if (open?.business.id === id) await openRow(id);
  };

  const onSort = (c: string) => { if (c === sort) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(c); setDir("desc"); } setPage(0); };

  return (
    <>
      {err ? <ErrorBox message={err} onRetry={load} /> : null}
      {msg ? <div className="ad-card" style={{ marginBottom: 12, fontSize: 13 }}>{msg}</div> : null}

      <div className="ad-grid" style={{ marginBottom: 14 }}>
        <Stat label="Live" value={fmtNum(counts.live ?? 0)} note="published and checked" />
        <Stat label="Processing" value={fmtNum(counts.processing ?? 0)} note="published, first check pending" />
        <Stat label="Onboarding" value={fmtNum(counts.onboarding ?? 0)} note="paid, setup not finished" />
        <Stat label="Paused / cancelled" value={`${fmtNum(counts.paused ?? 0)} / ${fmtNum(counts.cancelled ?? 0)}`} />
      </div>

      <div className="ad-filters">
        <input className="ad-input grow" placeholder="Search name, website, type, area or slug…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search businesses" />
        <select className="ad-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : "All statuses"}</option>)}
        </select>
        <label className="ad-btn" style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <input type="checkbox" checked={tests} onChange={(e) => { setTests(e.target.checked); setPage(0); }} /> Show test rows
        </label>
      </div>

      {loading ? <Loading rows={6} /> : rows.length === 0 ? (
        <Empty title="No businesses yet">A row appears here the moment a BiLabs checkout completes.</Empty>
      ) : (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead>
              <tr>
                <Th col="name" sort={sort} dir={dir} onSort={onSort}>Business</Th>
                <Th>Contact</Th>
                <Th>Plan · paid</Th>
                <Th>Status</Th>
                <Th>Assistants · last check</Th>
                <Th col="next" sort={sort} dir={dir} onSort={onSort}>Next check</Th>
                <Th col="created" sort={sort} dir={dir} onSort={onSort}>Since</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => openRow(b.id)} tabIndex={0} onKeyDown={(ev) => { if (ev.key === "Enter") openRow(b.id); }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.name ?? b.website ?? "—"}</div>
                    <div className="ad-muted" style={{ fontSize: 12 }}>{[b.business_type, b.area].filter(Boolean).join(" · ")}{b.slug ? <> · <span className="ad-mono">/b/{b.slug}</span></> : null}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>{b.contact?.email ?? "—"}</div>
                    {b.contact?.phone ? <div className="ad-num ad-muted">{b.contact.phone}</div> : null}
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{b.plan ?? "—"}</div>
                    <div className="ad-num" style={{ fontWeight: 600 }}>{fmtMoney(b.paidPence)}</div>
                    {b.subscription ? <Badge value={b.subscription.status} /> : null}
                  </td>
                  <td>
                    <Badge value={b.status} />
                    {b.openCheck ? <div className="ad-muted" style={{ fontSize: 11 }}>check {b.openCheck}</div> : null}
                    {b.status === "onboarding" ? <div className="ad-muted" style={{ fontSize: 11 }}>step {b.onboarding_step}/3</div> : null}
                    {b.is_test ? <span className="ad-badge">test</span> : null}
                  </td>
                  <td>
                    <ModelChips targets={b.target_models} totals={b.latestCheck?.totals} />
                    {b.latestCheck ? <div className="ad-muted" style={{ fontSize: 11, marginTop: 3 }}>{b.latestCheck.found_total}/{b.latestCheck.answers_total} · {ago(b.latestCheck.completed_at)}</div> : <div className="ad-muted" style={{ fontSize: 11, marginTop: 3 }}>no check yet</div>}
                  </td>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(b.next_check_at)}</td>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} size={size} total={total} onPage={setPage} />
        </div>
      )}

      {method ? (
        <div className="ad-card ad-card-pad ad-sect">
          <h3 className="ad-sect-h">How these figures are defined</h3>
          <div className="ad-defs">
            <p className="ad-def"><b>Status</b> — {method.status}</p>
            <p className="ad-def"><b>Paid</b> — {method.paid}</p>
            <p className="ad-def"><b>Checks</b> — {method.checks}</p>
            <p className="ad-def"><b>Cost</b> — {method.cost}</p>
          </div>
        </div>
      ) : null}

      {open ? (() => {
        const b = open.business;
        return (
          <>
            <div className="ad-drawer-scrim" onClick={() => setOpen(null)} />
            <aside className="ad-drawer" role="dialog" aria-label="Business details">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <h2>{b.name ?? "Business"}</h2>
                  <p className="ad-note" style={{ margin: 0 }}>{[b.business_type, b.area, b.postcode].filter(Boolean).join(" · ")}</p>
                </div>
                <button className="ad-btn" onClick={() => setOpen(null)}>Close</button>
              </div>

              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "13px 0" }}>
                <Badge value={b.status} />
                {b.is_test ? <span className="ad-badge">test — excluded from reporting</span> : null}
                {b.slug ? <a className="ad-btn" href={`/b/${b.slug}`} target="_blank" rel="noopener">Open profile ↗</a> : null}
                {b.website ? <a className="ad-btn" href={b.website} target="_blank" rel="noopener">Their site ↗</a> : null}
              </div>

              {canWrite ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {b.status === "paused" || b.status === "cancelled" ? <button className="ad-btn primary" onClick={() => act(b.id, "resume")}>Resume</button> : <button className="ad-btn" onClick={() => act(b.id, "pause")}>Pause</button>}
                  <button className="ad-btn" onClick={() => act(b.id, "publish", { force: true })} title="Publishes even if the description or services are thin">{b.published_at ? "Re-publish" : "Force publish"}</button>
                  <button className="ad-btn amber" disabled={Boolean(b.openCheck) || !b.published_at} onClick={() => act(b.id, "recheck")}>Run check now</button>
                  {b.status !== "cancelled" ? <button className="ad-btn danger" onClick={() => act(b.id, "cancel")}>Mark cancelled</button> : null}
                </div>
              ) : null}

              {b.last_error ? <div className="ad-err" role="note"><strong>Last note:</strong> {b.last_error}</div> : null}

              <dl className="ad-kv">
                <dt>Contact</dt><dd>{open.contact?.email ?? "—"}{open.contact?.name ? ` · ${open.contact.name}` : ""}{open.contact?.phone ? ` · ${open.contact.phone}` : ""}</dd>
                <dt>Plan</dt><dd>{b.plan ?? "—"} · paid {fmtMoney(b.paidPence)}{b.subscription ? <> · <Badge value={b.subscription.status} /> {b.subscription.cancel_at_period_end ? "ends" : "renews"} {fmtDate(b.subscription.current_period_end)}</> : null}</dd>
                <dt>Stripe</dt><dd className="ad-mono">{b.stripe_customer_id ?? "—"}{b.stripe_subscription_id ? ` · ${b.stripe_subscription_id}` : ""}</dd>
                <dt>Assistants</dt><dd><ModelChips targets={b.target_models} /></dd>
                <dt>Setup</dt><dd>step {b.onboarding_step}/3 · confirmed {fmtDate(b.confirmed_at)} · details {fmtDate(b.details_completed_at)}</dd>
                <dt>Published</dt><dd>{fmtDate(b.published_at, true)}{b.republished_at && b.republished_at !== b.published_at ? ` · updated ${fmtDate(b.republished_at, true)}` : ""}</dd>
                <dt>IndexNow</dt><dd>{b.indexnow_pinged_at ? fmtDate(b.indexnow_pinged_at, true) : "not pinged"}</dd>
                <dt>Last / next check</dt><dd>{fmtDate(b.last_check_at, true)} / {fmtDate(b.next_check_at)}</dd>
                <dt>Website</dt><dd>{b.website ?? "—"}</dd>
                <dt>Phone · email</dt><dd>{[b.phone, b.email].filter(Boolean).join(" · ") || "—"}</dd>
                <dt>Address</dt><dd>{b.address ?? "—"}</dd>
                <dt>Description</dt><dd style={{ whiteSpace: "pre-line" }}>{b.description ?? "—"}</dd>
                <dt>Services</dt><dd>{b.services?.length ? b.services.map((s) => `${s.name}${s.price ? ` (${s.price})` : ""}`).join(" · ") : "—"}</dd>
                <dt>FAQ</dt><dd>{b.faqs?.length ? `${b.faqs.length} question${b.faqs.length === 1 ? "" : "s"}` : "—"}</dd>
                <dt>Areas</dt><dd>{b.areas?.length ? b.areas.join(", ") : "—"}</dd>
                <dt>Photos · socials</dt><dd>{b.photos?.length ?? 0} · {b.socials?.length ?? 0}</dd>
              </dl>

              <div className="ad-sect">
                <h3 className="ad-sect-h">Checks</h3>
                {open.checks.length === 0 ? <p className="ad-note">None yet.</p> : (
                  <div className="ad-tablewrap">
                    <table className="ad-table" style={{ minWidth: 0 }}>
                      <thead><tr><th>When</th><th>Trigger</th><th>Status</th><th>Named</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
                      <tbody>
                        {open.checks.map((c) => (
                          <tr key={c.id} className="clickable" onClick={() => setOpenCheck(openCheck === c.id ? null : c.id)}>
                            <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(c.completed_at ?? c.created_at, true)}</td>
                            <td>{c.trigger}<div className="ad-muted" style={{ fontSize: 11 }}>{c.requested_by ?? ""}</div></td>
                            <td><Badge value={c.status} />{c.failure_reason ? <div className="ad-muted" style={{ fontSize: 11 }}>{c.failure_reason}</div> : null}</td>
                            <td><ModelChips targets={c.providers ?? []} totals={c.totals} />{c.status === "completed" ? <div className="ad-muted" style={{ fontSize: 11, marginTop: 2 }}>{c.found_total}/{c.answers_total}{c.report_emailed_at ? " · emailed" : ""}</div> : null}</td>
                            <td className="ad-num ad-muted" style={{ textAlign: "right" }}>{c.est_cost_pence === null ? "—" : `${Number(c.est_cost_pence).toFixed(2)}p`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {openCheck ? (() => {
                  const c = open.checks.find((x) => x.id === openCheck);
                  if (!c) return null;
                  const qs = c.questions ?? [];
                  return (
                    <div className="ad-card ad-card-pad" style={{ marginTop: 10 }}>
                      {c.competitors?.length ? <p className="ad-note" style={{ marginTop: 0 }}>Named: {c.competitors.join(" · ")}</p> : null}
                      {(c.results ?? []).length === 0 ? <p className="ad-note">No answers stored.</p> : qs.map((q) => (
                        <div key={q.id} style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{q.label}</div>
                          {(c.results ?? []).filter((r) => r.question_id === q.id).map((r) => (
                            <details key={r.provider} style={{ marginTop: 4 }}>
                              <summary style={{ cursor: "pointer", fontSize: 12.5 }}>{r.available ? (r.found ? "✅" : "❌") : "—"} {label(r.provider)} <span className="ad-muted">{r.model ?? ""}{r.error ? ` · ${r.error}` : ""}</span></summary>
                              <pre className="ad-code" style={{ marginTop: 6 }}>{r.answer_text ?? "(no text)"}</pre>
                            </details>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })() : null}
              </div>

              <div className="ad-sect">
                <h3 className="ad-sect-h">Emails</h3>
                {open.emails.length === 0 ? <p className="ad-note">None logged.</p> : (
                  <ul className="ad-timeline">
                    {open.emails.slice(0, 15).map((e, i) => (
                      <li key={i} className="ad-tl-item">
                        <div className="ad-tl-when">{fmtDate(e.created_at, true)}</div>
                        <div className="ad-tl-what">{e.kind} · {e.status}</div>
                        <div className="ad-tl-detail">{e.error ?? e.subject ?? ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="ad-sect">
                <h3 className="ad-sect-h">Payments</h3>
                {open.payments.length === 0 ? <p className="ad-note">None recorded.</p> : (
                  <ul className="ad-timeline">
                    {open.payments.map((p, i) => (
                      <li key={i} className="ad-tl-item">
                        <div className="ad-tl-when">{fmtDate(p.occurred_at, true)}{p.livemode ? "" : " · test"}</div>
                        <div className="ad-tl-what">{p.kind === "refund" ? "Refund" : p.kind === "payment_failed" ? "Payment failed" : "Payment"} · {fmtMoney(p.amount_pence, p.currency)}</div>
                        <div className="ad-tl-detail">{p.plan ?? ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {open.audit.length ? (
                <div className="ad-sect">
                  <h3 className="ad-sect-h">Admin actions</h3>
                  <ul className="ad-timeline">
                    {open.audit.map((a, i) => (
                      <li key={i} className="ad-tl-item">
                        <div className="ad-tl-when">{fmtDate(a.created_at, true)} · {a.actor}</div>
                        <div className="ad-tl-what">{a.action}</div>
                        <div className="ad-tl-detail">{a.detail ? JSON.stringify(a.detail) : ""}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>
          </>
        );
      })() : null}
    </>
  );
}
