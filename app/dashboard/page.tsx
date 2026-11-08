"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBox } from "@/components/admin/ui";
import Setup from "@/components/dashboard/Setup";
import Status from "@/components/dashboard/Status";
import Results from "@/components/dashboard/Results";
import Snippets from "@/components/dashboard/Snippets";
import Profile from "@/components/dashboard/Profile";
import Billing from "@/components/dashboard/Billing";
import type { Me } from "@/components/dashboard/types";

/* The customer dashboard.
 *
 * Same shape as the admin: a magic link, an httpOnly cookie the page never
 * reads, and every figure from a server route that re-checks the cookie and
 * the subscription on each call. Until setup is finished the only tabs are
 * Setup and Billing; the rest appear once a profile exists. */

type Tab = "setup" | "overview" | "results" | "snippets" | "profile" | "billing";

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);

  const call = useCallback(async (path: string, init?: RequestInit): Promise<Response | null> => {
    try {
      const res = await fetch(path, { ...init, headers: { ...(init?.headers ?? {}), "Content-Type": "application/json" }, cache: "no-store" });
      if (res.status === 401) { setDenied(true); return null; }
      setDenied(false);
      return res;
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    const d = res.ok ? ((await res.json()) as Me) : null;
    setMe(d);
    setTab((t) => t ?? (d?.business && d.business.status !== "onboarding" ? "overview" : "setup"));
  }, []);

  useEffect(() => {
    void load().finally(() => setReady(true));
    if (new URLSearchParams(window.location.search).get("err") === "link") {
      setAuthErr("That sign-in link was invalid or had expired. Request a fresh one below.");
    }
  }, [load]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(null);
    const res = await fetch("/api/me/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) setSent(true); else setAuthErr("Could not send that just now. Try again shortly.");
  };

  const signOut = async () => {
    await fetch("/api/me/logout", { method: "POST" });
    setMe(null);
  };

  if (!ready) {
    return <div className="ad"><div className="ad-main"><div className="ad-skel" style={{ width: 200, height: 14 }} /></div></div>;
  }

  if (!me) {
    return (
      <div className="ad">
        <div className="ad-main" style={{ maxWidth: 440, margin: "0 auto", paddingTop: 72 }}>
          <h1 className="ad-h1">Your BiLabs dashboard</h1>
          <p className="ad-sub">Sign in with a link sent to the email you paid with. No password.</p>
          {authErr ? <ErrorBox message={authErr} /> : null}
          {sent ? (
            <div className="ad-card ad-card-pad" style={{ marginTop: 16 }}>
              <p style={{ margin: 0, fontSize: 14 }}>If that address has a BiLabs subscription, a sign-in link is on its way. It expires in 15 minutes.</p>
            </div>
          ) : (
            <form onSubmit={signIn} style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input className="ad-input" style={{ flex: 1 }} type="email" required autoFocus placeholder="you@yourbusiness.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
              <button className="ad-btn primary" type="submit">Send link</button>
            </form>
          )}
          <p className="ad-note" style={{ marginTop: 18 }}>Not a customer yet? <a href="/#check" style={{ color: "var(--ad-amber-2)" }}>Run the free check</a> and see where you stand.</p>
        </div>
      </div>
    );
  }

  const b = me.business;
  const onboarding = !b || b.status === "onboarding";
  const TABS: { id: Tab; label: string }[] = onboarding
    ? [{ id: "setup", label: "Set up" }, { id: "billing", label: "Billing" }]
    : [{ id: "overview", label: "Overview" }, { id: "results", label: "Results" }, { id: "snippets", label: "For your site" }, { id: "profile", label: "Profile" }, { id: "billing", label: "Billing" }];
  const active: Tab = tab && TABS.some((t) => t.id === tab) ? tab : TABS[0].id;

  return (
    <div className="ad">
      <div className="ad-shell">
        <nav className="ad-side" aria-label="Dashboard sections">
          <div className="ad-brand">BiLabs</div>
          {TABS.map((t) => (
            <button key={t.id} className="ad-navbtn" onClick={() => setTab(t.id)} aria-current={active === t.id ? "page" : undefined}>{t.label}</button>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 14 }}>
            <p className="ad-note" style={{ margin: "0 0 7px", wordBreak: "break-all" }}>{me.email}</p>
            <button className="ad-btn" onClick={signOut} style={{ width: "100%" }}>Sign out</button>
          </div>
        </nav>

        <main className="ad-main">
          <div className="ad-head">
            <div>
              <h1 className="ad-h1">{b?.name ?? "Your business"}</h1>
              <p className="ad-sub">
                {b ? <>{[b.business_type, b.area].filter(Boolean).join(" · ")} · <span className={`ad-badge ${b.status}`}>{b.status}</span></> : "No business is set up on this account yet — email hello@bilabs.ai."}
              </p>
            </div>
            {b?.slug && !onboarding ? <a className="ad-btn" href={`/b/${b.slug}`} target="_blank" rel="noopener">View public profile ↗</a> : null}
          </div>

          {denied ? <ErrorBox message="Your session has expired or the subscription has ended. Sign in again." /> : null}

          {b?.status === "paused" ? <ErrorBox message="This profile is paused — usually a payment that did not go through. Check Billing, or email hello@bilabs.ai." /> : null}
          {b?.status === "cancelled" ? <ErrorBox message="This subscription has ended and the profile is no longer published. Start again from bilabs.ai whenever you like." /> : null}

          {active === "setup" && b ? <Setup me={me} call={call} onChange={load} /> : null}
          {active === "overview" && b ? <Status me={me} call={call} onChange={load} onGo={(t) => setTab(t as Tab)} /> : null}
          {active === "results" && b ? <Results me={me} call={call} /> : null}
          {active === "snippets" && b ? <Snippets call={call} /> : null}
          {active === "profile" && b ? <Profile me={me} call={call} onChange={load} /> : null}
          {active === "billing" ? <Billing me={me} call={call} /> : null}
        </main>
      </div>
    </div>
  );
}
