"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorBox, Loading, fmtDate } from "./ui";

/* Settings, roles, integration health, retention and the audit log.
 *
 * Integration health says whether a credential works. It never shows the
 * value, a prefix or a length — a dashboard that reveals part of a secret
 * leaks it to anyone who sees a screenshot. */

type Data = {
  settings: {
    respectDnt: boolean; retentionDays: number; attributionWindowDays: number;
    internalIpHashes: string[];
    notify: { newLead: boolean; newCustomer: boolean; evaluationFailures: boolean; emailFailures: boolean; to: string };
  };
  integrations: Array<{ id: string; label: string; configured: boolean; ok: boolean | null; detail: string }>;
  admins: Array<{ email: string; role: string; last_login_at: string | null }>;
  allowlist: string[];
  auditLog: Array<{ actor: string; action: string; target_type: string | null; target_id: string | null; created_at: string }>;
  role: string;
  notes: Record<string, string>;
};

export default function Settings({
  call, isOwner,
}: { call: (p: string, i?: RequestInit) => Promise<Response | null>; isOwner: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ip, setIp] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const res = await call("/api/admin/settings");
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load settings."); setLoading(false); return; }
    setD(await res.json()); setLoading(false);
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Record<string, unknown>) => {
    setMsg(null);
    const res = await call("/api/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });
    if (!res) return;
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Saved." : (j.error ?? "That change was refused."));
    if (res.ok) await load();
  };

  const setRole = async (email: string, role: string) => {
    setMsg(null);
    const res = await call("/api/admin/settings", { method: "POST", body: JSON.stringify({ email, role }) });
    const j = await res?.json().catch(() => ({}));
    setMsg(res?.ok ? "Role updated." : (j?.error ?? "Could not change that role."));
    if (res?.ok) await load();
  };

  if (err) return <ErrorBox message={err} onRetry={load} />;
  if (loading && !d) return <Loading rows={6} />;
  if (!d) return null;

  return (
    <>
      {msg ? <div className="ad-card" style={{ marginBottom: 12, fontSize: 13 }}>{msg}</div> : null}
      {!isOwner ? (
        <div className="ad-card" style={{ marginBottom: 12 }}>
          <p className="ad-note" style={{ margin: 0 }}>
            You are signed in as <b>{d.role}</b>. Settings are owner-only, so these controls are read-only for you.
          </p>
        </div>
      ) : null}

      <div className="ad-sect">
        <h3 className="ad-sect-h">Integration health</h3>
        <div className="ad-tablewrap">
          <table className="ad-table" style={{ minWidth: 0 }}>
            <tbody>
              {d.integrations.map((i) => (
                <tr key={i.id}>
                  <td style={{ width: 20 }}>
                    <span className={`ad-dot ${i.ok === true ? "ok" : i.ok === false ? "bad" : "unknown"}`} />
                  </td>
                  <td style={{ fontWeight: 600, width: 150 }}>{i.label}</td>
                  <td className="ad-muted" style={{ fontSize: 12.5 }}>{i.detail}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="ad-badge">{i.ok === true ? "working" : i.ok === false ? "failing" : i.configured ? "configured" : "not connected"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ad-def">{d.notes.secrets}</p>
      </div>

      <div className="ad-sect ad-two">
        <div className="ad-card ad-card-pad">
          <h3 className="ad-sect-h">Tracking &amp; privacy</h3>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 12, cursor: isOwner ? "pointer" : "default" }}>
            <input type="checkbox" checked={d.settings.respectDnt} disabled={!isOwner}
                   onChange={(e) => save({ respectDnt: e.target.checked })} />
            <span>
              <b style={{ fontSize: 13 }}>Respect Do Not Track / GPC</b>
              <div className="ad-note" style={{ margin: 0 }}>When on, nothing at all is recorded for visitors who send those signals.</div>
            </span>
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <b style={{ fontSize: 13 }}>Attribution window</b>
            <div className="ad-note" style={{ margin: "0 0 5px" }}>How long after a visit a later conversion is still credited to it.</div>
            <input className="ad-input" type="number" min={1} max={180} defaultValue={d.settings.attributionWindowDays} disabled={!isOwner}
                   onBlur={(e) => { const v = Number(e.target.value); if (v !== d.settings.attributionWindowDays) save({ attributionWindowDays: v }); }}
                   aria-label="Attribution window in days" style={{ width: 90 }} /> <span className="ad-muted">days</span>
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <b style={{ fontSize: 13 }}>Retention</b>
            <div className="ad-note" style={{ margin: "0 0 5px" }}>{d.notes.retention} 0 keeps everything.</div>
            <input className="ad-input" type="number" min={0} max={3650} defaultValue={d.settings.retentionDays} disabled={!isOwner}
                   onBlur={(e) => { const v = Number(e.target.value); if (v !== d.settings.retentionDays) save({ retentionDays: v }); }}
                   aria-label="Retention in days" style={{ width: 90 }} /> <span className="ad-muted">days</span>
          </label>

          <div>
            <b style={{ fontSize: 13 }}>Internal traffic</b>
            <div className="ad-note" style={{ margin: "0 0 5px" }}>
              {d.settings.internalIpHashes.length} address{d.settings.internalIpHashes.length === 1 ? "" : "es"} excluded.
              Stored only as a salted hash — the address itself is never kept.
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <input className="ad-input" placeholder="Add an IP to exclude" value={ip} disabled={!isOwner}
                     onChange={(e) => setIp(e.target.value)} aria-label="IP to exclude" />
              <button className="ad-btn" disabled={!isOwner || !ip.trim()}
                      onClick={() => { save({ internalIps: [ip.trim()] }); setIp(""); }}>Add</button>
              <button className="ad-btn" disabled={!isOwner}
                      title="The server reads your address from its own headers and stores only a hash"
                      onClick={() => save({ excludeSelf: true })}>Exclude my current IP</button>
            </div>
            <p className="ad-def">
              Anyone signed in to this dashboard is already excluded automatically. &ldquo;Exclude my current IP&rdquo;
              covers the same network when you are signed out — your other browsers, phone and anyone on your wifi.
            </p>
          </div>
        </div>

        <div className="ad-card ad-card-pad">
          <h3 className="ad-sect-h">Notifications</h3>
          {([
            ["newLead", "A new lead arrives"],
            ["newCustomer", "Someone becomes a paying customer"],
            ["evaluationFailures", "Checks start failing"],
            ["emailFailures", "An email fails to deliver"],
          ] as const).map(([k, label]) => (
            <label key={k} style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 9, cursor: isOwner ? "pointer" : "default" }}>
              <input type="checkbox" disabled={!isOwner}
                     checked={d.settings.notify[k]}
                     onChange={(e) => save({ notify: { ...d.settings.notify, [k]: e.target.checked } })} />
              <span style={{ fontSize: 13 }}>{label}</span>
            </label>
          ))}
          <label style={{ display: "block", marginTop: 10 }}>
            <b style={{ fontSize: 13 }}>Send alerts to</b>
            <input className="ad-input" style={{ width: "100%", marginTop: 5 }} defaultValue={d.settings.notify.to} disabled={!isOwner}
                   onBlur={(e) => { if (e.target.value !== d.settings.notify.to) save({ notify: { ...d.settings.notify, to: e.target.value } }); }}
                   aria-label="Alert recipient" />
          </label>
        </div>
      </div>

      <div className="ad-sect">
        <h3 className="ad-sect-h">Who can get in</h3>
        <div className="ad-tablewrap">
          <table className="ad-table" style={{ minWidth: 0 }}>
            <thead><tr><th>Email</th><th>Role</th><th>Last signed in</th></tr></thead>
            <tbody>
              {d.allowlist.map((email) => {
                const row = d.admins.find((a) => a.email === email);
                return (
                  <tr key={email}>
                    <td>{email}</td>
                    <td>
                      <select className="ad-select" value={row?.role ?? "owner"} disabled={!isOwner}
                              onChange={(e) => setRole(email, e.target.value)} aria-label={`Role for ${email}`}>
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="readonly">read-only</option>
                      </select>
                    </td>
                    <td className="ad-num ad-muted">{row?.last_login_at ? fmtDate(row.last_login_at, true) : "never"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ad-def">{d.notes.allowlist}</p>
        <p className="ad-def">{d.notes.roles}</p>
      </div>

      <div className="ad-sect">
        <h3 className="ad-sect-h">Audit log</h3>
        {d.auditLog.length === 0 ? (
          <Empty title="No admin changes recorded yet">Sensitive changes are logged here as they happen.</Empty>
        ) : (
          <div className="ad-tablewrap">
            <table className="ad-table" style={{ minWidth: 0 }}>
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr></thead>
              <tbody>
                {d.auditLog.map((a, i) => (
                  <tr key={i}>
                    <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.created_at, true)}</td>
                    <td>{a.actor}</td>
                    <td><span className="ad-badge">{a.action}</span></td>
                    <td className="ad-mono ad-muted">{a.target_type ? `${a.target_type}:${(a.target_id ?? "").slice(0, 8)}` : "—"}</td>
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
