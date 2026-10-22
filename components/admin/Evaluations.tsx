"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, Pager, Th, fmtDate, fmtNum } from "./ui";

/* Free evaluations.
 *
 * Readability and mentions sit in two separate columns and are never combined
 * — they measure different things. A site can score 90/100 and be mentioned
 * zero times out of five, and often is. */

type Ev = {
  id: string; website: string | null; business_name: string | null; business_type: string | null;
  area: string | null; status: string; started_at: string; completed_at: string | null;
  runtime_ms: number | null; readiness_score: number | null; readiness_max: number | null;
  site_reachable: boolean | null; mentions: number | null; mentions_total: number | null;
  model: string | null; web_searches: number | null; est_cost_pence: string | number | null;
  report_emailed_at: string | null; report_viewed_at: string | null; report_views: number;
  failure_reason: string | null; attempt: number; retry_of: string | null; requested_by: string | null;
  is_test: boolean; checks: unknown; competitors: unknown;
  contact: { id: string; email: string | null; company: string | null } | null;
};

const STATUSES = ["", "completed", "failed", "abandoned", "running", "queued"];

export default function Evaluations({
  call, range, canWrite,
}: {
  call: (p: string, i?: RequestInit) => Promise<Response | null>;
  range: string; canWrite: boolean;
}) {
  const [rows, setRows] = useState<Ev[]>([]);
  const [method, setMethod] = useState<Record<string, string> | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const size = 25;
  const [sort, setSort] = useState("started");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Ev | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const p = new URLSearchParams({ range, page: String(page), size: String(size), sort, dir });
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    const res = await call(`/api/admin/evaluations?${p}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load evaluations."); setLoading(false); return; }
    const d = await res.json();
    setRows(d.evaluations ?? []); setTotal(d.total ?? 0); setMethod(d.method ?? null); setLoading(false);
  }, [call, range, page, sort, dir, status, q]);

  useEffect(() => { void load(); }, [load]);

  const retry = async (id: string) => {
    setMsg(null);
    const res = await call("/api/admin/evaluations", { method: "POST", body: JSON.stringify({ id }) });
    if (!res) return;
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? (d.note ?? "Retry queued.") : (d.error ?? "Could not retry."));
    if (res.ok) await load();
  };

  const onSort = (c: string) => { if (c === sort) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(c); setDir("desc"); } setPage(0); };

  return (
    <>
      {err ? <ErrorBox message={err} onRetry={load} /> : null}
      {msg ? <div className="ad-card" style={{ marginBottom: 12, fontSize: 13 }}>{msg}</div> : null}

      <div className="ad-filters">
        <input className="ad-input grow" placeholder="Search website, business, type or area…"
               value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search evaluations" />
        <select className="ad-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : "All statuses"}</option>)}
        </select>
      </div>

      {loading ? <Loading rows={6} /> : rows.length === 0 ? (
        <Empty title="No evaluations in this period">
          Checks are recorded from the moment they start, including ones that fail or are abandoned.
        </Empty>
      ) : (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead>
              <tr>
                <Th col="started" sort={sort} dir={dir} onSort={onSort}>Started</Th>
                <Th>Website / business</Th>
                <Th>Contact</Th>
                <Th>Status</Th>
                <Th col="score" sort={sort} dir={dir} onSort={onSort} numeric>Readable</Th>
                <Th col="mentions" sort={sort} dir={dir} onSort={onSort} numeric>Mentioned</Th>
                <Th numeric>Report</Th>
                <Th col="runtime" sort={sort} dir={dir} onSort={onSort} numeric>Runtime</Th>
                <Th numeric>Cost</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setOpen(e)} tabIndex={0}
                    onKeyDown={(ev) => { if (ev.key === "Enter") setOpen(e); }}>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(e.started_at, true)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.website ?? e.business_name ?? "—"}</div>
                    <div className="ad-muted" style={{ fontSize: 12 }}>{[e.business_type, e.area].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="ad-muted" style={{ fontSize: 12 }}>{e.contact?.email ?? <span className="ad-muted">anonymous</span>}</td>
                  <td>
                    <Badge value={e.status} />
                    {e.attempt > 1 ? <div className="ad-muted" style={{ fontSize: 11 }}>attempt {e.attempt}</div> : null}
                  </td>
                  <td className="ad-num" style={{ textAlign: "right" }}>
                    {e.readiness_score === null
                      ? <span className="ad-muted" title={e.site_reachable === false ? "Site could not be reached" : "No site scan"}>—</span>
                      : `${e.readiness_score}/${e.readiness_max ?? 100}`}
                  </td>
                  <td className="ad-num" style={{ textAlign: "right" }}>{e.mentions === null ? "—" : `${e.mentions}/${e.mentions_total}`}</td>
                  <td className="ad-num" style={{ textAlign: "right" }}>
                    {e.report_views > 0 ? `${e.report_views} view${e.report_views === 1 ? "" : "s"}` : e.report_emailed_at ? "emailed" : "—"}
                  </td>
                  <td className="ad-num ad-muted" style={{ textAlign: "right" }}>{e.runtime_ms === null ? "—" : `${(e.runtime_ms / 1000).toFixed(1)}s`}</td>
                  <td className="ad-num ad-muted" style={{ textAlign: "right" }}>
                    {e.est_cost_pence === null || e.est_cost_pence === undefined ? "—" : `${Number(e.est_cost_pence).toFixed(2)}p`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} size={size} total={total} onPage={setPage} />
        </div>
      )}

      {method ? (
        <div className="ad-card ad-card-pad ad-sect">
          <h3 className="ad-sect-h">What is measured, and how</h3>
          <div className="ad-defs">
            <p className="ad-def"><b>Site readability</b> — {method.readiness}</p>
            <p className="ad-def"><b>AI mentions</b> — {method.mentions}</p>
            <p className="ad-def"><b>Kept apart</b> — {method.separate}</p>
            <p className="ad-def"><b>Abandoned vs failed</b> — {method.abandonment}</p>
            <p className="ad-def"><b>Duplicate protection</b> — {method.duplicates}</p>
            <p className="ad-def"><b>Cost</b> — {method.cost}</p>
          </div>
        </div>
      ) : null}

      {open ? (
        <>
          <div className="ad-drawer-scrim" onClick={() => setOpen(null)} />
          <aside className="ad-drawer" role="dialog" aria-label="Evaluation details">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <h2>{open.website ?? open.business_name ?? "Check"}</h2>
                <p className="ad-note" style={{ margin: 0 }}>{[open.business_type, open.area].filter(Boolean).join(" · ")}</p>
              </div>
              <button className="ad-btn" onClick={() => setOpen(null)}>Close</button>
            </div>

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "13px 0" }}>
              <Badge value={open.status} />
              {open.is_test ? <span className="ad-badge">test fixture — excluded from reporting</span> : null}
              {open.retry_of ? <span className="ad-badge">retry of an earlier run</span> : null}
            </div>

            {open.failure_reason ? (
              <div className="ad-err" role="note">
                <strong>Why it did not finish:</strong> {open.failure_reason}
              </div>
            ) : null}

            <dl className="ad-kv">
              <dt>Started</dt><dd>{fmtDate(open.started_at, true)}</dd>
              <dt>Completed</dt><dd>{open.completed_at ? fmtDate(open.completed_at, true) : "—"}</dd>
              <dt>Runtime</dt><dd>{open.runtime_ms === null ? "—" : `${(open.runtime_ms / 1000).toFixed(1)}s`}</dd>
              <dt>Attempt</dt><dd>{open.attempt}</dd>
              <dt>Requested by</dt><dd>{open.requested_by ?? "visitor"}</dd>
              <dt>Model</dt><dd>{open.model ?? "—"}</dd>
              <dt>Web searches</dt><dd>{open.web_searches ?? "—"}</dd>
              <dt>Measured cost</dt><dd>{open.est_cost_pence === null ? "—" : `${Number(open.est_cost_pence).toFixed(3)}p`}</dd>
              <dt>Contact</dt><dd>{open.contact?.email ?? "anonymous — no email given"}</dd>
              <dt>Report emailed</dt><dd>{open.report_emailed_at ? fmtDate(open.report_emailed_at, true) : "not emailed"}</dd>
              <dt>Report viewed</dt><dd>{open.report_viewed_at ? `${fmtDate(open.report_viewed_at, true)} (${open.report_views})` : "not viewed"}</dd>
            </dl>

            <div className="ad-sect">
              <h3 className="ad-sect-h">Site readability</h3>
              {open.site_reachable === false ? (
                <p className="ad-note">The site could not be reached, so it was not scored. That is recorded as unreachable rather than as a zero.</p>
              ) : Array.isArray(open.checks) && open.checks.length ? (
                <div className="ad-tablewrap">
                  <table className="ad-table" style={{ minWidth: 0 }}>
                    <tbody>
                      {(open.checks as Array<{ label: string; weight: number; pass: boolean; detail: string }>).map((c, i) => (
                        <tr key={i}>
                          <td style={{ width: 24 }}>{c.pass ? "✅" : "❌"}</td>
                          <td><div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.label}</div><div className="ad-muted" style={{ fontSize: 12 }}>{c.detail}</div></td>
                          <td className="ad-num ad-muted" style={{ textAlign: "right" }}>{c.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="ad-note">No site scan recorded for this run.</p>}
            </div>

            <div className="ad-sect">
              <h3 className="ad-sect-h">AI mentions</h3>
              <p className="ad-note" style={{ marginTop: 0 }}>
                {open.mentions === null
                  ? "No mention data recorded."
                  : `Named in ${open.mentions} of ${open.mentions_total} differently-phrased questions.`}
              </p>
              {Array.isArray(open.competitors) && open.competitors.length ? (
                <p className="ad-note">Named instead: {(open.competitors as string[]).join(", ")}</p>
              ) : null}
            </div>

            {(open.status === "failed" || open.status === "abandoned") ? (
              <button className="ad-btn primary" disabled={!canWrite} onClick={() => retry(open.id)}>
                Queue a retry
              </button>
            ) : null}
          </aside>
        </>
      ) : null}
    </>
  );
}
