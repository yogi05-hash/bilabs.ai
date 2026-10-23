"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorBox, Loading, Pager, Th, fmtDate, fmtNum, ago } from "./ui";

/* Visitors.
 *
 * Anonymous by default and anonymous on screen: the label is a short slice of
 * our own random cookie id, which identifies nobody. An email appears only
 * where the person typed one into a form themselves. */

type V = {
  id: string; label: string; first_seen_at: string; last_seen_at: string;
  visit_count: number; page_views: number; landing_path: string | null; last_path: string | null;
  referrer_host: string | null; channel: string; utm_campaign: string | null;
  device: string | null; country: string | null; returning: boolean;
  identified_at: string | null; is_bot: boolean; is_internal: boolean; is_test: boolean;
  contact: { id: string; email: string | null; company: string | null } | null;
  checked: { id: string; website: string | null; business_name: string | null; readiness_score: number | null; mentions: number | null; mentions_total: number | null } | null;
};

export default function Visitors({
  call, range, onOpenCheck,
}: {
  call: (p: string, i?: RequestInit) => Promise<Response | null>;
  range: string;
  /** jump to the Checks tab filtered to this domain */
  onOpenCheck: (domain: string) => void;
}) {
  const [rows, setRows] = useState<V[]>([]);
  const [limits, setLimits] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const size = 25;
  const [sort, setSort] = useState("last");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [device, setDevice] = useState("");
  const [identified, setIdentified] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const p = new URLSearchParams({ range, page: String(page), size: String(size), sort, dir });
    if (device) p.set("device", device);
    if (identified) p.set("identified", "1");
    if (excluded) p.set("excluded", "1");
    const res = await call(`/api/admin/visitors?${p}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load visitors."); setLoading(false); return; }
    const d = await res.json();
    setRows(d.visitors ?? []); setTotal(d.total ?? 0); setLimits(d.limitations ?? []); setLoading(false);
  }, [call, range, page, sort, dir, device, identified, excluded]);

  useEffect(() => { void load(); }, [load]);

  const onSort = (c: string) => { if (c === sort) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(c); setDir("desc"); } setPage(0); };

  return (
    <>
      {err ? <ErrorBox message={err} onRetry={load} /> : null}

      <div className="ad-filters">
        <select className="ad-select" value={device} onChange={(e) => { setDevice(e.target.value); setPage(0); }} aria-label="Filter by device">
          <option value="">All devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
        <label className="ad-btn" style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <input type="checkbox" checked={identified} onChange={(e) => { setIdentified(e.target.checked); setPage(0); }} />
          Identified only
        </label>
        <label className="ad-btn" style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <input type="checkbox" checked={excluded} onChange={(e) => { setExcluded(e.target.checked); setPage(0); }} />
          Show bots &amp; internal
        </label>
      </div>

      {loading ? <Loading rows={6} /> : rows.length === 0 ? (
        <Empty title="No visitors recorded in this period">
          Visitor tracking records a first-party cookie id on arrival. If this is new, the first visits will appear shortly.
        </Empty>
      ) : (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead>
              <tr>
                <Th>Visitor</Th>
                <Th col="first" sort={sort} dir={dir} onSort={onSort}>First seen</Th>
                <Th col="last" sort={sort} dir={dir} onSort={onSort}>Last activity</Th>
                <Th col="visits" sort={sort} dir={dir} onSort={onSort} numeric>Visits</Th>
                <Th col="views" sort={sort} dir={dir} onSort={onSort} numeric>Views</Th>
                <Th>Checked</Th>
                <Th>Landed on</Th>
                <Th>Source</Th>
                <Th>Device</Th>
                <Th>Country</Th>
                <Th>Identified</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="ad-mono">{v.label}…</span>
                    <div style={{ fontSize: 11 }} className="ad-muted">
                      {v.returning ? "returning" : "new"}
                      {v.is_bot ? " · bot" : ""}{v.is_internal ? " · internal" : ""}{v.is_test ? " · non-production" : ""}
                    </div>
                  </td>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(v.first_seen_at, true)}</td>
                  <td className="ad-num ad-muted" style={{ whiteSpace: "nowrap" }}>{ago(v.last_seen_at)}</td>
                  <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(v.visit_count)}</td>
                  <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(v.page_views)}</td>
                  <td style={{ fontSize: 12 }}>
                    {v.checked?.website ? (
                      <button
                        className="ad-row-btn"
                        onClick={() => onOpenCheck(v.checked!.website!.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))}
                        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", color: "var(--ad-amber-2)", fontWeight: 600, textAlign: "left" }}
                        title="Open this check"
                      >
                        {v.checked.website.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}
                        {v.checked.readiness_score !== null ? <span className="ad-muted" style={{ fontWeight: 400 }}> · {v.checked.readiness_score}/100</span> : null}
                      </button>
                    ) : v.checked ? (
                      <span className="ad-muted">{v.checked.business_name ?? "no website given"}</span>
                    ) : (
                      <span className="ad-muted">—</span>
                    )}
                  </td>
                  <td className="ad-muted" style={{ fontSize: 12 }}>{v.landing_path ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {v.channel}
                    {v.utm_campaign ? <div className="ad-muted" style={{ fontSize: 11 }}>{v.utm_campaign}</div> : null}
                  </td>
                  <td className="ad-muted" style={{ fontSize: 12 }}>{v.device ?? "—"}</td>
                  <td className="ad-muted" style={{ fontSize: 12 }}>{v.country ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {v.contact?.email
                      ? <span title={`Identified ${fmtDate(v.identified_at, true)}`}>{v.contact.email}</span>
                      : <span className="ad-muted">anonymous</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} size={size} total={total} onPage={setPage} />
        </div>
      )}

      <div className="ad-card ad-card-pad ad-sect">
        <h3 className="ad-sect-h">How this is measured, and what it cannot tell you</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {limits.map((l, i) => <li key={i} className="ad-def" style={{ marginBottom: 5 }}>{l}</li>)}
        </ul>
      </div>
    </>
  );
}
