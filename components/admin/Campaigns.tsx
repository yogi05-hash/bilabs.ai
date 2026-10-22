"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorBox, Loading, fmtMoney, fmtNum } from "./ui";

/* Campaigns, and a UTM link builder.
 *
 * First-touch and latest-touch are separate tables because they answer
 * different questions. Nothing is blended, and revenue with no linked
 * first-touch visitor is reported as unknown rather than spread about. */

type Row = { key: string; visitors: number; leads: number; evaluations: number; customers: number; revenuePence: number };
type Data = {
  period: { label: string };
  firstTouch: { bySourceMedium: Row[]; byCampaign: Row[]; byLandingPage: Row[] };
  latestTouch: Array<{ key: string; leads: number; customers: number }>;
  unattributed: { revenuePence: number; payments: number };
  notes: Record<string, string>;
};

const PRESETS = ["linkedin", "instagram", "x", "google", "email", "referral", "facebook", "youtube"];

function Table({ rows, label }: { rows: Row[]; label: string }) {
  if (!rows.length) return <Empty title={`No ${label} data yet`}>This fills as tagged traffic arrives.</Empty>;
  return (
    <div className="ad-tablewrap">
      <table className="ad-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th style={{ textAlign: "right" }}>Visitors</th>
            <th style={{ textAlign: "right" }}>Leads</th>
            <th style={{ textAlign: "right" }}>Checks</th>
            <th style={{ textAlign: "right" }}>Customers</th>
            <th style={{ textAlign: "right" }}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ wordBreak: "break-word" }}>{r.key}</td>
              <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(r.visitors)}</td>
              <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(r.leads)}</td>
              <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(r.evaluations)}</td>
              <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(r.customers)}</td>
              <td className="ad-num" style={{ textAlign: "right" }}>{r.revenuePence ? fmtMoney(r.revenuePence) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Campaigns({ call, range }: { call: (p: string, i?: RequestInit) => Promise<Response | null>; range: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"source" | "campaign" | "landing">("source");

  const [url, setUrl] = useState("https://bilabs.ai/");
  const [src, setSrc] = useState("linkedin");
  const [med, setMed] = useState("social");
  const [camp, setCamp] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const res = await call(`/api/admin/campaigns?range=${range}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load campaigns."); setLoading(false); return; }
    setD(await res.json()); setLoading(false);
  }, [call, range]);

  useEffect(() => { void load(); }, [load]);

  let built = "";
  try {
    const u = new URL(url);
    if (src) u.searchParams.set("utm_source", src);
    if (med) u.searchParams.set("utm_medium", med);
    if (camp) u.searchParams.set("utm_campaign", camp);
    built = u.toString();
  } catch {
    built = "";
  }

  if (err) return <ErrorBox message={err} onRetry={load} />;
  if (loading && !d) return <Loading rows={6} />;
  if (!d) return null;

  const rows = view === "source" ? d.firstTouch.bySourceMedium : view === "campaign" ? d.firstTouch.byCampaign : d.firstTouch.byLandingPage;
  const label = view === "source" ? "Source / medium" : view === "campaign" ? "Campaign" : "Landing page";

  return (
    <>
      <div className="ad-filters">
        <div className="ad-tabs">
          {(["source", "campaign", "landing"] as const).map((v) => (
            <button key={v} className="ad-tab" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "source" ? "Source / medium" : v === "campaign" ? "Campaign" : "Landing page"}
            </button>
          ))}
        </div>
        <span className="ad-note" style={{ margin: 0 }}>First-touch attribution · {d.period.label.toLowerCase()}</span>
      </div>

      <Table rows={rows} label={label} />

      {d.unattributed.payments > 0 ? (
        <div className="ad-card" style={{ marginTop: 12 }}>
          <p className="ad-k">Unattributed revenue</p>
          <p className="ad-v ad-v-sm">{fmtMoney(d.unattributed.revenuePence)}</p>
          <p className="ad-note">
            {d.unattributed.payments} payment{d.unattributed.payments === 1 ? "" : "s"} with no linked first-touch
            visitor. Reported as unknown rather than assigned to a channel.
          </p>
        </div>
      ) : null}

      <div className="ad-sect">
        <h3 className="ad-sect-h">Latest touch</h3>
        {d.latestTouch.length === 0 ? (
          <Empty title="No latest-touch data yet" />
        ) : (
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead><tr><th>Source</th><th style={{ textAlign: "right" }}>Leads</th><th style={{ textAlign: "right" }}>Customers</th></tr></thead>
              <tbody>
                {d.latestTouch.map((r) => (
                  <tr key={r.key}>
                    <td>{r.key}</td>
                    <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(r.leads)}</td>
                    <td className="ad-num" style={{ textAlign: "right" }}>{fmtNum(r.customers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ad-card ad-card-pad ad-sect">
        <h3 className="ad-sect-h">UTM link builder</h3>
        <div className="ad-filters" style={{ marginBottom: 8 }}>
          <input className="ad-input grow" value={url} onChange={(e) => { setUrl(e.target.value); setCopied(false); }} placeholder="https://bilabs.ai/" aria-label="Destination URL" />
          <select className="ad-select" value={src} onChange={(e) => { setSrc(e.target.value); setCopied(false); }} aria-label="utm_source">
            {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="ad-input" value={med} onChange={(e) => { setMed(e.target.value); setCopied(false); }} placeholder="utm_medium" aria-label="utm_medium" style={{ width: 130 }} />
          <input className="ad-input" value={camp} onChange={(e) => { setCamp(e.target.value); setCopied(false); }} placeholder="utm_campaign" aria-label="utm_campaign" style={{ width: 160 }} />
        </div>
        {built ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code className="ad-mono" style={{ flex: "1 1 260px", background: "rgba(17,17,18,.04)", padding: "8px 10px", borderRadius: 8, wordBreak: "break-all" }}>{built}</code>
            <button className="ad-btn amber" onClick={() => { void navigator.clipboard.writeText(built); setCopied(true); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : <p className="ad-note">That URL is not valid.</p>}
      </div>

      <div className="ad-card ad-card-pad ad-sect">
        <h3 className="ad-sect-h">How attribution works here</h3>
        <div className="ad-defs">
          {Object.entries(d.notes).map(([k, v]) => <p className="ad-def" key={k}><b>{k}</b> — {v}</p>)}
        </div>
      </div>
    </>
  );
}
