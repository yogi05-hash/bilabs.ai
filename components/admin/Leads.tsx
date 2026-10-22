"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, Pager, Th, fmtDate, fmtMoney, fmtNum } from "./ui";

/* Contacts.
 *
 * One row per person. Repeat checks do not create repeat contacts — the runs
 * live on the Evaluations page and are listed inside the drawer. */

type Lead = {
  id: string; name: string | null; email: string | null; company: string | null;
  website: string | null; business_type: string | null; area: string | null;
  source: string | null; first_source: string | null; last_source: string | null;
  mentions: number | null; mentions_total: number | null; readiness_score: number | null;
  marketing_consent: boolean; consent_at: string | null; status: string; pipeline_status: string;
  owner: string | null; next_follow_up_at: string | null; notes: string | null;
  created_at: string; updated_at: string; evaluationCount: number;
};

type Detail = {
  lead: Lead;
  timeline: Array<{ at: string; kind: string; label: string; detail?: string | null }>;
  evaluations: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  followUps: Array<Record<string, unknown>>;
  visitors: Array<Record<string, unknown>>;
};

const PIPELINE = ["new", "contacted", "interested", "customer", "closed"];
const RESULTS = [
  ["", "Any result"], ["scored", "Has a score"], ["high", "Score 80+"],
  ["mid", "Score 50–79"], ["low", "Score under 50"], ["unmentioned", "Never mentioned"], ["none", "No check yet"],
];

export default function Leads({
  call, range, canWrite,
}: {
  call: (p: string, i?: RequestInit) => Promise<Response | null>;
  range: string; canWrite: boolean;
}) {
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(25);
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [source, setSource] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState<Array<{ reason: string; confidence: string; primary: Lead; duplicate: Lead }>>([]);
  const [showDupes, setShowDupes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const p = new URLSearchParams({ page: String(page), size: String(size), sort, dir });
    if (q) p.set("q", q);
    if (pipeline) p.set("pipeline", pipeline);
    if (source) p.set("source", source);
    if (result) p.set("result", result);
    const res = await call(`/api/admin/leads?${p}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load contacts."); setLoading(false); return; }
    const d = await res.json();
    setRows(d.leads ?? []); setTotal(d.total ?? 0); setLoading(false);
  }, [call, page, size, sort, dir, q, pipeline, source, result]);

  useEffect(() => { void load(); }, [load, range]);

  const openLead = async (l: Lead) => {
    const res = await call(`/api/admin/lead?id=${l.id}`);
    if (!res?.ok) return;
    const d: Detail = await res.json();
    setOpen(d); setNotes(d.lead.notes ?? "");
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!open) return;
    setSaving(true);
    const res = await call("/api/admin/lead", { method: "PATCH", body: JSON.stringify({ id: open.lead.id, ...body }) });
    setSaving(false);
    if (res?.ok) { await openLead(open.lead); await load(); }
    else if (res) setErr((await res.json().catch(() => ({})))?.error ?? "That change was refused.");
  };

  const findDupes = async () => {
    const res = await call("/api/admin/duplicates");
    if (res?.ok) { const d = await res.json(); setDupes(d.candidates ?? []); setShowDupes(true); }
  };

  const merge = async (primaryId: string, duplicateId: string) => {
    const res = await call("/api/admin/duplicates", { method: "POST", body: JSON.stringify({ primaryId, duplicateId }) });
    if (res?.ok) { await findDupes(); await load(); }
  };

  const exportCsv = () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (pipeline) p.set("pipeline", pipeline);
    window.location.href = `/api/admin/export?${p}`;
  };

  const onSort = (c: string) => { if (c === sort) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(c); setDir("desc"); } setPage(0); };

  return (
    <>
      {err ? <ErrorBox message={err} onRetry={load} /> : null}

      <div className="ad-filters">
        <input
          className="ad-input grow" placeholder="Search email, name, business or website…"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search contacts"
        />
        <select className="ad-select" value={pipeline} onChange={(e) => { setPipeline(e.target.value); setPage(0); }} aria-label="Filter by stage">
          <option value="">All stages</option>
          {PIPELINE.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="ad-select" value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }} aria-label="Filter by source">
          <option value="">All sources</option>
          {["check", "ai-check", "ai-check-unlock", "contact", "checkout", "guide", "visibility-report"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="ad-select" value={result} onChange={(e) => { setResult(e.target.value); setPage(0); }} aria-label="Filter by evaluation result">
          {RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="ad-btn" onClick={findDupes}>Find duplicates</button>
        <button className="ad-btn" onClick={exportCsv}>Export CSV</button>
      </div>

      {showDupes ? (
        <div className="ad-card ad-card-pad" style={{ marginBottom: 12 }}>
          <h3 className="ad-sect-h" style={{ marginBottom: 6 }}>
            Possible duplicates
            <button className="ad-btn" style={{ marginLeft: "auto" }} onClick={() => setShowDupes(false)}>Close</button>
          </h3>
          {dupes.length === 0 ? (
            <p className="ad-note">None found. Contacts sharing only a website are not treated as duplicates — different people at one business, and agencies managing several, legitimately share a domain.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dupes.map((c, i) => (
                <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", borderTop: i ? "1px solid var(--ad-line)" : "none", paddingTop: i ? 10 : 0 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.primary.email} ← {c.duplicate.email}</div>
                    <div className="ad-note" style={{ margin: 0 }}>{c.reason} · {c.confidence} confidence</div>
                  </div>
                  <button className="ad-btn" disabled={!canWrite} onClick={() => merge(c.primary.id, c.duplicate.id)}>
                    Merge into first
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {loading ? <Loading rows={6} /> : rows.length === 0 ? (
        <Empty title="No contacts match">Try clearing the filters, or widen the date range.</Empty>
      ) : (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead>
              <tr>
                <Th col="created" sort={sort} dir={dir} onSort={onSort}>Added</Th>
                <Th>Who</Th>
                <Th>Business</Th>
                <Th col="score" sort={sort} dir={dir} onSort={onSort} numeric>Readable</Th>
                <Th numeric>Mentioned</Th>
                <Th numeric>Checks</Th>
                <Th>Source</Th>
                <Th>Stage</Th>
                <Th>Consent</Th>
                <Th col="followup" sort={sort} dir={dir} onSort={onSort}>Follow-up</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => openLead(l)}
                    tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") openLead(l); }}>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.name ?? "—"}</div>
                    <div className="ad-muted" style={{ fontSize: 12 }}>{l.email ?? "no email"}</div>
                  </td>
                  <td>
                    <div>{l.company ?? "—"}</div>
                    <div className="ad-muted" style={{ fontSize: 12 }}>{[l.business_type, l.area].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="ad-num" style={{ textAlign: "right" }}>{l.readiness_score === null ? "—" : `${l.readiness_score}/100`}</td>
                  <td className="ad-num" style={{ textAlign: "right" }}>{l.mentions === null ? "—" : `${l.mentions}/${l.mentions_total ?? "?"}`}</td>
                  <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(l.evaluationCount)}</td>
                  <td className="ad-muted" style={{ fontSize: 12 }}>{l.first_source ?? l.source ?? "—"}</td>
                  <td><Badge value={l.pipeline_status} /></td>
                  <td>{l.marketing_consent ? <span className="ad-badge customer">yes</span> : <span className="ad-badge">no</span>}</td>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{l.next_follow_up_at ? fmtDate(l.next_follow_up_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} size={size} total={total} onPage={setPage} />
        </div>
      )}

      {open ? (
        <>
          <div className="ad-drawer-scrim" onClick={() => setOpen(null)} />
          <aside className="ad-drawer" role="dialog" aria-label="Contact details">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <h2>{open.lead.company || open.lead.name || open.lead.email || "Contact"}</h2>
                <p className="ad-note" style={{ margin: 0 }}>
                  {[open.lead.email, open.lead.website, open.lead.business_type, open.lead.area].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button className="ad-btn" onClick={() => setOpen(null)}>Close</button>
            </div>

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "13px 0" }}>
              <Badge value={open.lead.pipeline_status} />
              <Badge value={open.lead.status} />
              {open.lead.marketing_consent
                ? <span className="ad-badge customer">consented {open.lead.consent_at ? fmtDate(open.lead.consent_at) : ""}</span>
                : <span className="ad-badge">no marketing consent</span>}
            </div>

            {!canWrite ? <p className="ad-note">You have read-only access, so these controls are disabled.</p> : null}

            <div className="ad-filters">
              <select className="ad-select" value={open.lead.pipeline_status} disabled={!canWrite || saving}
                      onChange={(e) => patch({ pipeline: e.target.value })} aria-label="Stage">
                {PIPELINE.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
              <input className="ad-input" placeholder="Owner" defaultValue={open.lead.owner ?? ""} disabled={!canWrite}
                     onBlur={(e) => { if (e.target.value !== (open.lead.owner ?? "")) patch({ owner: e.target.value }); }} aria-label="Owner" />
              <input className="ad-input" type="date" disabled={!canWrite}
                     defaultValue={open.lead.next_follow_up_at ? open.lead.next_follow_up_at.slice(0, 10) : ""}
                     onChange={(e) => patch({ nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                     aria-label="Next follow-up date" />
            </div>

            {open.evaluations.length ? (
              <div className="ad-sect" style={{ marginTop: 14 }}>
                <h3 className="ad-sect-h">Checks ({open.evaluations.length})</h3>
                <div className="ad-tablewrap">
                  <table className="ad-table" style={{ minWidth: 0 }}>
                    <tbody>
                      {open.evaluations.map((e, i) => (
                        <tr key={i}>
                          <td className="ad-muted ad-num" style={{ whiteSpace: "nowrap" }}>{fmtDate(String(e.started_at))}</td>
                          <td><Badge value={String(e.status)} /></td>
                          <td className="ad-num">{e.readiness_score === null ? "—" : `${e.readiness_score}/100 readable`}</td>
                          <td className="ad-num">{e.mentions === null ? "—" : `${e.mentions}/${e.mentions_total} mentioned`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {open.payments.length ? (
              <div className="ad-sect">
                <h3 className="ad-sect-h">Payments</h3>
                <div className="ad-tablewrap">
                  <table className="ad-table" style={{ minWidth: 0 }}>
                    <tbody>
                      {open.payments.map((p, i) => (
                        <tr key={i}>
                          <td className="ad-muted ad-num">{fmtDate(String(p.occurred_at))}</td>
                          <td><Badge value={String(p.kind)} /></td>
                          <td className="ad-num">{fmtMoney(Number(p.amount_pence), String(p.currency))}</td>
                          <td className="ad-muted">{String(p.plan ?? "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="ad-sect">
              <h3 className="ad-sect-h">Notes</h3>
              <textarea className="ad-input" style={{ width: "100%", minHeight: 74 }} value={notes} disabled={!canWrite}
                        onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" aria-label="Notes" />
              <button className="ad-btn amber" style={{ marginTop: 7 }} disabled={!canWrite || saving}
                      onClick={() => patch({ notes })}>Save note</button>
            </div>

            <div className="ad-sect">
              <h3 className="ad-sect-h">Activity</h3>
              {open.timeline.length === 0 ? <p className="ad-note">Nothing recorded yet.</p> : (
                <div className="ad-timeline">
                  {open.timeline.slice(0, 60).map((t, i) => (
                    <div className="ad-tl-item" key={i}>
                      <div className="ad-tl-when">{fmtDate(t.at, true)}</div>
                      <div className="ad-tl-what">{t.label}</div>
                      {t.detail ? <div className="ad-tl-detail">{t.detail}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
