"use client";

import { useCallback, useEffect, useState } from "react";
import Overview, { type OverviewData } from "@/components/admin/Overview";
import Visitors from "@/components/admin/Visitors";
import Leads from "@/components/admin/Leads";
import Evaluations from "@/components/admin/Evaluations";
import Customers from "@/components/admin/Customers";
import Businesses from "@/components/admin/Businesses";
import Campaigns from "@/components/admin/Campaigns";
import FollowUps from "@/components/admin/FollowUps";
import Settings from "@/components/admin/Settings";
import { ErrorBox } from "@/components/admin/ui";

/* The dashboard shell.
 *
 * Auth is a magic link sent through Resend. The browser holds nothing but an
 * httpOnly cookie it cannot read; every figure comes from a server route that
 * verifies the cookie's signature and re-checks the allowlist on every call.
 * Hiding a control here changes what is shown, never what is permitted —
 * the authorisation is server-side in each route.
 *
 * Dates and period boundaries are Europe/London throughout.
 */

type Tab = "overview" | "visitors" | "leads" | "evaluations" | "customers" | "businesses" | "campaigns" | "followups" | "settings";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "visitors", label: "Visitors" },
  { id: "leads", label: "Leads" },
  { id: "evaluations", label: "Checks" },
  { id: "customers", label: "Customers & Billing" },
  { id: "businesses", label: "Businesses" },
  { id: "campaigns", label: "Campaigns" },
  { id: "followups", label: "Follow-ups" },
  { id: "settings", label: "Settings" },
];

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
];

export default function AdminPage() {
  const [me, setMe] = useState<{ email: string; role: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // set when another tab deep-links into Checks (e.g. a visitor's row)
  const [checksQuery, setChecksQuery] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.email ? { email: d.email, role: d.role ?? "owner" } : null))
      .finally(() => setReady(true));
    if (new URLSearchParams(window.location.search).get("err") === "link") {
      setAuthErr("That sign-in link was invalid or had expired. Request a fresh one.");
    }
  }, []);

  /* The session cookie travels automatically; nothing is held in JS. A 401
   * means the cookie is gone or the address left the allowlist. */
  const call = useCallback(async (path: string, init?: RequestInit): Promise<Response | null> => {
    try {
      const res = await fetch(path, {
        ...init,
        headers: { ...(init?.headers ?? {}), "Content-Type": "application/json" },
      });
      if (res.status === 401) { setDenied(true); return null; }
      setDenied(false);
      return res;
    } catch {
      return null;
    }
  }, []);

  const rangeQs = useCallback(() => {
    const p = new URLSearchParams({ range });
    if (range === "custom" && from && to) { p.set("from", from); p.set("to", to); }
    return p.toString();
  }, [range, from, to]);

  const loadOverview = useCallback(async () => {
    setLoading(true); setErr(null);
    const res = await call(`/api/admin/overview?${rangeQs()}`);
    if (!res) { setLoading(false); return; }
    if (!res.ok) { setErr("Could not load the overview."); setLoading(false); return; }
    const d = await res.json();
    setOverview(d);
    if (d.role) setMe((m) => (m ? { ...m, role: d.role } : m));
    setLoading(false);
  }, [call, rangeQs]);

  useEffect(() => {
    if (!me || tab !== "overview") return;
    void loadOverview();
  }, [me, tab, loadOverview]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setSent(true);
    else setAuthErr("Could not send that just now. Try again shortly.");
  };

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setMe(null);
  };

  if (!ready) {
    return (
      <div className="ad">
        <div className="ad-main"><div className="ad-skel" style={{ width: 200, height: 14 }} /></div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="ad">
        <div className="ad-main" style={{ maxWidth: 420, margin: "0 auto", paddingTop: 72 }}>
          <h1 className="ad-h1">BiLabs admin</h1>
          <p className="ad-sub">Sign in with a link sent to your email.</p>
          {authErr ? <ErrorBox message={authErr} /> : null}
          {sent ? (
            <div className="ad-card ad-card-pad" style={{ marginTop: 16 }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                If that address can access the admin, a sign-in link is on its way. It expires in 15 minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={signIn} style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                className="ad-input" style={{ flex: 1 }} type="email" required autoFocus
                placeholder="you@bilabs.ai" value={email} onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
              />
              <button className="ad-btn primary" type="submit">Send link</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const canWrite = me.role === "owner" || me.role === "admin";
  const isOwner = me.role === "owner";
  const counts: Partial<Record<Tab, number>> = overview
    ? {
        leads: overview.contacts.total,
        evaluations: overview.evaluations.started.value,
        customers: overview.mrr?.activeCount ?? 0,
        businesses: (overview.businesses?.live ?? 0) + (overview.businesses?.processing ?? 0),
      }
    : {};

  return (
    <div className="ad">
      <div className="ad-shell">
        <nav className="ad-side" aria-label="Dashboard sections">
          <div className="ad-brand">BiLabs</div>
          {TABS.map((t) => (
            <button
              key={t.id} className="ad-navbtn" onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
              {counts[t.id] ? <span className="ad-pill">{counts[t.id]}</span> : null}
            </button>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 14 }}>
            <p className="ad-note" style={{ margin: "0 0 7px" }}>
              {me.email}
              <br />
              <span className="ad-badge">{me.role}</span>
            </p>
            <button className="ad-btn" onClick={signOut} style={{ width: "100%" }}>Sign out</button>
          </div>
        </nav>

        <main className="ad-main">
          <div className="ad-head">
            <div>
              <h1 className="ad-h1">{TABS.find((t) => t.id === tab)?.label}</h1>
              <p className="ad-sub">All dates and reporting boundaries are Europe/London.</p>
            </div>

            {tab !== "settings" && tab !== "followups" && tab !== "businesses" ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div className="ad-tabs" role="group" aria-label="Date range">
                  {RANGES.map((r) => (
                    <button key={r.id} className="ad-tab" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                      {r.label}
                    </button>
                  ))}
                </div>
                {range === "custom" ? (
                  <>
                    <input className="ad-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                    <input className="ad-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {denied ? <ErrorBox message="Your session has expired or your access was removed. Sign in again." /> : null}

          {tab === "overview" ? (
            <Overview data={overview} loading={loading} error={err} onRetry={loadOverview} onGo={(t) => setTab(t as Tab)} />
          ) : null}
          {tab === "visitors" ? (
            <Visitors call={call} range={rangeQs()} onOpenCheck={(domain) => { setChecksQuery(domain); setTab("evaluations"); }} />
          ) : null}
          {tab === "leads" ? <Leads call={call} range={rangeQs()} canWrite={canWrite} /> : null}
          {tab === "evaluations" ? <Evaluations call={call} range={range} canWrite={canWrite} initialQuery={checksQuery} /> : null}
          {tab === "customers" ? <Customers call={call} range={range} isOwner={isOwner} /> : null}
          {tab === "businesses" ? <Businesses call={call} canWrite={canWrite} /> : null}
          {tab === "campaigns" ? <Campaigns call={call} range={range} /> : null}
          {tab === "followups" ? <FollowUps call={call} canWrite={canWrite} /> : null}
          {tab === "settings" ? <Settings call={call} isOwner={isOwner} /> : null}
        </main>
      </div>
    </div>
  );
}
