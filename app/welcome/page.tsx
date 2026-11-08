"use client";

import { useEffect, useRef, useState } from "react";

/* After Stripe.
 *
 * Stripe sends people here with the session id. We ask our own server what
 * it knows — paid or not, dashboard ready or not — and keep asking for half
 * a minute while the webhook lands. Whatever the webhook's timing, the
 * customer leaves this page with a sign-in link in their inbox. */

type State = { paid: boolean; plan: string | null; emailMasked: string | null; businessReady: boolean };

export default function WelcomePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("session_id");
      if (id) setSessionId(id); else setUnknown(true);
    } catch { setUnknown(true); }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/welcome?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (res.status === 404) { setUnknown(true); return; }
        const data = (await res.json()) as State;
        setState(data);
        if (data.paid && data.businessReady) return;
      } catch { /* try again */ }
      polls.current += 1;
      if (polls.current < 15) setTimeout(tick, 2000);
    };
    void tick();
    return () => { stop = true; };
  }, [sessionId]);

  const resend = async () => {
    if (!sessionId || sending) return;
    setSending(true); setErr(null);
    try {
      const res = await fetch("/api/welcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Could not send the link just now."); return; }
      setSent(data.emailMasked ?? "your email");
    } catch {
      setErr("Could not send the link just now.");
    } finally {
      setSending(false);
    }
  };

  const ready = Boolean(state?.paid && state?.businessReady);

  return (
    <section className="sec" style={{ minHeight: "60vh" }}>
      <div className="wrap" style={{ maxWidth: 640 }}>
        {unknown ? (
          <>
            <h1 className="h2">Nothing to see here</h1>
            <p style={{ marginTop: 12, color: "var(--ink-2)" }}>This page only works straight after a payment. If you have paid and ended up here by another route, sign in from <a href="/dashboard" style={{ color: "#B8841A" }}>your dashboard</a>.</p>
          </>
        ) : !state ? (
          <>
            <h1 className="h2">One moment…</h1>
            <p style={{ marginTop: 12, color: "var(--ink-2)" }}>Confirming your payment with Stripe.</p>
          </>
        ) : !state.paid ? (
          <>
            <h1 className="h2">Payment not completed</h1>
            <p style={{ marginTop: 12, color: "var(--ink-2)" }}>Stripe hasn&apos;t confirmed this payment. If you believe it went through, give it a minute and refresh, or email <a href="mailto:hello@bilabs.ai">hello@bilabs.ai</a>.</p>
          </>
        ) : (
          <>
            <h1 className="h2">You&apos;re in. Thank you.</h1>
            <p style={{ marginTop: 12, fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {ready
                ? <>Your dashboard is ready. A sign-in link has been sent to <strong>{state.emailMasked}</strong> — open it to set up your profile. It takes about five minutes.</>
                : <>Payment confirmed. Your welcome email, with your dashboard sign-in link, is on its way to <strong>{state.emailMasked}</strong>.</>}
            </p>

            <div className="card" style={{ marginTop: 22, background: "#fff" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" }}>What happens next</p>
              <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, color: "var(--ink-2)", lineHeight: 1.55 }}>
                <li>Confirm it&apos;s your business — we&apos;ve pre-filled what your free check found.</li>
                <li>Choose which assistants to monitor: ChatGPT, Claude, Gemini and Grok.</li>
                <li>Add your services, hours, prices and the questions customers ask.</li>
                <li>Publish. The first check runs straight away, then every month.</li>
              </ol>
            </div>

            <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <button type="button" className="btn-amber" onClick={resend} disabled={sending || Boolean(sent)} style={{ padding: "12px 20px" }}>
                {sent ? `Link sent to ${sent}` : sending ? "Sending…" : ready ? "Send the link again" : "Send my dashboard link now"}
              </button>
              <a href="/dashboard" className="btn-line" style={{ padding: "12px 20px" }}>Go to the dashboard</a>
            </div>
            {err && <p style={{ marginTop: 10, color: "#9a2a2a", fontSize: 14 }}>{err}</p>}

            <p style={{ marginTop: 22, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6 }}>
              Links work for 15 minutes. If yours has expired, enter your email at the dashboard and we&apos;ll send a fresh one. Questions — reply to any of our emails or write to hello@bilabs.ai.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
