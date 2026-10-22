"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, ErrorBox, Loading, fmtDate, fmtNum } from "./ui";

/* Follow-ups, report delivery and email health.
 *
 * Requested report delivery is kept visibly separate from marketing. A report
 * someone asked for is owed to them whatever their marketing preference; a
 * marketing email is not. */

type FU = {
  id: string; title: string; kind: string; owner: string | null; due_at: string | null;
  status: string; notes: string | null; created_at: string;
  contact: { id: string; email: string | null; company: string | null; marketing_consent: boolean } | null;
};
type Data = {
  followUps: FU[];
  pendingReports: Array<{ id: string; website: string | null; completed_at: string | null }>;
  emailFailures: Array<{ id: string; email: string | null; kind: string; error: string | null; created_at: string }>;
  recentEmails: Array<{ id: string; email: string | null; kind: string; subject: string | null; status: string; created_at: string }>;
  suppressedCount: number;
  marketingDrafts: { enabled: boolean; note: string; sequences: Array<{ id: string; name: string; steps: number; status: string; requiresConsent: boolean }> };
  rules: Record<string, string>;
};

export default function FollowUps({
  call, canWrite,
}: { call: (p: string, i?: RequestInit) => Promise<Response | null>; canWrite: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("open");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const res = await call(`/api/admin/followups?status=${filter}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load follow-ups."); setLoading(false); return; }
    setD(await res.json()); setLoading(false);
  }, [call, filter]);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    const res = await call("/api/admin/followups", {
      method: "POST",
      body: JSON.stringify({ title, dueAt: due ? new Date(due).toISOString() : null }),
    });
    if (res?.ok) { setTitle(""); setDue(""); await load(); }
  };

  const complete = async (id: string, status: string) => {
    const res = await call("/api/admin/followups", { method: "PATCH", body: JSON.stringify({ id, status }) });
    if (res?.ok) await load();
  };

  if (err) return <ErrorBox message={err} onRetry={load} />;
  if (loading && !d) return <Loading rows={6} />;
  if (!d) return null;

  const now = Date.now();

  return (
    <>
      <div className="ad-filters">
        <input className="ad-input grow" placeholder="New follow-up…" value={title} disabled={!canWrite}
               onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-label="New follow-up title" />
        <input className="ad-input" type="date" value={due} disabled={!canWrite} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <button className="ad-btn primary" onClick={add} disabled={!canWrite || !title.trim()}>Add</button>
        <select className="ad-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          <option value="open">Open</option><option value="done">Done</option><option value="all">All</option>
        </select>
      </div>

      {d.followUps.length === 0 ? (
        <Empty title="No follow-ups">Add one above, or set a follow-up date on a contact.</Empty>
      ) : (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead><tr><th>Task</th><th>Contact</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
            <tbody>
              {d.followUps.map((f) => {
                const overdue = f.status === "open" && f.due_at && new Date(f.due_at).getTime() < now;
                return (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.title}</div>
                      {f.kind === "report_delivery" ? <span className="ad-badge">requested report — not marketing</span> : null}
                    </td>
                    <td className="ad-muted" style={{ fontSize: 12 }}>{f.contact?.email ?? "—"}</td>
                    <td className="ad-muted" style={{ fontSize: 12 }}>{f.owner ?? "—"}</td>
                    <td className="ad-num" style={{ whiteSpace: "nowrap", color: overdue ? "var(--ad-bad)" : undefined }}>
                      {f.due_at ? fmtDate(f.due_at) : "—"}{overdue ? " · overdue" : ""}
                    </td>
                    <td><Badge value={f.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      {f.status === "open"
                        ? <button className="ad-btn" disabled={!canWrite} onClick={() => complete(f.id, "done")}>Done</button>
                        : <button className="ad-btn" disabled={!canWrite} onClick={() => complete(f.id, "open")}>Reopen</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="ad-sect ad-two">
        <div>
          <h3 className="ad-sect-h">Reports requested but not yet sent</h3>
          {d.pendingReports.length === 0 ? (
            <Empty title="Nothing outstanding">Every completed check with a contact has had its report emailed.</Empty>
          ) : (
            <div className="ad-tablewrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <tbody>
                  {d.pendingReports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.website ?? "—"}</td>
                      <td className="ad-num ad-muted" style={{ textAlign: "right" }}>{fmtDate(r.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="ad-sect-h">Email delivery</h3>
          {d.emailFailures.length === 0 ? (
            <Empty title="No delivery failures">{fmtNum(d.recentEmails.length)} recent sends, all accepted.</Empty>
          ) : (
            <div className="ad-tablewrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <tbody>
                  {d.emailFailures.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{e.email ?? "—"}</div>
                        <div className="ad-muted" style={{ fontSize: 12 }}>{e.kind} — {e.error ?? "no error recorded"}</div>
                      </td>
                      <td className="ad-num ad-muted" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="ad-card ad-card-pad ad-sect" style={{ borderColor: "rgba(245,183,49,.5)" }}>
        <h3 className="ad-sect-h">Marketing sequences — drafts, switched off</h3>
        <p className="ad-note" style={{ marginTop: 0 }}>{d.marketingDrafts.note}</p>
        <div className="ad-tablewrap" style={{ marginTop: 10 }}>
          <table className="ad-table" style={{ minWidth: 0 }}>
            <tbody>
              {d.marketingDrafts.sequences.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="ad-muted">{s.steps} step{s.steps === 1 ? "" : "s"}</td>
                  <td><span className="ad-badge abandoned">{s.status}</span></td>
                  <td className="ad-muted" style={{ fontSize: 12 }}>requires consent</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ad-def" style={{ marginTop: 10 }}>
          {fmtNum(d.suppressedCount)} contact{d.suppressedCount === 1 ? " is" : "s are"} suppressed from marketing —
          unsubscribed, or never consented.
        </p>
      </div>

      <div className="ad-card ad-card-pad ad-sect">
        <h3 className="ad-sect-h">The rules these follow</h3>
        <div className="ad-defs">
          {Object.entries(d.rules).map(([k, v]) => <p className="ad-def" key={k}><b>{k}</b> — {v}</p>)}
        </div>
      </div>
    </>
  );
}
